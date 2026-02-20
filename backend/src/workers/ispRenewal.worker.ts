import { Worker, Job } from 'bullmq';
import { ISP_RENEWAL_QUEUE_NAME } from '../queues/ispRenewal.queue';
import { redisConnection } from '../config/redis';
import { serviceDb } from '../config/database'; // Import Prisma client
import { chromium, Browser, Page } from 'playwright';

// ... (rest of the file)

// Define the structure of the job data
interface IspRenewalJobData {
  executionLogId: string;
  clientId: string;
  amount: number;
}

// ... (imports)

const processIspRenewal = async (job: Job<IspRenewalJobData>) => {
  const { executionLogId, clientId, amount } = job.data;
  console.log(`Processing ISP renewal for client: ${clientId}, amount: ${amount}`);

  // Update status to PROCESSING
  await serviceDb.serviceExecutionLog.update({
    where: { id: executionLogId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: process.env.NODE_ENV === 'production' });
    const page = await browser.newPage();

    // 1. Login to ISP Portal
    await loginToIspPortal(page);

    // 2. Find and renew client
    const renewalSuccess = await findAndRenewClient(page, clientId, amount);

    if (renewalSuccess) {
      console.log(`Successfully renewed for client: ${clientId}`);
      // Update execution log with COMPLETED status
      await serviceDb.serviceExecutionLog.update({
        where: { id: executionLogId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          details: { message: 'Renewal successful' },
        },
      });
      return { status: 'Completed', executionLogId };
    } else {
      throw new Error('Renewal failed after processing.');
    }

  } catch (error: any) {
    console.error(`Error processing job ${job.id} for client ${clientId}:`, error.message);
    const screenshotPath = `error_screenshot_${job.id}.png`;
    // Optional: Take a screenshot on failure
    if (browser) {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: screenshotPath });
      }
    }
    
    // Update execution log with FAILED status and error message
    await serviceDb.serviceExecutionLog.update({
      where: { id: executionLogId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
        completedAt: new Date(),
        details: {
          error: error.stack,
          screenshot: screenshotPath,
        },
      },
    });

    throw error; // Re-throw to let BullMQ handle the failure and retry
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

async function loginToIspPortal(page: Page) {
  const loginUrl = process.env.ISP_PORTAL_URL;
  if (!loginUrl) throw new Error('ISP_PORTAL_URL is not defined in .env');

  console.log(`Navigating to ISP portal login page at ${loginUrl}`);
  await page.goto(loginUrl);

  // --- USER ACTION NEEDED ---
  // Please provide the correct selectors for the username, password, and submit button.
  const usernameSelector = '#username'; // <-- Replace with actual username input selector
  const passwordSelector = '#password'; // <-- Replace with actual password input selector
  const submitButtonSelector = 'button[type="submit"]'; // <-- Replace with actual submit button selector
  const successUrlOrSelector = '/dashboard'; // <-- Replace with a URL path or a unique selector that appears only after a successful login

  console.log('Filling login credentials...');
  await page.fill(usernameSelector, process.env.ISP_PORTAL_USER || '');
  await page.fill(passwordSelector, process.env.ISP_PORTAL_PASS || '');
  
  console.log('Submitting login form...');
  await page.click(submitButtonSelector);

  console.log(`Waiting for login success indicator: ${successUrlOrSelector}`);
  // Wait for either a URL change or a specific element to appear
  await page.waitForURL((url) => url.pathname.includes(successUrlOrSelector));
  
  console.log('Login successful.');
}

async function findAndRenewClient(page: Page, clientId: string, amount: number): Promise<boolean> {
  // --- USER ACTION NEEDED ---
  // Please provide the correct selectors and workflow for finding and renewing a client.
  const clientSearchUrl = process.env.ISP_CLIENT_SEARCH_URL; // e.g., http://isppanel.com/clients/search
  if (!clientSearchUrl) throw new Error('ISP_CLIENT_SEARCH_URL is not defined in .env');

  console.log(`Navigating to client search page at ${clientSearchUrl}`);
  await page.goto(clientSearchUrl);

  const searchInputSelector = '#search-client-input'; // <-- Replace with actual search input selector
  const searchButtonSelector = '#search-client-button'; // <-- Replace with actual search button selector
  // This selector should target a unique element for the client row that contains the client ID.
  // Example: `tr[data-client-id="${clientId}"]`
  const clientRowSelector = `.client-row[data-id="${clientId}"]`; // <-- Replace with a selector that uniquely identifies the client's row or entry
  
  console.log(`Searching for client ID: ${clientId}`);
  await page.fill(searchInputSelector, clientId);
  await page.click(searchButtonSelector);

  console.log(`Waiting for client row to appear with selector: ${clientRowSelector}`);
  await page.waitForSelector(clientRowSelector, { timeout: 10000 }); // Wait 10 seconds for search results

  // This selector should target the 'Renew' button specifically for that client.
  const renewButtonSelector = `${clientRowSelector} .renew-button`; // <-- Replace with the selector for the renew button within the client's row
  
  console.log('Clicking renew button...');
  await page.click(renewButtonSelector);

  // --- On the renewal page/modal ---
  const renewalAmountInputSelector = '#renewal-amount'; // <-- Replace with renewal amount input selector
  const confirmRenewalButtonSelector = '#confirm-renewal-button'; // <-- Replace with confirm button selector
  const successIndicatorSelector = '.renewal-success-message'; // <-- Replace with a selector for the success message element
  const successMessageText = 'successfully renewed'; // <-- Replace with the text that confirms success

  console.log('Waiting for renewal form to appear...');
  await page.waitForSelector(renewalAmountInputSelector);

  console.log(`Entering renewal amount: ${amount}`);
  await page.fill(renewalAmountInputSelector, amount.toString());
  
  console.log('Confirming renewal...');
  await page.click(confirmRenewalButtonSelector);

  console.log(`Waiting for success message with selector: ${successIndicatorSelector}`);
  await page.waitForSelector(successIndicatorSelector, { timeout: 15000 }); // Wait 15 seconds for confirmation

  const successMessage = await page.textContent(successIndicatorSelector);
  console.log(`Found confirmation message: "${successMessage}"`);
  
  return successMessage?.toLowerCase().includes(successMessageText.toLowerCase()) || false;
}

// ... (worker definition)

export const ispRenewalWorker = new Worker<IspRenewalJobData>(
  ISP_RENEWAL_QUEUE_NAME,
  processIspRenewal,
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
  }
);

ispRenewalWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully. Result:`, result);
});

ispRenewalWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});

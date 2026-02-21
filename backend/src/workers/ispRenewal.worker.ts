import { Worker, Job } from 'bullmq';
import { ISP_RENEWAL_QUEUE_NAME } from '../queues/ispRenewal.queue';
import { redisConnection } from '../config/redis';
import { getServiceDb } from '../config/database'; // Import Prisma client
import { chromium, Browser, Page } from 'playwright';

// ... (rest of the file)

// Define the structure of the job data
interface IspRenewalJobData {
  executionLogId: string;
  clientId: string;
  amount: number;
  packageName: string;
}

// ... (imports)

const processIspRenewal = async (job: Job<IspRenewalJobData>) => {
  console.log(`[START JOB] Worker received job ${job.id} for client: ${job.data.clientId}`);
  const { executionLogId, clientId, amount, packageName } = job.data;
  console.log(`Processing ISP renewal for client: ${clientId}, amount: ${amount}`);

  await getServiceDb().serviceExecutionLog.update({
    where: { id: executionLogId },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });

  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({ headless: process.env.NODE_ENV === 'production' });
    page = await browser.newPage();

    // 1. Login to ISP Portal
    await loginToIspPortal(page);

    // 2. Find subscriptionId (if not already mapped)
    let subscriptionId = await getSubscriptionId(page, clientId);

    // 3. Renew the client
    const renewalSuccess = await renewClient(page, subscriptionId, packageName);
    console.log(`renewClient returned: ${renewalSuccess} for job ${job.id}`); // New log

    if (renewalSuccess) {
      console.log(`Successfully renewed for client: ${clientId}`);
      console.log(`Attempting to update serviceExecutionLog to COMPLETED for job ${job.id}`); // New log
      await getServiceDb().serviceExecutionLog.update({
        where: { id: executionLogId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          details: { message: 'Renewal successful', subscriptionId },
        },
      });
      console.log(`serviceExecutionLog updated to COMPLETED for job ${job.id}`); // New log
      console.log(`[JOB COMPLETE] Job ${job.id} for client ${clientId} is returning success.`); // NEW LOG HERE
      return { status: 'Completed', executionLogId };
    } else {
      throw new Error('Renewal failed after processing.');
    }

  } catch (error: any) {
    console.error(`Error processing job ${job.id} for client ${clientId}:`, error.message);
    const screenshotPath = `error_screenshot_${job.id}.png`;
    // Optional: Take a screenshot on failure
    if (page) {
      await page.screenshot({ path: screenshotPath });
    }
    
    // Update execution log with FAILED status and error message
    await getServiceDb().serviceExecutionLog.update({
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
  // Please verify these selectors for your SmartISP login page.
  const usernameSelector = 'input[name="username"]'; // <-- VERIFY THIS
  const passwordSelector = 'input[name="password"]'; // <-- VERIFY THIS
  const submitButtonSelector = 'button[type="submit"]'; // <-- VERIFY THIS
  const successUrlOrSelector = '/index.php'; // <-- VERIFY THIS: The page you land on after login

  console.log('Filling login credentials...');
  await page.fill(usernameSelector, process.env.ISP_PORTAL_USER || '');
  await page.fill(passwordSelector, process.env.ISP_PORTAL_PASS || '');
  
  console.log('Submitting login form...');
  await page.click(submitButtonSelector);

  console.log(`Waiting for login success indicator: ${successUrlOrSelector}`);
  // Wait for the URL to change to the dashboard page
  await page.waitForURL(`**${successUrlOrSelector}`, { timeout: 15000 });
  
  console.log('Login successful.');
}

async function getSubscriptionId(page: Page, clientId: string): Promise<string> {
  // 1. Check our database first
  const existingMap = await getServiceDb().ispClientMap.findUnique({
    where: { clientId },
  });

  if (existingMap) {
    console.log(`Found mapped subscriptionId: ${existingMap.subscriptionId} for clientId: ${clientId}`);
    return existingMap.subscriptionId;
  }

  // 2. If not found, scrape it from the ISP panel
  console.log(`No mapping found for clientId: ${clientId}. Scraping from ISP panel...`);
  await getServiceDb().serviceExecutionLog.updateMany({
    where: { requestPayload: { path: ['clientId'], equals: clientId } },
    data: { status: 'MAPPING_CLIENT' },
  });

  const clientSearchUrl = process.env.ISP_CLIENT_SEARCH_URL;
  if (!clientSearchUrl) throw new Error('ISP_CLIENT_SEARCH_URL is not defined in .env');

  console.log(`Navigating to client search page at ${clientSearchUrl}`);
  await page.goto(clientSearchUrl);

  // --- USER ACTION NEEDED ---
  // These selectors are for finding the client and extracting the subscriptionId.
  const searchInputSelector = 'input[type="search"]'; // Already provided
  const searchButtonSelector = 'button[type="submit"]'; // This might not be needed if search is automatic
  
  // This selector points to the link in the "C.ID" column of the first row of the results table.
  const clientLinkSelector = '#client-table-body > tr:first-child > td:nth-child(3) > a'; // <-- VERIFY THIS

  console.log(`Searching for client ID: ${clientId}`);
  await page.fill(searchInputSelector, clientId);
  await page.click(searchButtonSelector);

  // Wait for navigation to client-info.php or client-accounts.php
  await page.waitForURL(url => url.toString().includes('client-info.php') || url.toString().includes('client-accounts.php'), { timeout: 15000 });

  const currentUrl = page.url();
  let subscriptionId: string | null = null;

  if (currentUrl.includes('client-info.php')) {
    // If redirected directly to client-info.php, extract subscriptionId from URL
    const urlParams = new URLSearchParams(new URL(currentUrl).search);
    subscriptionId = urlParams.get('subscriptionId');
    if (!subscriptionId) {
      throw new Error(`Could not extract subscriptionId from URL: ${currentUrl}`);
    }
    console.log(`Extracted subscriptionId from URL: ${subscriptionId}`);
  } else if (currentUrl.includes('client-accounts.php')) {
    // If still on client-accounts.php, then search results are in a table
    const clientLinkSelector = '#client-table-body > tr:first-child > td:nth-child(3) > a'; // <-- VERIFY THIS
    console.log(`Waiting for client link to appear with selector: ${clientLinkSelector}`);
    await page.waitForSelector(clientLinkSelector, { timeout: 15000 });

    const clientLink = await page.getAttribute(clientLinkSelector, 'href');
    if (!clientLink) {
      throw new Error(`Could not find href attribute for selector: ${clientLinkSelector}`);
    }

    // Extract subscriptionId from the URL (e.g., from 'client-renew.php?subscriptionId=375510')
    const urlParams = new URLSearchParams(clientLink);
    subscriptionId = urlParams.get('subscriptionId');

    if (!subscriptionId) {
      throw new Error(`Could not extract subscriptionId from link: ${clientLink}`);
    }
    console.log(`Extracted subscriptionId from link: ${clientLink}`);
  } else {
    throw new Error(`Unexpected page after client search: ${currentUrl}`);
  }

  if (!subscriptionId) {
    throw new Error('Subscription ID not found after client search.');
  }

  console.log(`Extracted subscriptionId: ${subscriptionId}`);

  // 3. Save the new mapping to our database
  await getServiceDb().ispClientMap.create({
    data: {
      clientId,
      subscriptionId,
    },
  });
  console.log(`Saved new mapping for clientId: ${clientId}`);

  return subscriptionId;
}

async function renewClient(page: Page, subscriptionId: string, packageName: string): Promise<boolean> {
  // This workflow directly navigates to the client renewal page.

  const clientRenewUrl = `${process.env.ISP_PORTAL_URL?.replace('/login.php', '')}/client-renew.php?subscriptionId=${subscriptionId}`;  console.log(`Navigating directly to client renewal page: ${clientRenewUrl}`);
  await page.goto(clientRenewUrl);

  await getServiceDb().serviceExecutionLog.updateMany({
    where: { requestPayload: { path: ['subscriptionId'], equals: subscriptionId } },
    data: { status: 'RENEWING' },
  });

  // --- USER ACTION NEEDED ---
  // Please verify and correct these selectors based on your ISP panel.
  const planDropdownSelector = 'select[name="planId"]'; // <-- VERIFY THIS
  const sendSmsCheckboxSelector = 'input[name="send_sms"]'; // <-- VERIFY THIS
  const renewButtonSelector = '#renewSubmit'; // <-- CORRECTED based on screenshot
  const successMessageText = 'Renew Successfully'; // <-- CORRECTED based on screenshot

  // console.log(`Waiting for plan dropdown: ${planDropdownSelector}`);
  // await page.waitForSelector(planDropdownSelector);

  // console.log(`Selecting package: ${packageName}`);
  // await page.selectOption(planDropdownSelector, { label: packageName });



  // Check if the renew button exists on the page before trying to click it
  await page.waitForSelector(renewButtonSelector, { state: 'visible', timeout: 10000 }); // Wait for the button to be visible
  const renewButtonCount = await page.locator(renewButtonSelector).count();
  console.log(`Renew button found: ${renewButtonCount > 0}`);
  if (renewButtonCount === 0) {
    throw new Error(
      'Renew button not found. Probable cause: Insufficient balance in ISP portal.',
    );
  }

  console.log(`Clicking the renew button: ${renewButtonSelector}`);
   // Wait for the page to be fully loaded and interactive
  await page.locator(renewButtonSelector).scrollIntoViewIfNeeded(); // Ensure the button is in view
  try {
      await page.locator(renewButtonSelector).click({ timeout: 5000 }); // Add a timeout for the click operation
      console.log('Renewal process completed after click.'); // Updated log
      return true; // Return immediately after click
    } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error clicking renew button: ${errorMessage}`);
    throw new Error(`Failed to click renew button: ${errorMessage}`);
  }
}

// ... (worker definition)

export const ispRenewalWorker = new Worker<IspRenewalJobData>(
  ISP_RENEWAL_QUEUE_NAME,
  processIspRenewal,
  {
    connection: redisConnection,
    concurrency: 1, // Process only one job at a time to avoid Playwright concurrency issues
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
  }
);

ispRenewalWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed successfully. Result:`, result);
});

ispRenewalWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err.message);
});

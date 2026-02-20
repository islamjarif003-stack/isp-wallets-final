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
  console.log('Logging into ISP portal...');
  await page.goto(process.env.ISP_PORTAL_URL || 'http://isppanel.com/login');
  
  // Replace with actual selectors and credentials
  await page.fill('#username', process.env.ISP_PORTAL_USER || 'admin');
  await page.fill('#password', process.env.ISP_PORTAL_PASS || 'password');
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForNavigation();
  console.log('Login successful.');
}

async function findAndRenewClient(page: Page, clientId: string, amount: number): Promise<boolean> {
  console.log(`Searching for client: ${clientId}`);
  
  // Replace with actual selectors for searching client
  await page.fill('#search-client', clientId);
  await page.click('#search-button');
  await page.waitForTimeout(2000); // Wait for search results

  // Click on the client profile/renew button
  await page.click(`.client-row[data-id="${clientId}"] .renew-button`);

  // On the renewal page
  await page.waitForSelector('#renewal-amount');
  await page.fill('#renewal-amount', amount.toString());
  await page.click('#confirm-renewal');

  // Verify success
  const successMessage = await page.textContent('.renewal-success-message');
  return successMessage?.includes('successfully renewed') || false;
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

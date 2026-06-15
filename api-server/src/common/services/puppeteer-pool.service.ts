/**
 * ============================================================================
 * PUPPETEER BROWSER POOL — SINGLETON BROWSER INSTANCE
 * ============================================================================
 *
 * Instead of launching a new Chromium process per PDF request (200-500MB each),
 * this service maintains a SINGLE shared browser instance with a page pool.
 *
 * Benefits:
 * - Eliminates OOM from concurrent browser launches
 * - Reduces PDF generation time (no browser startup overhead)
 * - Limits concurrent pages to prevent resource exhaustion
 *
 * Usage:
 *   constructor(private browserPool: PuppeteerPoolService) {}
 *
 *   async generatePdf(html: string) {
 *     const { browser, page } = await this.browserPool.acquirePage();
 *     try {
 *       await page.setContent(html, { waitUntil: 'networkidle0' });
 *       return await page.pdf({ format: 'A4' });
 *     } finally {
 *       await this.browserPool.releasePage(page);
 *     }
 *   }
 *
 * ============================================================================
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

const MAX_CONCURRENT_PAGES = 3; // Limit concurrent PDF generations
const BROWSER_LAUNCH_TIMEOUT = 30000;
const PAGE_IDLE_TIMEOUT = 60000; // Close idle pages after 60s

interface PageWrapper {
  page: any;
  acquiredAt: number;
}

@Injectable()
export class PuppeteerPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPoolService.name);
  private browser: any = null;
  private puppeteer: any = null;
  private activePages: Set<any> = new Set();
  private isLaunching = false;
  private launchPromise: Promise<any> | null = null;
  private pendingAcquires: Array<{
    resolve: (value: { browser: any; page: any }) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  async onModuleInit() {
    this.logger.log('PuppeteerPoolService initialized (lazy browser launch)');
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  /**
   * Get or launch the shared browser instance
   */
  private async getBrowser(): Promise<any> {
    // If browser is alive, return it
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If already launching, wait for that launch
    if (this.isLaunching && this.launchPromise) {
      return this.launchPromise;
    }

    // Launch new browser
    this.isLaunching = true;
    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.isLaunching = false;
      this.launchPromise = null;
    }
  }

  private async launchBrowser(): Promise<any> {
    if (!this.puppeteer) {
      this.puppeteer = await import('puppeteer');
    }

    const executablePath = this.findChromePath();
    const userDataDir = path.join(os.tmpdir(), 'academia-puppeteer-pool');

    const launchOptions: any = {
      headless: true,
      timeout: BROWSER_LAUNCH_TIMEOUT,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--disable-software-rasterizer',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-component-extensions-with-background-pages',
        // Memory optimization
        '--js-flags=--max-old-space-size=256',
        `--user-data-dir=${userDataDir}`,
      ],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log('Launching shared Chromium browser instance...');
    const browser = await this.puppeteer.launch(launchOptions);

    // Handle unexpected browser disconnection
    browser.on('disconnected', () => {
      this.logger.warn('Shared browser disconnected, will re-launch on next request');
      this.browser = null;
      this.activePages.clear();
    });

    this.logger.log('Shared Chromium browser launched successfully');
    return browser;
  }

  private findChromePath(): string | undefined {
    const FALLBACK_PATHS = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    if (envPath && existsSync(envPath)) return envPath;

    return FALLBACK_PATHS.find((p) => existsSync(p));
  }

  /**
   * Acquire a page from the pool.
   * If max concurrent pages reached, queues the request.
   */
  async acquirePage(): Promise<{ browser: any; page: any }> {
    const browser = await this.getBrowser();

    // Check if we can create a new page
    if (this.activePages.size < MAX_CONCURRENT_PAGES) {
      const page = await browser.newPage();
      this.activePages.add(page);

      // Set reasonable defaults
      await page.setDefaultTimeout(30000);
      await page.setDefaultNavigationTimeout(30000);

      return { browser, page };
    }

    // Queue the request
    return new Promise<{ browser: any; page: any }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingAcquires.findIndex((p) => p.resolve === resolve);
        if (idx !== -1) this.pendingAcquires.splice(idx, 1);
        reject(new Error('Timeout waiting for available browser page'));
      }, PAGE_IDLE_TIMEOUT);

      this.pendingAcquires.push({ resolve, reject, timeout });
      this.logger.warn(`Page pool full (${this.activePages.size}/${MAX_CONCURRENT_PAGES}), queuing request`);
    });
  }

  /**
   * Release a page back to the pool
   */
  async releasePage(page: any): Promise<void> {
    try {
      this.activePages.delete(page);
      await page.close().catch(() => {});
    } catch (e) {
      // Ignore close errors
    }

    // Fulfill pending acquires
    if (this.pendingAcquires.length > 0 && this.browser) {
      const next = this.pendingAcquires.shift()!;
      clearTimeout(next.timeout);

      try {
        const browser = this.browser;
        const newPage = await browser.newPage();
        this.activePages.add(newPage);
        await newPage.setDefaultTimeout(30000);
        await newPage.setDefaultNavigationTimeout(30000);
        next.resolve({ browser, page: newPage });
      } catch (e) {
        next.reject(e);
      }
    }
  }

  /**
   * Close the shared browser (called on shutdown)
   */
  async closeBrowser(): Promise<void> {
    // Reject pending acquires
    for (const pending of this.pendingAcquires) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Browser shutting down'));
    }
    this.pendingAcquires = [];

    // Close all active pages
    for (const page of this.activePages) {
      try { await page.close().catch(() => {}); } catch {}
    }
    this.activePages.clear();

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log('Shared Chromium browser closed');
      } catch (e) {
        this.logger.warn('Error closing browser:', e.message);
      }
      this.browser = null;
    }
  }

  /**
   * Get pool status for monitoring
   */
  getStatus() {
    return {
      browserConnected: this.browser?.connected ?? false,
      activePages: this.activePages.size,
      maxPages: MAX_CONCURRENT_PAGES,
      pendingAcquires: this.pendingAcquires.length,
    };
  }
}

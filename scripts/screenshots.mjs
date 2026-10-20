// Takes the README screenshots from the live web demo, like an interviewer
// would see it: a fresh visitor opens the app, loads the demo (Jonas) and
// goes through the main screens. Phone size (iPhone 14), 3× pixel density.
//
//   node scripts/screenshots.mjs [url]
//
// Uses the Microsoft Edge installed on this machine (playwright-core doesn't
// download a browser). Loading the demo creates one new anonymous demo
// account and uses a few AI calls (embeddings + one check-in reply).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SITE = process.argv[2] ?? 'https://destress-ai.vercel.app';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'en-GB',
  colorScheme: 'light',
});
const page = await context.newPage();

/** Waits until the screen has loaded and its entrance animations are done, then saves it. */
async function shot(name, settleMs = 3500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: `${OUT}/${name}.png` }); // then: python scripts/optimize-screenshots.py
  console.log('saved', name);
}

async function open(path, name, settleMs) {
  await page.goto(`${SITE}${path}`);
  await shot(name, settleMs);
}

// A fresh visitor: start screen, then load the demo.
await page.goto(SITE);
await shot('01-start');
await page.getByText('explore the demo').click();
await page.waitForURL('**/home', { timeout: 120_000 });
await shot('02-today', 5000);

// Tonight's check-in: the AI opens, Jonas answers, the AI replies.
await page.goto(`${SITE}/diary/new`);
await page.waitForTimeout(12_000);
await page.getByPlaceholder('Write or tap the mic…').fill(
  'Pretty good day. Markus came by at 5:30 again, but I said I can do it tomorrow morning. Went for a walk after work.',
);
await page.getByLabel('Send').click();
await shot('03-checkin', 15_000);
await open('/deep-dives', '04-weekly-insights');
await open('/calendar', '05-calendar');
await page.mouse.wheel(0, 900);
await shot('06-calendar-chart', 2000);
await open('/untangle', '07-untangle');
await page.goto(`${SITE}/untangle/calm`);
await page.waitForTimeout(3000);
// Set the stress slider to 7 so the orb shows its colour.
const slider = await page.getByLabel('Stress from 0 to 10').boundingBox();
if (slider) await page.mouse.click(slider.x + 15 + (slider.width - 30) * 0.7, slider.y + slider.height / 2);
await shot('08-calm-now', 2500);

await page.goto(`${SITE}/untangle`);
await page.getByText('Saying no to my boss').first().click();
await shot('09-plan', 4000);

await open('/community', '10-community');
await page.getByText('How I learned to sleep again').first().click();
await shot('11-story', 4000);

await browser.close();

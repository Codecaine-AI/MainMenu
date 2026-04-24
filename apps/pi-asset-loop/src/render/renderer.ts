// Headless chromium screenshot of a wrapped HTML/CSS component.
// Ported from the Python render step that previously owned this pipeline phase.
// Uses playwright core (not @playwright/test) for a smaller install.

import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

export interface RenderArgs {
  wrapperPath: string;
  renderPath: string;
  referenceWidth: number;
  referenceHeight: number;
  settleMs?: number;
}

export async function renderWithPlaywright(args: RenderArgs): Promise<void> {
  const settleMs = args.settleMs ?? 350;
  const viewportWidth = Math.max(args.referenceWidth + 160, 900);
  const viewportHeight = Math.max(args.referenceHeight + 200, 700);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(args.wrapperPath).toString(), { waitUntil: "load" });
    await page.waitForTimeout(Math.max(settleMs, 0));
    await page.waitForFunction(
      "() => !document.fonts || document.fonts.status === 'loaded'",
      undefined,
      { timeout: 5_000 },
    );

    const locator = page.locator("#asset-root");
    await locator.waitFor({ state: "visible", timeout: 5_000 });
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error("Failed to measure rendered asset bounds.");
    }

    await page.screenshot({
      path: args.renderPath,
      omitBackground: true,
      clip: {
        x: Math.max(Math.floor(box.x), 0),
        y: Math.max(Math.floor(box.y), 0),
        width: Math.max(Math.ceil(box.width), 1),
        height: Math.max(Math.ceil(box.height), 1),
      },
    });
  } finally {
    await browser.close();
  }
}

import { expect, test } from '@playwright/test';
for (const width of [390, 1280]) {
  test(`checkboxes remain compact with usable labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const slug of ['password-generator', 'base64']) {
      await page.goto(`/tools/${slug}.html`);
      const boxes = page.locator('main input[type="checkbox"]');
      expect(await boxes.count()).toBe(slug === 'password-generator' ? 7 : 2);
      for (const box of await boxes.all()) {
        const bounds = await box.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.width).toBeGreaterThanOrEqual(14);
        expect(bounds!.width).toBeLessThanOrEqual(22);
        expect(bounds!.height).toBeGreaterThanOrEqual(14);
        expect(bounds!.height).toBeLessThanOrEqual(22);
        const label = box.locator('..');
        expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const first = boxes.first();
      const checked = await first.isChecked();
      await first.focus(); await page.keyboard.press('Space');
      expect(await first.isChecked()).toBe(!checked);
      await first.locator('..').click();
      expect(await first.isChecked()).toBe(checked);
      const numeric = page.locator('input[type="number"]').first();
      if (await numeric.count()) expect((await numeric.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  });
}

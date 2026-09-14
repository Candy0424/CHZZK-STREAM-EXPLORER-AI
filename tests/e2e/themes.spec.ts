import { test, expect } from "@playwright/test";

function contrastRatio(first: string, second: string) {
  function luminance(color: string) {
    return color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .reduce((total, value, index) => {
        const channel = value / 255;
        const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        return total + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0);
  }
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("theme picker changes the whole palette, fits the viewport and remembers the selection", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".streamer-card")).toHaveCount(16);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cloud");
  await page.getByRole("button", { name: "테마 선택", exact: true }).click();
  const panel = page.getByRole("region", { name: "화면 테마 설정" });
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);

  const backgrounds = new Set<string>();
  for (const name of ["미드나잇", "라벤더", "샌드", "포레스트", "클라우드"]) {
    const radio = page.getByRole("radio", { name, exact: true });
    await radio.check();
    await expect(radio).toBeChecked();
    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      foreground: getComputedStyle(document.body).color,
      button: getComputedStyle(document.querySelector(".hero-copy button")!).backgroundColor,
      buttonText: getComputedStyle(document.querySelector(".hero-copy button")!).color,
      secondaryText: getComputedStyle(document.querySelector(".page-heading p")!).color,
    }));
    backgrounds.add(colors.background);
    expect(contrastRatio(colors.background, colors.foreground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.background, colors.secondaryText)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.button, colors.buttonText)).toBeGreaterThanOrEqual(4.5);
    if (process.env.UPDATE_SCREENSHOTS === "true" && testInfo.project.name === "desktop") {
      await page.screenshot({
        path: `test-results/theme-${name}.png`,
        animations: "disabled",
        style: "nextjs-portal { display: none; }",
      });
    }
  }
  expect(backgrounds.size).toBe(5);
  await page.getByRole("radio", { name: "미드나잇", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "라벤더", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole("button", { name: "테마 선택", exact: true })).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lavender");
  await page.getByRole("button", { name: "테마 선택", exact: true }).click();
  await expect(page.getByRole("radio", { name: "라벤더", exact: true })).toBeChecked();
  expect(errors).toEqual([]);
});

test("saved theme is applied before hydration and selections propagate to another tab", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator(".streamer-card")).toHaveCount(16);
  await page.getByRole("button", { name: "테마 선택", exact: true }).click();
  await page.getByRole("radio", { name: "미드나잇", exact: true }).check();
  const second = await context.newPage();
  // Blocking the React bundles proves the inline script restores the theme on its own.
  await second.route("**/_next/**/*.js*", (route) => route.abort());
  await second.goto("/");
  await expect(second.locator("html")).toHaveAttribute("data-theme", "midnight");
  await second.unrouteAll();
  await second.reload();
  await expect(second.locator(".streamer-card")).toHaveCount(16);
  await second.getByRole("button", { name: "테마 선택", exact: true }).click();
  await second.getByRole("radio", { name: "샌드", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "sand");
  await second.close();
});

test("themes remain usable with invalid or unavailable browser storage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("livescope.theme", "unknown-theme"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cloud");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage disabled", "SecurityError");
    };
  });
  await page.getByRole("button", { name: "테마 선택", exact: true }).click();
  await page.getByRole("radio", { name: "포레스트", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
  await expect(page.getByText("테마를 적용했어요.", { exact: false })).toBeVisible();
  await page.locator(".breadcrumb").click();
  await expect(page.getByRole("region", { name: "화면 테마 설정" })).not.toBeVisible();
});

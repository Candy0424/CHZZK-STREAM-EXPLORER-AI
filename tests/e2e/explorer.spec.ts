import { test, expect } from "@playwright/test";
test("loads the catalog, filters, searches, resets and avoids horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "지금, 어떤 방송 볼까?" })).toBeVisible();
  await expect(page.locator(".streamer-card")).toHaveCount(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole("group", { name: "방송 상태" })
    .getByRole("button", { name: "라이브" })
    .click();
  await expect(page.locator(".streamer-card")).toHaveCount(8);
  await expect(page.locator('[data-status="OFFLINE"]')).toHaveCount(0);
  await page.getByRole("textbox", { name: "방송 검색" }).fill("모카");
  await expect(page.locator(".streamer-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "방송 검색" }).fill("존재하지 않는 채널");
  await expect(page.getByText("조건에 맞는 방송인이 없어요")).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await expect(page.locator(".streamer-card")).toHaveCount(16);
  if (process.env.UPDATE_SCREENSHOTS === "true") {
    await page.goto("/");
    await expect(page.locator(".streamer-card")).toHaveCount(16);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `docs/screenshots/${testInfo.project.name}.png`,
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none; }",
    });
  }
});
test("favorite survives reload and can be removed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "모카플레이 즐겨찾기 추가" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "모카플레이 즐겨찾기 해제" })).toBeVisible();
  if (await page.getByRole("button", { name: "메뉴 열기" }).isVisible())
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("button", { name: "즐겨찾기" })
    .click();
  await expect(page.locator(".streamer-card")).toHaveCount(1);
  await page.getByRole("button", { name: "모카플레이 즐겨찾기 해제" }).click();
  await expect(page.getByText("아직 저장한 방송인이 없어요")).toBeVisible();
});
test("demo uses a clear explanation, offline cards have no link, adult images stay blurred", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".streamer-card")).toHaveCount(16);
  await expect(page.locator('[data-status="OFFLINE"] a')).toHaveCount(0);
  await expect(page.locator(".adult-image")).toHaveCSS("filter", "blur(24px) brightness(0.5)");
  await page.getByRole("button", { name: "모카플레이 샘플 방송 정보 보기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("이 채널은 화면 미리보기를 위한 가상 채널입니다.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("real online cards open the exact official channel in a new tab", async ({
  page,
  context,
}) => {
  const id = "a".repeat(32);
  await page.route("**/api/streamers?**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.mode = "live";
    body.items = [{ ...body.items[0], channelId: id, demo: false }];
    body.total = 1;
    body.nextPage = null;
    await route.fulfill({ json: body });
  });
  await context.route("https://chzzk.naver.com/**", (route) =>
    route.fulfill({ body: "Official channel navigation fixture" }),
  );
  await page.goto("/");
  const card = page.getByRole("link", { name: /치지직에서 방송 보기/ });
  await expect(card).toHaveAttribute("href", `https://chzzk.naver.com/${id}`);
  await expect(card).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = page.waitForEvent("popup");
  await card.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toBe(`https://chzzk.naver.com/${id}`);
});
test("stale data retains online status and shows a delay warning", async ({ page }) => {
  await page.route("**/api/streamers?**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.freshness = "stale";
    body.counts.delayed = 16;
    body.lastSuccessfulSync = new Date(Date.now() - 3600000).toISOString();
    await route.fulfill({ json: body });
  });
  await page.goto("/");
  await expect(page.getByText("상태 확인이 지연되고 있습니다.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-status="ONLINE"]')).toHaveCount(8);
});
test("filters categories, sorts names and uses tag filters", async ({ page }) => {
  await page.goto("/");
  await page.locator(".category-pills").getByRole("button", { name: "스포츠" }).click();
  await expect(page.locator(".streamer-card")).toHaveCount(2);
  await page.locator(".category-pills").getByRole("button", { name: "전체", exact: true }).click();
  await page.getByLabel("정렬 기준").selectOption("name_asc");
  await expect(page.locator(".streamer-card").first().locator(".channel-name")).toHaveText("네온");
  await page.getByRole("button", { name: "세부 필터" }).click();
  await page.getByLabel("태그 필터").fill("힐링");
  await expect(page.locator(".streamer-card")).toHaveCount(3);
});
test("internal sync requires authorization and public queries validate pagination", async ({
  request,
}) => {
  expect((await request.post("/api/internal/sync")).status()).toBe(401);
  expect((await request.get("/api/streamers?page=-1")).status()).toBe(400);
  const response = await request.get("/api/streamers?page=1&pageSize=3");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).items).toHaveLength(3);
});

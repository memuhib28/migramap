import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore Expo Demo", exact: true })
    .click();
  await expect(
    page.getByText("Fictional demo data", { exact: false }).first(),
  ).toBeVisible();
});
test("personal workflow persists, isolates modes, exports and deletes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("Diary mode", { exact: true }).selectOption("personal");
  await page.getByRole("button", { name: "I understand — open diary" }).click();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("0");
  await page
    .getByRole("button", { name: "Record your day", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Did you have a headache today? *" })
    .getByRole("radio", { name: "No", exact: true })
    .check();
  await page.getByLabel("Sleep duration").fill("7.5");
  await page
    .getByLabel("Notes (optional)")
    .fill("Fictional personal-mode test");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page
    .getByRole("button", { name: "View your diary", exact: true })
    .click();
  await expect(
    page.getByText("Fictional personal-mode test", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "My Diary", exact: true })
    .click();
  await expect(
    page.getByText("Fictional personal-mode test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit check-in", exact: true })
    .click();
  await page.getByLabel("Sleep duration").fill("8");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page
    .getByRole("button", { name: "View your diary", exact: true })
    .click();
  await expect(page.getByText("8 hours", { exact: false })).toBeVisible();
  await page.getByLabel("Diary mode", { exact: true }).selectOption("demo");
  await expect(page.locator(".stat").first().locator("strong")).not.toHaveText(
    "1",
  );
  await page.getByLabel("Diary mode", { exact: true }).selectOption("personal");
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("1");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Settings & Data" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON backup" }).click();
  expect((await download).suggestedFilename()).toContain("personal");
  await page.getByRole("button", { name: "Delete all personal data" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByText("Records deleted.", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("0");
  expect(errors).toEqual([]);
});
test("navigation, Urdu RTL, animation controls, mobile and screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.screenshot({
    path: "../../work/migramap-desktop.png",
    fullPage: true,
  });
  for (const name of [
    "My Headache Check-in",
    "Add an Attack",
    "My Diary",
    "Patterns",
    "My Summary",
    "Learn About Migraine",
    "Student Roll-On Project",
    "Research & Expo",
    "Settings & Data",
  ]) {
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator("h1")).toHaveText(name);
  }
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Learn About Migraine" })
    .click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page.getByLabel("Reduced motion: use numbered scenes").check();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "اردو" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("h1")).toHaveText("مائیگرین کی آگاہی");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../work/migramap-urdu-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "English", exact: false }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.screenshot({
    path: "../../work/migramap-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("invalid import is non-destructive; merge and replace are explicit", async ({
  page,
}) => {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Settings & Data" })
    .click();
  await page.getByLabel("Choose a MigraMap JSON backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"app":"bad"}'),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  const backup = await page.evaluate(async () => {
    return new Promise<any>((resolve) => {
      const r = indexedDB.open("migramap-v1", 1);
      r.onsuccess = () => {
        const q = r.result
          .transaction("datasets")
          .objectStore("datasets")
          .get("demo");
        q.onsuccess = () => {
          resolve({
            app: "MigraMap",
            version: 1,
            mode: "demo",
            data: q.result,
          });
          r.result.close();
        };
      };
    });
  });
  expect(backup.data.days.length).toBeGreaterThan(0);
  backup.data.days[0].notes = "Imported fictional note";
  await page.getByLabel("Choose a MigraMap JSON backup").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText("Preview — nothing imported yet")).toBeVisible();
  await page.getByLabel("Import method").selectOption("merge");
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText("Backup imported successfully.")).toBeVisible();
  await page.getByLabel("Choose a MigraMap JSON backup").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...backup, data: { days: [], attacks: [] } }),
    ),
  });
  await page.getByLabel("Import method").selectOption("replace");
  await page.getByRole("button", { name: "Confirm import" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.locator(".stat").first().locator("strong")).toHaveText("0");
});

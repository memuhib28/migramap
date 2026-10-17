import { JSDOM } from "jsdom";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { webcrypto } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fireEvent,
  getByRole,
  getByLabelText,
  queryByText,
  waitFor,
  within,
} from "@testing-library/dom";
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost:5173", pretendToBeVisual: true },
);
const win = dom.window;
Object.assign(globalThis, {
  window: win,
  document: win.document,
  navigator: win.navigator,
  HTMLElement: win.HTMLElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLDialogElement: win.HTMLDialogElement,
  localStorage: win.localStorage,
  indexedDB,
  IDBKeyRange,
  crypto: webcrypto,
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }),
});
(win.HTMLDialogElement.prototype as any).showModal = function () {
  this.setAttribute("open", "");
};
(win.HTMLDialogElement.prototype as any).close = function () {
  this.removeAttribute("open");
};
const spoken: any[] = [];
class FakeUtterance {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}
Object.assign(win, {
  SpeechSynthesisUtterance: FakeUtterance,
  speechSynthesis: {
    resume() {},
    getVoices: () => [{ lang: "en-US" }, { lang: "ur-PK" }],
    addEventListener() {},
    removeEventListener() {},
    cancel() {},
    speak(u: any) {
      spoken.push(u);
    },
  },
});
Object.assign(globalThis, { SpeechSynthesisUtterance: FakeUtterance });
win.scrollTo = () => {};
let printCalls = 0;
win.print = () => {
  printCalls++;
};
const downloads: { name: string; blob: Blob }[] = [];
let latestBlob: Blob;
URL.createObjectURL = (blob: Blob) => {
  latestBlob = blob;
  return "blob:fixture";
};
URL.revokeObjectURL = () => {};
win.HTMLAnchorElement.prototype.click = function () {
  downloads.push({ name: this.download, blob: latestBlob });
};
const body = () => win.document.body;
const button = (name: string) => getByRole(body(), "button", { name });
const click = async (name: string) =>
  fireEvent.click(await waitFor(() => button(name)));
const nav = (name: string) =>
  fireEvent.click(
    getByRole(win.document.querySelector(".sidebar") as HTMLElement, "button", {
      name,
    }),
  );
const fill = (name: string, value: string) =>
  fireEvent.change(getByLabelText(body(), name, { exact: false }), {
    target: { value },
  });
const heading = async (name: string) =>
  waitFor(() =>
    assert.equal(win.document.querySelector("h1")?.textContent, name),
  );
const text = async (value: string) =>
  waitFor(() =>
    assert.ok(queryByText(body(), value, { exact: true }), "Missing: " + value),
  );
const metric = async (n: string) =>
  waitFor(() =>
    assert.equal(win.document.querySelector(".stat strong")?.textContent, n),
  );
describe("DOM integration: actual React application", () => {
  it("loads fictional demo, all screens and Urdu RTL", async () => {
    await import("../src/main");
    await waitFor(() => assert.ok(queryByText(body(), "Welcome to MigraMap")));
    await click("Explore Expo Demo");
    await waitFor(() => assert.ok(win.document.querySelector(".stat strong")));
    for (const name of [
      "My Headache Check-in",
      "Add an Attack",
      "My Diary",
      "Patterns",
      "My Summary",
      "Learn About Migraine",
      "Settings & Data",
    ]) {
      nav(name);
      await heading(name);
    }
    fireEvent.click(getByRole(body(), "button", { name: /اردو/ }));
    await waitFor(() => assert.equal(win.document.documentElement.dir, "rtl"));
    await heading("ترتیبات اور ڈیٹا");
    fireEvent.click(getByRole(body(), "button", { name: /English/ }));
    await heading("Settings & Data");
  });
  it("starts personal mode empty; saves and edits headache-free days", async () => {
    fill("Diary mode", "personal");
    await text("Before your first personal entry");
    await click("I understand — open diary");
    await metric("0");
    await click("Record your day");
    await heading("My Headache Check-in");
    fireEvent.click(
      within(
        getByRole(body(), "group", {
          name: "Did you have a headache today? *",
        }),
      ).getByRole("radio", { name: "No" }),
    );
    assert.ok(!body().textContent?.includes("When did the headache start?"));
    fill("Sleep duration", "7.5");
    fill("Notes (optional)", "Fictional DOM record");
    await click("Save check-in");
    await click("View your diary");
    await heading("My Diary");
    await text("Fictional DOM record");
    await click("Edit check-in");
    await heading("My Headache Check-in");
    fill("Sleep duration", "8");
    await click("Save check-in");
    await click("View your diary");
    await heading("My Diary");
    assert.ok(body().textContent?.includes("8 hours"));
    nav("Overview");
    await metric("1");
  });
  it("prevents duplicate check-ins without overwriting", async () => {
    nav("My Headache Check-in");
    await heading("My Headache Check-in");
    await click("Save check-in");
    await text(
      "A check-in already exists for this date. Edit it in your diary.",
    );
    assert.equal(
      win.document.querySelector("h1")?.textContent,
      "My Headache Check-in",
    );
    nav("My Diary");
    await heading("My Diary");
    await text("Fictional DOM record");
  });
  it("records overnight attacks, flags overlap, edits and deletes", async () => {
    nav("Add an Attack");
    await heading("Add an Attack");
    const current = new Date();
    current.setDate(current.getDate() - 2);
    const d = (await import("../src/core")).dateKey(current);
    const next = (await import("../src/core")).shiftDate(d, 1);
    fill("Start date and time", d + "T23:00");
    fireEvent.click(getByLabelText(body(), "Attack is ongoing"));
    fill("End date and time", next + "T02:00");
    fill("Notes (optional)", "Fictional overnight attack");
    await click("Save attack");
    await heading("My Diary");
    nav("Overview");
    await metric("3");
    assert.equal(
      win.document.querySelectorAll(".stat strong")[1]?.textContent,
      "2",
    );
    nav("Add an Attack");
    await heading("Add an Attack");
    fill("Start date and time", d + "T23:30");
    await click("Save attack");
    await text(
      "This overlaps another recorded attack. Review the times to avoid duplicates.",
    );
    fireEvent.click(
      getByLabelText(
        body(),
        "I reviewed the overlap; save as a separate attack.",
      ),
    );
    await click("Save attack");
    await heading("My Diary");
    await click("Edit attack");
    await heading("Add an Attack");
    fill("Notes (optional)", "Edited ongoing attack");
    await click("Save attack");
    await text(
      "This overlaps another recorded attack. Review the times to avoid duplicates.",
    );
    fireEvent.click(
      getByLabelText(
        body(),
        "I reviewed the overlap; save as a separate attack.",
      ),
    );
    await click("Save attack");
    await heading("My Diary");
    await text("Edited ongoing attack");
    await click("Delete attack");
    await text("Delete this entry?");
    await click("Confirm");
    await waitFor(() =>
      assert.ok(!queryByText(body(), "Edited ongoing attack")),
    );
  });
  it("exports validated backup and rejects corrupt import without changes", async () => {
    nav("Settings & Data");
    await heading("Settings & Data");
    const { readData } = await import("../src/db");
    const original = await readData("personal");
    const f = { size: 10, text: async () => '{"app":"bad"}' };
    fireEvent.change(getByLabelText(body(), "Choose a MigraMap JSON backup"), {
      target: { files: [f] },
    });
    await waitFor(() =>
      assert.ok(body().textContent?.includes("Invalid backup")),
    );
    assert.deepEqual(await readData("personal"), original);
    const backup = {
      app: "MigraMap",
      version: 1,
      mode: "personal",
      data: original,
    };
    const valid = { size: 500, text: async () => JSON.stringify(backup) };
    fireEvent.change(getByLabelText(body(), "Choose a MigraMap JSON backup"), {
      target: { files: [valid] },
    });
    await text("Preview — nothing imported yet");
    fill("Import method", "merge");
    await click("Confirm import");
    await text("Backup imported successfully.");
    assert.deepEqual(await readData("personal"), original);
  });
  it("downloads real JSON/CSV content and invokes the printable summary", async () => {
    await click("Download JSON backup");
    const backup = JSON.parse(await downloads.at(-1)!.blob.text());
    assert.equal(backup.mode, "personal");
    assert.ok(backup.data.days.length > 0);
    await click("Export all CSV");
    assert.ok(
      (await downloads.at(-1)!.blob.text()).includes("Fictional DOM record"),
    );
    nav("My Summary");
    await heading("My Summary");
    await click("Export CSV");
    assert.ok(downloads.at(-1)!.name.endsWith(".csv"));
    await click("Print / Save as PDF");
    assert.equal(printCalls, 1);
  });
  it("keeps datasets separate when switching modes and persists after reopening storage", async () => {
    const { readData } = await import("../src/db");
    const personal = await readData("personal");
    fill("Diary mode", "demo");
    await waitFor(() =>
      assert.ok(
        Number(win.document.querySelector(".stat strong")?.textContent) > 0,
      ),
    );
    const demo = await readData("demo");
    assert.ok(demo.days.length > personal.days.length);
    fill("Diary mode", "personal");
    await metric("3");
    assert.deepEqual(await readData("personal"), personal);
  });
  it("animation pauses and restarts; reduced motion is available", async () => {
    nav("Learn About Migraine");
    await heading("Learn About Migraine");
    await click("Play");
    await waitFor(() => assert.ok(button("Pause")));
    await waitFor(() =>
      assert.ok(spoken.at(-1)?.text.includes("01 · Susceptibility")),
    );
    spoken.at(-1).onend();
    await waitFor(() =>
      assert.ok(spoken.at(-1)?.text.includes("02 · Possible triggers")),
    );
    await click("03 · Pain signalling");
    await waitFor(() =>
      assert.ok(spoken.at(-1)?.text.includes("03 · Pain signalling")),
    );
    await click("Pause");
    await waitFor(() => assert.ok(button("Play")));
    await click("04 · Record, then discuss");
    await waitFor(() =>
      assert.ok(
        win.document
          .querySelector(".animation-stage")
          ?.textContent?.includes("04 · Record, then discuss"),
      ),
    );
    await click("Restart");
    await waitFor(() =>
      assert.ok(
        win.document
          .querySelector(".animation-stage")
          ?.textContent?.includes("01 · Susceptibility"),
      ),
    );
    fireEvent.click(getByLabelText(body(), "Reduced motion: no animation"));
    await waitFor(() =>
      assert.equal((button("Play") as HTMLButtonElement).disabled, false),
    );
    await click("Play");
    await waitFor(() => assert.ok(button("Pause")));
    assert.ok(!win.document.querySelector(".animation-stage.playing"));
    await click("Pause");
    assert.ok(!body().textContent?.includes("Student Roll-On Project"));
    assert.ok(!body().textContent?.includes("Research & Expo"));
  });
  it("deletes personal data with confirmation and leaves demo intact", async () => {
    nav("Settings & Data");
    await heading("Settings & Data");
    await click("Delete all personal data");
    await text("Delete all records?");
    await click("Confirm");
    await text("Records deleted.");
    const { readData } = await import("../src/db");
    assert.deepEqual(await readData("personal"), { days: [], attacks: [] });
    assert.ok((await readData("demo")).days.length > 0);
    nav("Overview");
    await metric("0");
  });
  it("preview replacement and demo reset keep personal data empty", async () => {
    fill("Diary mode", "demo");
    await waitFor(() =>
      assert.ok(
        Number(win.document.querySelector(".stat strong")?.textContent) > 0,
      ),
    );
    nav("Settings & Data");
    await heading("Settings & Data");
    fireEvent.change(getByLabelText(body(), "Choose a MigraMap JSON backup"), {
      target: {
        files: [
          {
            size: 100,
            text: async () =>
              JSON.stringify({
                app: "MigraMap",
                version: 1,
                mode: "demo",
                data: { days: [], attacks: [] },
              }),
          },
        ],
      },
    });
    await text("Preview — nothing imported yet");
    fill("Import method", "replace");
    await click("Confirm import");
    await text("Backup imported successfully.");
    nav("Overview");
    await metric("0");
    await click("Reset demo");
    await text("Reset demo?");
    await click("Confirm");
    await waitFor(() =>
      assert.ok(
        Number(win.document.querySelector(".stat strong")?.textContent) > 0,
      ),
    );
    await click("Guided tour");
    await heading("My Headache Check-in");
    for (const name of [
      "Add an Attack",
      "My Diary",
      "Patterns",
      "My Summary",
      "My Diary",
    ]) {
      await click("Next step");
      await heading(name);
    }
    await click("Finish tour");
    const { readData } = await import("../src/db");
    assert.deepEqual(await readData("personal"), { days: [], attacks: [] });
  });
  it("saves optional episode answers, shows summary, and clears hidden episode fields", async () => {
    fill("Diary mode", "personal");
    await metric("0");
    nav("My Headache Check-in");
    await heading("My Headache Check-in");
    const group = (name: string) =>
      within(getByRole(body(), "group", { name }));
    fireEvent.click(
      group("Did you have a headache today? *").getByRole("radio", {
        name: "Yes",
      }),
    );
    fireEvent.click(getByLabelText(body(), "Exact time unknown"));
    fireEvent.click(
      group("What was the highest pain in this episode?").getByRole("radio", {
        name: "0",
      }),
    );
    fireEvent.click(getByLabelText(body(), "Nausea", { exact: true }));
    fireEvent.click(getByLabelText(body(), "None", { exact: true }));
    assert.equal(
      (getByLabelText(body(), "Nausea", { exact: true }) as HTMLInputElement)
        .checked,
      false,
    );
    fireEvent.click(
      group("Did you take medicine for the pain?").getByRole("radio", {
        name: "Yes",
      }),
    );
    fill("Medicine name (optional)", "Fictional medicine");
    fireEvent.click(getByLabelText(body(), "Bright light", { exact: true }));
    await click("Save check-in");
    await click("Prepare a summary");
    await heading("My Summary");
    assert.ok(body().textContent?.includes("Fictional medicine"));
    assert.ok(body().textContent?.includes("0 / 10"));
    const { readData } = await import("../src/db");
    let d = await readData("personal");
    assert.equal(d.days[0].checkIn?.start, null);
    assert.equal(d.days[0].checkIn?.peakPain, 0);
    assert.equal(d.attacks.length, 0);
    nav("My Diary");
    await heading("My Diary");
    await click("Edit check-in");
    await heading("My Headache Check-in");
    fireEvent.click(getByRole(body(), "button", { name: /اردو/ }));
    await waitFor(() => assert.equal(win.document.documentElement.dir, "rtl"));
    assert.ok(body().textContent?.includes("روزانہ کا پس منظر"));
    fireEvent.click(getByRole(body(), "button", { name: /English/ }));
    await heading("My Headache Check-in");
    fireEvent.click(
      group("Did you have a headache today? *").getByRole("radio", {
        name: "No",
      }),
    );
    assert.ok(!body().textContent?.includes("Medicine name (optional)"));
    await click("Save check-in");
    await click("View your diary");
    await heading("My Diary");
    d = await readData("personal");
    assert.equal(d.days[0].checkIn?.peakPain, null);
    assert.equal(d.days[0].checkIn?.medicineName, "");
    assert.deepEqual(d.days[0].checkIn?.context, ["Bright light"]);
  });
});

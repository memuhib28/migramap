import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  type Attack,
  type Data,
  type Day,
  type Mode,
  dateKey,
  dates,
  demoData,
  empty,
  shiftDate,
  zone,
} from "./core";
import { readData, writeData } from "./db";
import { LanguageContext, useT, useErrorText } from "./i18n";
import {
  Activity,
  ArrowRight,
  Card,
  Confirm,
  Field,
  icons,
  Menu,
  Modal,
  Notice,
  Plus,
  ShieldCheck,
  X,
} from "./components";
import { AttackForm } from "./forms";
import { Dashboard, Patterns, Summary } from "./insights";
import { Diary } from "./diary";
import { Learn } from "./education";
import { Settings } from "./settings";
import "./style.css";
import "./theme.css";
import { CheckInForm, BrainMark } from "./checkin";
function getPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function setPref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences are optional; diary storage errors are surfaced separately. */
  }
}
export function App() {
  const [ur, setUr] = useState(getPref("migramap-language", "en") === "ur");
  useEffect(() => {
    document.documentElement.lang = ur ? "ur" : "en";
    document.documentElement.dir = ur ? "rtl" : "ltr";
    setPref("migramap-language", ur ? "ur" : "en");
  }, [ur]);
  return (
    <LanguageContext.Provider value={ur}>
      <Shell ur={ur} setUr={setUr} />
    </LanguageContext.Provider>
  );
}
function Shell({ ur, setUr }: { ur: boolean; setUr: (v: boolean) => void }) {
  const t = useT();
  const errorText = useErrorText();
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>(
    getPref("migramap-mode", "demo") === "personal" ? "personal" : "demo",
  );
  const [page, setPage] = useState("dashboard");
  const [welcome, setWelcome] = useState(
    getPref("migramap-welcomed", "") !== "yes",
  );
  const [personalIntro, setPersonalIntro] = useState(false);
  const [data, setData] = useState<Data>(empty());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [mobile, setMobile] = useState(false);
  const [editingDay, setEditingDay] = useState<Day>();
  const [editingAttack, setEditingAttack] = useState<Attack>();
  const [newDate, setNewDate] = useState<string>();
  const [guide, setGuide] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const today = dateKey(new Date(), zone(mode));
  const [range, setRange] = useState({
    from: shiftDate(today, -27),
    to: today,
  });
  const [draftRange, setDraftRange] = useState(range);
  const [rangeError, setRangeError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    readData(mode)
      .then(async (d) => {
        await writeData(mode, d);
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorText((e as Error).message));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [mode, retry]);
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(""), 4500);
    return () => clearTimeout(id);
  }, [saved]);
  const save = async (d: Data) => {
    setSaving(true);
    try {
      await writeData(mode, d);
      setData(d);
      setSaved(
        t(
          "Changes saved on this device.",
          "تبدیلیاں اسی ڈیوائس پر محفوظ ہوگئیں۔",
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  const go = (p: string) => {
    setPage(p);
    setMobile(false);
    if (p === "day") {
      setEditingDay(undefined);
      setNewDate(undefined);
    }
    if (p === "attack") setEditingAttack(undefined);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };
  const switchMode = (next: Mode) => {
    if (
      next === "personal" &&
      getPref("migramap-personal-consent", "") !== "yes"
    ) {
      setPersonalIntro(true);
      return;
    }
    setMode(next);
    setPref("migramap-mode", next);
    setGuide(null);
    go("dashboard");
  };
  const nav: [keyof typeof icons, string, string][] = [
    ["dashboard", "Overview", "جائزہ"],
    ["day", "My Headache Check-in", "دن درج کریں"],
    ["attack", "Add an Attack", "دورہ شامل کریں"],
    ["diary", "My Diary", "آپ کی ڈائری"],
    ["patterns", "Patterns", "رجحانات"],
    ["summary", "My Summary", "معالج کا خلاصہ"],
    ["learn", "Learn About Migraine", "مائیگرین کی آگاہی"],
    ["settings", "Settings & Data", "ترتیبات اور ڈیٹا"],
  ];
  const current = nav.find((n) => n[0] === page)!;
  const props = { data, mode, ...range };
  const steps = [
    {
      page: "day",
      en: "Record a fictional headache-free day. Save it, then continue.",
      ur: "فرضی سر درد سے پاک دن درج کرکے محفوظ کریں، پھر آگے بڑھیں۔",
    },
    {
      page: "attack",
      en: "Add a fictional attack with start time and intensity.",
      ur: "وقت اور شدت کے ساتھ فرضی دورہ درج کریں۔",
    },
    {
      page: "diary",
      en: "Choose a recorded day and edit an entry.",
      ur: "درج شدہ دن منتخب کرکے اندراج میں ترمیم کریں۔",
    },
    {
      page: "patterns",
      en: "Read a chart and its denominator. A pattern is not a confirmed trigger.",
      ur: "چارٹ اور اس کی کل تعداد پڑھیں۔ رجحان تصدیق شدہ محرک نہیں۔",
    },
    {
      page: "summary",
      en: "Export a summary or open Print / Save as PDF.",
      ur: "خلاصہ برآمد کریں یا پرنٹ / PDF کھولیں۔",
    },
    {
      page: "diary",
      en: "Delete a fictional entry, then finish. Reset Demo restores the sample records.",
      ur: "فرضی اندراج حذف کریں، پھر ختم کریں۔ نمائشی ری سیٹ نمونہ ریکارڈ واپس لاتا ہے۔",
    },
  ];
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t("Skip to content", "مواد پر جائیں")}
      </a>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <span className="brand-mark">
            <BrainMark />
          </span>
          <div>
            Migra<span>Map</span>
            <small>
              {t("From Signals to Patterns", "روزانہ مشاہدات سے رجحانات تک")}
            </small>
          </div>
          <button
            className="mobile-only icon-button"
            aria-label={t("Close navigation", "راستے بند کریں")}
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <span className="nav-label">
          {t("YOUR EVERYDAY COMPANION", "آپ کا روزمرہ ساتھی")}
        </span>
        <nav aria-label={t("Main navigation", "مرکزی راستے")}>
          {nav.map(([id, en, u], i) => {
            const Icon = icons[id];
            return (
              <React.Fragment key={id}>
                {i === 6 && (
                  <span className="nav-label section-label">
                    {t("LEARN & EXPLORE", "جانیں اور دریافت کریں")}
                  </span>
                )}
                <button
                  className={page === id ? "active" : ""}
                  aria-current={page === id ? "page" : undefined}
                  onClick={() => go(id)}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  <span>{t(en, u)}</span>
                  {page === id && <i />}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck size={20} />
          <b>{t("Local. Personal. Yours.", "مقامی۔ ذاتی۔ آپ کا۔")}</b>
          <p>
            {t(
              "Your diary stays in this browser.",
              "آپ کی ڈائری اسی براؤزر میں رہتی ہے۔",
            )}
          </p>
          <button className="text-button" onClick={() => go("settings")}>
            {t("Manage your data", "اپنا ڈیٹا سنبھالیں")}
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label={t("Close navigation", "راستے بند کریں")}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-button mobile-only"
              aria-label={t("Open navigation", "راستے کھولیں")}
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              {t("Your wellbeing journal", "آپ کی کیفیت کی ڈائری")}
              <span>/</span>
              <b>{t(current[1], current[2])}</b>
            </span>
          </div>
          <div className="row">
            <button className="language-button" onClick={() => setUr(!ur)}>
              {ur ? "English" : "اردو"} <span>◎</span>
            </button>
            <label className="mode-label">
              <span className="sr-only">{t("Diary mode", "ڈائری موڈ")}</span>
              <select
                aria-label={t("Diary mode", "ڈائری موڈ")}
                disabled={loading || saving}
                value={mode}
                onChange={(e) => switchMode(e.target.value as Mode)}
              >
                <option value="demo">{t("Expo Demo", "نمائشی موڈ")}</option>
                <option value="personal">
                  {t("Personal Diary", "ذاتی ڈائری")}
                </option>
              </select>
            </label>
          </div>
        </header>
        {mode === "demo" && (
          <div className="demo-banner">
            <span>
              <i /> {t("Fictional demo data", "فرضی نمائشی ڈیٹا")}
              <span className="desktop-only">
                {" "}
                ·{" "}
                {t(
                  "Explore freely. Personal records are kept separate.",
                  "آزادانہ دیکھیں۔ ذاتی اندراجات الگ ہیں۔",
                )}
              </span>
            </span>
            <div className="row">
              <button
                onClick={() => {
                  setGuide(0);
                  go(steps[0].page);
                }}
              >
                {t("Guided tour", "رہنمائی")}
              </button>
              <button
                onClick={() =>
                  setConfirm({
                    title: t("Reset demo?", "نمائشی ڈیٹا ری سیٹ کریں؟"),
                    body: t(
                      "Replace all demo edits with fictional sample records. Your personal diary is unaffected.",
                      "تمام نمائشی تبدیلیاں فرضی نمونوں سے بدل جائیں گی۔ ذاتی ڈائری متاثر نہیں ہوگی۔",
                    ),
                    action: () => save(demoData()),
                  })
                }
              >
                {t("Reset demo", "نمائشی ری سیٹ")}
              </button>
            </div>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {t("MIGRAMAP / YOUR DIARY", "مائیگرا میپ / آپ کی ڈائری")}
              </span>
              <h1>
                {page === "dashboard"
                  ? t(
                      "A clearer picture of your days",
                      "آپ کے دنوں کی واضح تصویر",
                    )
                  : t(current[1], current[2])}
              </h1>
              <p>
                {page === "dashboard"
                  ? t(
                      "Track your days. Understand your patterns.",
                      "اپنے دن درج کریں۔ اپنے رجحانات سمجھیں۔",
                    )
                  : t(
                      "A thoughtful record, one observation at a time.",
                      "سوچ سمجھ کر کیا گیا ریکارڈ، ایک وقت میں ایک مشاہدہ۔",
                    )}
              </p>
            </div>
            {page === "dashboard" && (
              <button onClick={() => go("attack")}>
                <Plus size={17} />
                {t("Add an attack", "دورہ شامل کریں")}
              </button>
            )}
          </div>
          {guide !== null && (
            <Notice>
              <div className="row between wrap">
                <div>
                  <b>
                    {t("Expo walkthrough", "نمائش کی رہنمائی")} · {guide + 1}/6
                  </b>
                  <p>{t(steps[guide].en, steps[guide].ur)}</p>
                </div>
                <div className="row">
                  <button
                    onClick={() => {
                      if (guide === 5) setGuide(null);
                      else {
                        setGuide(guide + 1);
                        go(steps[guide + 1].page);
                      }
                    }}
                  >
                    {guide === 5
                      ? t("Finish tour", "رہنمائی ختم")
                      : t("Next step", "اگلا مرحلہ")}
                  </button>
                  <button onClick={() => setGuide(null)}>
                    {t("Close tour", "رہنمائی بند")}
                  </button>
                </div>
              </div>
            </Notice>
          )}
          {["dashboard", "diary", "patterns", "summary"].includes(page) && (
            <form
              className="date-filter no-print"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  dates(draftRange.from, draftRange.to);
                  if (draftRange.to > today)
                    throw Error(
                      t(
                        "End date cannot be in the future.",
                        "اختتامی تاریخ مستقبل میں نہیں ہوسکتی۔",
                      ),
                    );
                  setRange(draftRange);
                  setRangeError("");
                } catch (e) {
                  setRangeError(errorText((e as Error).message));
                }
              }}
            >
              <div className="row wrap">
                <Field label={t("From", "سے")}>
                  <input
                    aria-label={t("From", "سے")}
                    required
                    type="date"
                    max={today}
                    value={draftRange.from}
                    onChange={(e) =>
                      setDraftRange({ ...draftRange, from: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("To", "تک")}>
                  <input
                    aria-label={t("To", "تک")}
                    required
                    type="date"
                    max={today}
                    value={draftRange.to}
                    onChange={(e) =>
                      setDraftRange({ ...draftRange, to: e.target.value })
                    }
                  />
                </Field>
                <button>{t("Apply range", "مدت لاگو کریں")}</button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    const r = { from: shiftDate(today, -27), to: today };
                    setRange(r);
                    setDraftRange(r);
                    setRangeError("");
                  }}
                >
                  {t("Last 28 days", "گزشتہ 28 دن")}
                </button>
              </div>
              <span className="small muted">{zone(mode)}</span>
              {rangeError && <p role="alert">{rangeError}</p>}
            </form>
          )}
          {saved && (
            <div className="toast" role="status">
              ✓ {saved}
            </div>
          )}
          {loading ? (
            <Card>
              <p role="status">
                {t(
                  "Opening your local diary…",
                  "آپ کی مقامی ڈائری کھل رہی ہے…",
                )}
              </p>
            </Card>
          ) : error ? (
            <Notice kind="error">
              <p role="alert">{error}</p>
              <button onClick={() => setRetry(retry + 1)}>
                {t("Retry storage", "ذخیرہ دوبارہ کھولیں")}
              </button>
            </Notice>
          ) : (
            <>
              {page === "dashboard" && <Dashboard {...props} go={go} />}{" "}
              {page === "day" && (
                <CheckInForm
                  key={editingDay?.id ?? newDate ?? "new-day"}
                  data={data}
                  mode={mode}
                  entry={editingDay}
                  date={newDate}
                  onSummary={() => go("summary")}
                  onSave={save}
                  onDone={() => go("diary")}
                />
              )}{" "}
              {page === "attack" && (
                <AttackForm
                  key={editingAttack?.id ?? "new-attack"}
                  data={data}
                  mode={mode}
                  entry={editingAttack}
                  onSave={save}
                  onDone={() => go("diary")}
                />
              )}{" "}
              {page === "diary" && (
                <Diary
                  {...props}
                  onEditDay={(d) => {
                    setEditingDay(d);
                    setPage("day");
                  }}
                  onEditAttack={(a) => {
                    setEditingAttack(a);
                    setPage("attack");
                  }}
                  onNewDay={(date) => {
                    setEditingDay(undefined);
                    setNewDate(date);
                    setPage("day");
                  }}
                  onDelete={(kind, id) =>
                    setConfirm({
                      title: t("Delete this entry?", "یہ اندراج حذف کریں؟"),
                      body: t(
                        "This entry will be removed from the current mode. This cannot be undone without a backup.",
                        "یہ اندراج موجودہ موڈ سے حذف ہوگا۔ بیک اپ کے بغیر واپس نہیں ہوسکتا۔",
                      ),
                      action: () =>
                        save({
                          ...data,
                          [kind]: data[kind].filter((d) => d.id !== id),
                        }),
                    })
                  }
                />
              )}{" "}
              {page === "patterns" && <Patterns {...props} />}{" "}
              {page === "summary" && <Summary {...props} />}{" "}
              {page === "learn" && <Learn />}
              {page === "settings" && (
                <Settings
                  key={mode}
                  data={data}
                  mode={mode}
                  save={save}
                  restart={() => setWelcome(true)}
                />
              )}
            </>
          )}
          <footer>
            {t(
              "Made for understanding. Designed with care.",
              "سمجھنے کے لیے بنایا گیا۔ احتیاط سے ترتیب دیا گیا۔",
            )}
            <span>
              {t(
                "Student prototype · Not a diagnostic tool",
                "طالب علمی نمونہ · تشخیص کا آلہ نہیں",
              )}
            </span>
          </footer>
        </main>
      </div>
      <nav
        className="bottom-nav"
        aria-label={t("Quick navigation", "فوری راستے")}
      >
        {(["dashboard", "day", "diary", "patterns"] as const).map((id) => {
          const n = nav.find((n) => n[0] === id)!;
          const Icon = icons[id];
          return (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={21} />
              <span>
                {id === "day"
                  ? t("Check-in", "اندراج")
                  : id === "diary"
                    ? t("Diary", "ڈائری")
                    : t(n[1], n[2])}
              </span>
            </button>
          );
        })}
        <button onClick={() => setMobile(true)}>
          <Menu size={21} />
          <span>{t("More", "مزید")}</span>
        </button>
      </nav>
      {welcome && (
        <Modal
          title={t("Welcome to MigraMap", "مائیگرا میپ میں خوش آمدید")}
          onClose={() => {
            setWelcome(false);
            setPref("migramap-welcomed", "yes");
          }}
        >
          <div className="welcome-mark">
            <Activity size={40} />
          </div>
          <h3>
            {t(
              "Track your days. Understand your patterns.",
              "اپنے دن درج کریں۔ اپنے رجحانات سمجھیں۔",
            )}
          </h3>
          <p>
            {t(
              "A local-first diary and education prototype for a student research expo. It supports a conversation with a healthcare professional; it does not diagnose, prescribe, confirm triggers or promise symptom relief.",
              "طالب علمی نمائش کے لیے مقامی ڈائری اور تعلیمی نمونہ۔ ماہر صحت سے گفتگو میں مدد دیتا ہے؛ تشخیص، نسخہ، محرک کی تصدیق یا آرام کا وعدہ نہیں کرتا۔",
            )}
          </p>
          <Notice>
            {t(
              "Stored only in this browser; clearing storage can erase records. Export backups. Not a secure clinical record system. Use fictional data for the expo.",
              "صرف اسی براؤزر میں محفوظ؛ ذخیرہ صاف کرنے سے اندراجات مٹ سکتے ہیں۔ بیک اپ برآمد کریں۔ محفوظ طبی ریکارڈ کا نظام نہیں۔ نمائش میں فرضی ڈیٹا استعمال کریں۔",
            )}
          </Notice>
          <div className="welcome-actions">
            <button
              className="primary"
              onClick={() => {
                setWelcome(false);
                setPref("migramap-welcomed", "yes");
                switchMode("demo");
              }}
            >
              {t("Explore Expo Demo", "نمائشی موڈ دیکھیں")}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => {
                setWelcome(false);
                setPref("migramap-welcomed", "yes");
                switchMode("personal");
              }}
            >
              {t("Open Personal Diary", "ذاتی ڈائری کھولیں")}
            </button>
          </div>
          <button className="text-button" onClick={() => setUr(!ur)}>
            {ur ? "Read in English" : "اردو میں پڑھیں"}
          </button>
        </Modal>
      )}
      {personalIntro && (
        <Modal
          title={t(
            "Before your first personal entry",
            "پہلے ذاتی اندراج سے قبل",
          )}
          onClose={() => setPersonalIntro(false)}
        >
          <p>
            {t(
              "Your personal diary starts empty and is completely separate from the fictional expo dataset. No identifying details are required.",
              "آپ کی ذاتی ڈائری خالی شروع ہوتی ہے اور فرضی نمائش سے الگ ہے۔ شناختی تفصیلات ضروری نہیں۔",
            )}
          </p>
          <p>
            {t(
              "Records stay in this browser on this device. They can be lost if browser storage is cleared, and are not encrypted by this app. This is not cross-device backup or a secure clinical record system. Export and delete controls are in Settings & Data.",
              "اندراجات اسی ڈیوائس کے اسی براؤزر میں رہتے ہیں۔ براؤزر کا ذخیرہ صاف ہو تو ضائع ہوسکتے ہیں اور ایپ انہیں خفیہ نہیں کرتی۔ مختلف ڈیوائسز کا بیک اپ یا محفوظ طبی ریکارڈ کا نظام نہیں۔ برآمد اور حذف کے اختیارات ترتیبات اور ڈیٹا میں ہیں۔",
            )}
          </p>
          <p>
            {t(
              "This student prototype does not diagnose or recommend treatment. Do not enter real patient data for the expo.",
              "یہ طالب علمی نمونہ تشخیص یا علاج تجویز نہیں کرتا۔ نمائش میں حقیقی مریضوں کا ڈیٹا درج نہ کریں۔",
            )}
          </p>
          <button
            className="primary"
            onClick={() => {
              setPref("migramap-personal-consent", "yes");
              setPersonalIntro(false);
              setMode("personal");
              setPref("migramap-mode", "personal");
              setGuide(null);
              go("dashboard");
            }}
          >
            {t(
              "I understand — open diary",
              "میں سمجھتا/سمجھتی ہوں — ڈائری کھولیں",
            )}
          </button>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={confirm.title}
          body={confirm.body}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>MigraMap</h1>
        <p>
          The page could not be displayed. Your saved diary has not been
          deleted. Reload to retry.
        </p>
        <button onClick={() => location.reload()}>
          Reload / دوبارہ کھولیں
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

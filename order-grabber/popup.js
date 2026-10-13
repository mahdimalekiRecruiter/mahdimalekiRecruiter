const SITE = "https://hamyar.sepahanbattery.com/";
const fields = ["enabled", "claimTexts", "claimSelector", "confirmTexts", "reloadSeconds", "maxClaims", "sound"];
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

function setStatus(text) {
  statusEl.textContent = text;
}

async function siteTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.startsWith(SITE)) return tab;
  const [other] = await chrome.tabs.query({ url: SITE + "*" });
  return other || null;
}

function renderLog(log) {
  logEl.innerHTML = "";
  if (!log.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "هنوز سفارشی گرفته نشده.";
    logEl.appendChild(li);
    return;
  }
  for (const item of log) {
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = new Date(item.at).toLocaleTimeString("fa-IR");
    const text = document.createElement("p");
    text.textContent = item.summary || "—";
    li.append(time, text);
    logEl.appendChild(li);
  }
}

async function load() {
  const stored = await chrome.storage.local.get({ ...DEFAULT_SETTINGS, log: [] });
  for (const key of fields) {
    const el = document.getElementById(key);
    if (el.type === "checkbox") el.checked = stored[key];
    else el.value = stored[key];
  }
  renderLog(stored.log);
  const tab = await siteTab();
  setStatus(tab ? "صفحهٔ همیار باز است." : "⚠️ اول سایت همیار را در یک تب باز کنید و وارد شوید.");
}

for (const key of fields) {
  const el = document.getElementById(key);
  el.addEventListener("change", () => {
    let value = el.type === "checkbox" ? el.checked : el.value;
    if (el.type === "number") value = Math.max(0, Number(value) || 0);
    chrome.storage.local.set({ [key]: value });
  });
}

document.getElementById("pickBtn").addEventListener("click", async () => {
  const tab = await siteTab();
  if (!tab) return setStatus("⚠️ تب سایت همیار پیدا نشد.");
  await chrome.tabs.update(tab.id, { active: true });
  chrome.tabs.sendMessage(tab.id, { type: "startPicker" });
  window.close();
});

document.getElementById("testBtn").addEventListener("click", async () => {
  const tab = await siteTab();
  if (!tab) return setStatus("⚠️ تب سایت همیار پیدا نشد.");
  try {
    const { count } = await chrome.tabs.sendMessage(tab.id, { type: "countMatches" });
    setStatus(count ? `✅ ${count} دکمهٔ قبول سفارش در صفحه پیدا شد.` : "هیچ دکمه‌ای پیدا نشد (شاید الان سفارشی نیست).");
  } catch {
    setStatus("⚠️ صفحهٔ همیار را یک‌بار رفرش کنید.");
  }
});

document.getElementById("clearLog").addEventListener("click", async () => {
  await chrome.storage.local.set({ log: [] });
  chrome.action.setBadgeText({ text: "" });
  renderLog([]);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.log) renderLog(changes.log.newValue || []);
});

load();

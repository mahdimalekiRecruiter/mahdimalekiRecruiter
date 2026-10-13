// Watches the Hamyar orders page and clicks the "accept order" button as soon as it appears.

const SCAN_INTERVAL_MS = 300;
const CONFIRM_WINDOW_MS = 4000;
const DIALOG_SELECTOR = [
  "[role=dialog]",
  "[role=alertdialog]",
  ".modal",
  ".swal2-popup",
  ".v-dialog",
  ".el-message-box",
  ".el-dialog",
  ".ant-modal",
  ".mat-dialog-container",
  ".mdc-dialog",
  ".q-dialog"
].join(",");
const CLICKABLE_SELECTOR = "button, a, [role=button], input[type=button], input[type=submit], .btn";

let settings = { ...DEFAULT_SETTINGS };
let clicked = new WeakSet();
let lastClaimAt = 0;
let claimsThisSession = 0;
let reloadTimer = null;
let pickerActive = false;

function splitTexts(value) {
  return (value || "")
    .split(/[,،\n]/)
    .map((t) => normalize(t))
    .filter(Boolean);
}

function normalize(text) {
  return (text || "")
    .replace(/‌/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function labelOf(el) {
  return normalize(el.value !== undefined && el.tagName === "INPUT" ? el.value : el.innerText || el.textContent);
}

function isUsable(el) {
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none";
}

function findByTexts(root, texts) {
  if (!texts.length) return [];
  return [...root.querySelectorAll(CLICKABLE_SELECTOR)].filter((el) => texts.includes(labelOf(el)));
}

function findClaimButtons() {
  let candidates;
  if (settings.claimSelector) {
    try {
      candidates = [...document.querySelectorAll(settings.claimSelector)];
    } catch {
      candidates = [];
    }
  } else {
    candidates = findByTexts(document, splitTexts(settings.claimTexts));
  }
  return candidates.filter((el) => !clicked.has(el) && isUsable(el));
}

function describeOrder(button) {
  // Walk up to the nearest container that looks like an order card / table row.
  let node = button;
  for (let i = 0; i < 8 && node.parentElement; i++) {
    node = node.parentElement;
    const text = normalize(node.innerText);
    if (node.tagName === "TR" || text.length > 40) {
      return text.slice(0, 200);
    }
  }
  return normalize(node.innerText).slice(0, 200);
}

function realClick(el) {
  el.scrollIntoView({ block: "center" });
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  el.click();
}

function clickConfirmDialogs() {
  if (Date.now() - lastClaimAt > CONFIRM_WINDOW_MS) return;
  const texts = splitTexts(settings.confirmTexts);
  for (const dialog of document.querySelectorAll(DIALOG_SELECTOR)) {
    for (const btn of findByTexts(dialog, texts)) {
      if (!clicked.has(btn) && isUsable(btn)) {
        clicked.add(btn);
        realClick(btn);
      }
    }
  }
}

function beep() {
  if (!settings.sound) return;
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.25;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
  } catch {
    // Audio may be blocked until the user interacts with the page; the notification still fires.
  }
}

function scan() {
  if (!settings.enabled || pickerActive) return;
  clickConfirmDialogs();

  if (settings.maxClaims && claimsThisSession >= settings.maxClaims) return;
  const buttons = findClaimButtons();
  if (!buttons.length) return;

  const button = buttons[0];
  clicked.add(button);
  const summary = describeOrder(button);
  realClick(button);
  lastClaimAt = Date.now();
  claimsThisSession++;
  beep();
  chrome.runtime.sendMessage({ type: "claimed", summary, url: location.href });
}

function scheduleReload() {
  clearInterval(reloadTimer);
  reloadTimer = null;
  if (!settings.enabled || !settings.reloadSeconds) return;
  reloadTimer = setInterval(() => {
    const busy = Date.now() - lastClaimAt < CONFIRM_WINDOW_MS + 2000;
    const dialogOpen = document.querySelector(DIALOG_SELECTOR);
    if (!busy && !dialogOpen && !pickerActive) location.reload();
  }, settings.reloadSeconds * 1000);
}

// --- Element picker: lets the user click the real "accept" button once to record its selector.

function cssPath(el) {
  if (el.id && !/\d{3,}/.test(el.id)) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let node = el;
  while (node && node !== document.body && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    const classes = [...node.classList].filter((c) => !/^(ng-|v-|is-|active|hover|focus)|\d{3,}/.test(c)).slice(0, 3);
    if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");
    parts.unshift(part);
    if (document.querySelectorAll(parts.join(" > ")).length <= 1 && parts.length > 1) break;
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function startPicker() {
  pickerActive = true;
  const outline = document.createElement("div");
  outline.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #ffc400;background:rgba(255,196,0,.15);transition:all .05s";
  const tip = document.createElement("div");
  tip.textContent = "روی دکمهٔ «قبول سفارش» کلیک کنید (Esc برای لغو)";
  tip.style.cssText =
    "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1e1e26;color:#fff;padding:8px 14px;border-radius:8px;font:14px Tahoma,sans-serif";
  document.body.append(outline, tip);

  const target = (e) => e.target.closest(CLICKABLE_SELECTOR) || e.target;
  const onMove = (e) => {
    const r = target(e).getBoundingClientRect();
    Object.assign(outline.style, { top: r.top + "px", left: r.left + "px", width: r.width + "px", height: r.height + "px" });
  };
  const stop = () => {
    pickerActive = false;
    outline.remove();
    tip.remove();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
  };
  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = target(e);
    const label = labelOf(el);
    // Prefer matching by the button's label (robust across rows); keep the CSS path as a fallback.
    const update = label && label.length <= 30
      ? { claimTexts: label, claimSelector: "" }
      : { claimSelector: cssPath(el) };
    chrome.storage.local.set(update);
    stop();
    alert(`ذخیره شد: ${update.claimTexts || update.claimSelector}`);
  };
  const onKey = (e) => {
    if (e.key === "Escape") stop();
  };
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "startPicker") {
    startPicker();
  } else if (msg.type === "countMatches") {
    sendResponse({ count: findClaimButtons().length });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (changes[key]) settings[key] = changes[key].newValue;
  }
  if (changes.enabled || changes.reloadSeconds) scheduleReload();
});

chrome.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
  settings = stored;
  scheduleReload();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, SCAN_INTERVAL_MS);
  scan();
});

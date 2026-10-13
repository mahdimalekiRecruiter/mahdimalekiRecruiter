chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "claimed") return;

  chrome.storage.local.get({ log: [] }).then(({ log }) => {
    log.unshift({ summary: msg.summary, url: msg.url, at: Date.now() });
    chrome.storage.local.set({ log: log.slice(0, 30) });
    chrome.action.setBadgeText({ text: String(log.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
  });

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "سفارش جدید گرفته شد ✅",
    message: msg.summary || "یک سفارش قبول شد.",
    priority: 2,
    requireInteraction: true
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) {
    chrome.action.setBadgeText({ text: changes.enabled.newValue ? "ON" : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#2e7d32" });
  }
});

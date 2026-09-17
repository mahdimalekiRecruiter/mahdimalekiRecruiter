const MENU_SELECTION = "save-selection-to-notes";
const MENU_LINK = "save-link-to-notes";
const MENU_PAGE = "save-page-to-notes";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_SELECTION,
    title: 'Save "%s" to Quick Notes',
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: MENU_LINK,
    title: "Save link to Quick Notes",
    contexts: ["link"]
  });
  chrome.contextMenus.create({
    id: MENU_PAGE,
    title: "Save page URL to Quick Notes",
    contexts: ["page"]
  });
});

async function addNote(text, source) {
  const { notes = [] } = await chrome.storage.local.get("notes");
  notes.unshift({
    id: crypto.randomUUID(),
    text,
    source: source || null,
    createdAt: Date.now()
  });
  await chrome.storage.local.set({ notes });
  chrome.action.setBadgeText({ text: String(notes.length) });
  chrome.action.setBadgeBackgroundColor({ color: "#ffc400" });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const source = tab ? { title: tab.title, url: tab.url } : null;

  if (info.menuItemId === MENU_SELECTION && info.selectionText) {
    addNote(info.selectionText.trim(), source);
  } else if (info.menuItemId === MENU_LINK && info.linkUrl) {
    addNote(info.linkUrl, source);
  } else if (info.menuItemId === MENU_PAGE && tab && tab.url) {
    addNote(tab.url, { title: tab.title, url: tab.url });
  }
});

chrome.storage.local.get("notes").then(({ notes = [] }) => {
  if (notes.length) {
    chrome.action.setBadgeText({ text: String(notes.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#ffc400" });
  }
});

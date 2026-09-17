# Quick Notes & Clip

A minimal Chrome extension (Manifest V3, no build step) for jotting quick
notes and saving selected text, links, or page URLs while you browse.
Everything is stored locally via `chrome.storage.local`.

## Features

- Popup with a textarea for freeform notes (`Ctrl/Cmd+Enter` to save).
- "Grab selection" button pulls the current page's selected text into a note.
- Right-click context menu on any page to save selected text, a link, or the
  page URL straight to your notes.
- Notes list with source link, relative timestamp, and per-note delete.
- Toolbar badge shows the total note count.
- Keyboard shortcut (`Ctrl+Shift+N` / `Cmd+Shift+N`) to open the popup.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this project folder.
4. Pin the extension from the toolbar puzzle-piece icon for quick access.

## Project structure

```
manifest.json     Manifest V3 config, permissions, commands
background.js     Service worker: context menus, badge count
popup.html/.css/.js  Popup UI: add/list/delete notes
icons/            16/48/128px toolbar & store icons
```

## Notes

- Storage is local to the browser profile (not synced across devices). Swap
  `chrome.storage.local` for `chrome.storage.sync` if you want notes to
  follow you across signed-in Chrome instances (sync has tighter size quotas).
- No external network requests or third-party libraries are used.

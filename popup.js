const noteInput = document.getElementById("noteInput");
const addForm = document.getElementById("addForm");
const notesList = document.getElementById("notesList");
const emptyState = document.getElementById("emptyState");
const clearAllBtn = document.getElementById("clearAll");
const saveSelectionBtn = document.getElementById("saveSelectionBtn");

async function getNotes() {
  const { notes = [] } = await chrome.storage.local.get("notes");
  return notes;
}

async function setNotes(notes) {
  await chrome.storage.local.set({ notes });
  chrome.action.setBadgeText({ text: notes.length ? String(notes.length) : "" });
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function render(notes) {
  notesList.innerHTML = "";
  const hasNotes = notes.length > 0;
  emptyState.classList.toggle("hidden", hasNotes);
  notesList.classList.toggle("hidden", !hasNotes);

  for (const note of notes) {
    const li = document.createElement("li");
    li.className = "note";

    const textEl = document.createElement("p");
    textEl.className = "note-text";
    textEl.textContent = note.text;
    li.appendChild(textEl);

    const meta = document.createElement("div");
    meta.className = "note-meta";

    const sourceEl = document.createElement("span");
    sourceEl.className = "note-source";
    if (note.source && note.source.url) {
      const link = document.createElement("a");
      link.href = note.source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = hostname(note.source.url);
      sourceEl.appendChild(link);
    } else {
      sourceEl.textContent = formatTime(note.createdAt);
    }
    meta.appendChild(sourceEl);

    const right = document.createElement("span");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    if (note.source && note.source.url) {
      const timeEl = document.createElement("span");
      timeEl.textContent = formatTime(note.createdAt);
      right.appendChild(timeEl);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteNote(note.id));
    right.appendChild(deleteBtn);

    meta.appendChild(right);
    li.appendChild(meta);
    notesList.appendChild(li);
  }
}

async function refresh() {
  const notes = await getNotes();
  render(notes);
}

async function addNote(text, source) {
  if (!text || !text.trim()) return;
  const notes = await getNotes();
  notes.unshift({
    id: crypto.randomUUID(),
    text: text.trim(),
    source: source || null,
    createdAt: Date.now()
  });
  await setNotes(notes);
  render(notes);
}

async function deleteNote(id) {
  const notes = (await getNotes()).filter((n) => n.id !== id);
  await setNotes(notes);
  render(notes);
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addNote(noteInput.value);
  noteInput.value = "";
  noteInput.focus();
});

noteInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    addForm.requestSubmit();
  }
});

saveSelectionBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    const [{ result: selection } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    if (selection && selection.trim()) {
      await addNote(selection, { title: tab.title, url: tab.url });
    } else {
      noteInput.placeholder = "No text selected on the page — try selecting some text first.";
    }
  } catch {
    noteInput.placeholder = "Can't read this page (restricted). Try a regular webpage.";
  }
});

clearAllBtn.addEventListener("click", async () => {
  if (!(await getNotes()).length) return;
  if (confirm("Delete all saved notes? This can't be undone.")) {
    await setNotes([]);
    render([]);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.notes) {
    render(changes.notes.newValue || []);
  }
});

refresh();
noteInput.focus();

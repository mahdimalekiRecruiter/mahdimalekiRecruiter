// Shared default settings (loaded by content.js via manifest order and by popup.html).
const DEFAULT_SETTINGS = {
  enabled: false,
  // CSS selector of the "accept order" button, recorded with the picker. Empty = match by text.
  claimSelector: "",
  // Button labels that mean "accept this order" (exact match after trimming).
  claimTexts: "قبول سفارش, پذیرش سفارش, دریافت سفارش, قبول, پذیرش",
  // Labels of the confirm button in a popup dialog that may appear after accepting.
  confirmTexts: "بله, تایید, تأیید, قبول, ثبت",
  // Reload the page every N seconds so new orders show up (0 = never).
  reloadSeconds: 20,
  // Stop after this many claims per session (0 = unlimited).
  maxClaims: 0,
  sound: true
};

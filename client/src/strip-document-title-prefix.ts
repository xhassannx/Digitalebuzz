/**
 * Removes the leading "WhatsApp - " segment from the browser tab title.
 * Chrome may prepend the web app manifest `name` (e.g. "WhatsApp") plus " - " to `document.title`.
 */
const PREFIX = "WhatsApp - ";

function strip() {
  const t = document.title;
  if (t.startsWith(PREFIX)) {
    document.title = t.slice(PREFIX.length);
  }
}

let titleObserver: MutationObserver | null = null;

function observeCurrentTitle() {
  const el = document.querySelector("title");
  if (!el) return;
  titleObserver?.disconnect();
  titleObserver = new MutationObserver(strip);
  titleObserver.observe(el, { childList: true, subtree: true, characterData: true });
  strip();
}

export function initStripWhatsAppDocumentTitlePrefix() {
  observeCurrentTitle();

  const headMo = new MutationObserver(() => {
    observeCurrentTitle();
  });
  headMo.observe(document.head, { childList: true, subtree: false });

  queueMicrotask(strip);
  setTimeout(strip, 0);
  window.addEventListener("load", strip, { once: true });
}

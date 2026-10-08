/**
 * Replaces legacy PWA/install copy if it appears in the DOM (e.g. late-rendered UI).
 * The address-bar “Install …” tooltip comes from manifest `name` — see public/manifest.json.
 */
const FROM = "Install Helicoptic WhatsApp";
const TO = "Install Whatsapp ";

const ATTR_NAMES = ["title", "aria-label", "placeholder", "alt", "data-tooltip"] as const;

function replaceInTextNode(node: Text) {
  const t = node.textContent;
  if (t && t.includes(FROM)) {
    node.textContent = t.split(FROM).join(TO);
  }
}

function replaceInElementAttrs(el: Element) {
  for (const attr of ATTR_NAMES) {
    const v = el.getAttribute(attr);
    if (v && v.includes(FROM)) {
      el.setAttribute(attr, v.split(FROM).join(TO));
    }
  }
}

function walkTexts(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    replaceInTextNode(n as Text);
  }
}

function walkAttrs(root: Node) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    replaceInElementAttrs(root as Element);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  let el: Node | null;
  while ((el = walker.nextNode())) {
    replaceInElementAttrs(el as Element);
  }
}

function run() {
  if (!document.body) return;
  walkTexts(document.body);
  walkAttrs(document.body);
}

function startObserver() {
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes" && r.target.nodeType === Node.ELEMENT_NODE) {
        replaceInElementAttrs(r.target as Element);
        continue;
      }
      if (r.type === "characterData" && r.target.nodeType === Node.TEXT_NODE) {
        replaceInTextNode(r.target as Text);
        continue;
      }
      for (const node of r.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          replaceInTextNode(node as Text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walkTexts(node);
          walkAttrs(node);
        }
      }
    }
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTR_NAMES],
  });
}

export function initInstallLabelReplace() {
  run();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  }
  startObserver();
}

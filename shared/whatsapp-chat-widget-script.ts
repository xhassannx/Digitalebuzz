import { mergeWhatsAppChatWidgetConfig, type WhatsAppChatWidgetConfig } from "./whatsapp-chat-widget";

/** Client-side loader script served at /api/public/whatsapp-chat-widget/:id.js */
export function buildWhatsAppWidgetLoaderScript(
  config: WhatsAppChatWidgetConfig,
  baseUrl: string,
): string {
  const cfg = mergeWhatsAppChatWidgetConfig(config);
  const payload = JSON.stringify(cfg);
  const origin = baseUrl.replace(/\/+$/, "");
  return `(function(){
  if (window.__helicopticWaWidgetLoaded) return;
  window.__helicopticWaWidgetLoaded = true;
  var ORIGIN = ${JSON.stringify(origin)};
  var CFG = ${payload};
  if (!CFG.enabled) return;
  var phone = (CFG.phoneNumber || "").replace(/\\D/g, "");
  if (!phone) return;
  var chatMode = (CFG.panel && CFG.panel.chatMode) || "live";
  var storageKey = "helicoptic_wa_chat_" + (CFG.widgetPublicId || "default");
  var teaserDismissKey = "helicoptic_wa_teaser_" + (CFG.widgetPublicId || "default");

  function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }
  function buildMessage() {
    var msg = (CFG.panel && CFG.panel.defaultMessage) || (CFG.button && CFG.button.defaultMessage) || "";
    if (CFG.urlPersonalization && window.location && window.location.href) {
      msg = (msg ? msg + "\\n\\n" : "") + "Page: " + window.location.href;
    }
    return msg;
  }
  function waUrl() {
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(buildMessage());
  }
  function api(path, opts) {
    return fetch(ORIGIN + path, Object.assign({ headers: { "Content-Type": "application/json" } }, opts || {}))
      .then(function(r) { return r.json().then(function(d) { if (!r.ok) throw new Error(d.message || "Request failed"); return d; }); });
  }

  var root = document.createElement("div");
  root.id = "helicoptic-wa-widget-root";
  var pos = (CFG.button && CFG.button.position) === "bottom-left" ? "left" : "right";
  var mb = Number(CFG.button && CFG.button.marginBottom) || 20;
  var ml = Number(CFG.button && CFG.button.marginLeft) || 20;
  var mr = Number(CFG.button && CFG.button.marginRight) || 20;
  root.style.cssText = "position:fixed;bottom:0;" + pos + ":0;z-index:2147483646;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin-bottom:" + mb + "px;margin-" + pos + ":" + (pos === "left" ? ml : mr) + "px;";

  var btn = document.createElement("button");
  btn.type = "button";
  var br = Number(CFG.button && CFG.button.borderRadius); if (!br && br !== 0) br = 24;
  btn.style.cssText = "display:flex;align-items:center;gap:10px;border:none;cursor:pointer;padding:16px 24px;color:#fff;font-size:17px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.22);background:" + ((CFG.button && CFG.button.backgroundColor) || "#25D366") + ";border-radius:" + br + "px;";
  btn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg><span>' + esc((CFG.button && CFG.button.ctaText) || "Chat with us") + '</span>';

  var brandColor = (CFG.panel && CFG.panel.brandColor) || "#075E54";
  var teaserText = esc((CFG.panel && CFG.panel.teaserMessage) || (CFG.panel && CFG.panel.welcomeMessage) || "Hi! How can we help you today?");
  var teaserBrandInitial = esc(((CFG.panel && CFG.panel.brandName) || "S").charAt(0).toUpperCase());
  var teaserAvatarHtml = (CFG.panel && CFG.panel.brandImageUrl)
    ? '<img src="' + esc(CFG.panel.brandImageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
    : teaserBrandInitial;

  var teaser = document.createElement("div");
  teaser.hidden = true;
  teaser.setAttribute("data-hw-teaser", "true");
  teaser.style.cssText = "position:absolute;bottom:88px;" + pos + ":0;width:min(360px,calc(100vw - 32px));display:none;z-index:3;filter:drop-shadow(0 10px 28px rgba(0,0,0,.14));";

  var teaserCard = document.createElement("div");
  teaserCard.style.cssText = "position:relative;background:#fff;border-radius:16px;padding:16px 44px 16px 16px;cursor:pointer;border:1px solid #e5e7eb;";
  teaserCard.innerHTML = '<div style="display:flex;gap:12px;align-items:flex-start;">'
    + '<div style="width:48px;height:48px;border-radius:50%;background:' + brandColor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;overflow:hidden;">' + teaserAvatarHtml + '</div>'
    + '<p style="margin:0;font-size:16px;line-height:1.5;color:#1f2937;font-weight:500;">' + teaserText + '</p>'
    + '</div>';

  var teaserTail = document.createElement("div");
  teaserTail.style.cssText = "width:16px;height:16px;background:#fff;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;transform:rotate(45deg);position:absolute;bottom:-8px;" + pos + ":28px;";
  teaserCard.appendChild(teaserTail);

  var teaserClose = document.createElement("button");
  teaserClose.type = "button";
  teaserClose.setAttribute("aria-label", "Dismiss message");
  teaserClose.textContent = "×";
  teaserClose.style.cssText = "position:absolute;top:10px;right:10px;width:28px;height:28px;border:none;background:transparent;color:#9ca3af;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;pointer-events:auto;touch-action:manipulation;z-index:4;";
  teaserCard.appendChild(teaserClose);
  teaser.appendChild(teaserCard);

  var panel = document.createElement("div");
  panel.hidden = true;
  panel.style.cssText = "position:absolute;bottom:76px;" + pos + ":0;width:min(440px,calc(100vw - 24px));background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.22);display:none;flex-direction:column;max-height:min(640px,78vh);font-size:16px;";

  var header = document.createElement("div");
  header.style.cssText = "position:relative;padding:18px 52px 18px 18px;color:#fff;background:" + brandColor + ";display:flex;gap:12px;align-items:center;flex-shrink:0;z-index:1;";
  var avatar = document.createElement("div");
  avatar.style.cssText = "width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.2);overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0;pointer-events:none;";
  if (CFG.panel && CFG.panel.brandImageUrl) {
    var img = document.createElement("img"); img.src = CFG.panel.brandImageUrl; img.alt = ""; img.style.cssText = "width:100%;height:100%;object-fit:cover;"; avatar.appendChild(img);
  } else { avatar.textContent = ((CFG.panel && CFG.panel.brandName) || "W").charAt(0).toUpperCase(); }
  var meta = document.createElement("div");
  meta.style.cssText = "min-width:0;flex:1;pointer-events:none;";
  meta.innerHTML = '<div style="font-weight:700;font-size:17px;line-height:1.3;">' + esc((CFG.panel && CFG.panel.brandName) || "Support") + '</div><div style="font-size:14px;opacity:.9;margin-top:2px;">' + esc((CFG.panel && CFG.panel.brandSubtitle) || "") + '</div>';
  header.appendChild(avatar); header.appendChild(meta);

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = "position:absolute;top:12px;right:12px;width:36px;height:36px;border:none;background:rgba(255,255,255,.92);color:#374151;border-radius:50%;cursor:pointer;font-size:24px;line-height:1;z-index:20;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 1px 4px rgba(0,0,0,.15);pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;";

  var content = document.createElement("div");
  content.style.cssText = "flex:1;overflow:auto;padding:18px;background:#f8fafc;min-height:280px;";
  panel.appendChild(closeBtn);
  panel.appendChild(header);
  panel.appendChild(content);

  var footer = document.createElement("div");
  footer.style.cssText = "padding:10px 14px;border-top:1px solid #e5e7eb;background:#fff;font-size:12px;color:#6b7280;text-align:center;flex-shrink:0;";
  footer.textContent = "Powered by " + ((CFG.panel && CFG.panel.brandName) || "Support");
  panel.appendChild(footer);

  var pollTimer = null;
  var visitorToken = null;
  var messages = [];
  var lastTs = "";

  function renderMessages() {
    var html = "";
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var mine = !m.fromMe;
      html += '<div style="display:flex;justify-content:' + (mine ? "flex-end" : "flex-start") + ';margin:10px 0;"><div style="max-width:88%;padding:12px 14px;border-radius:14px;font-size:16px;line-height:1.45;background:' + (mine ? brandColor : "#fff") + ";color:" + (mine ? "#fff" : "#111") + ';box-shadow:0 1px 2px rgba(0,0,0,.06);">' + esc(m.body) + "</div></div>";
    }
    content.innerHTML = html;
    content.scrollTop = content.scrollHeight;
  }

  function showForm() {
    var welcome = (CFG.panel && CFG.panel.welcomeMessage) || "Enter your question below and a representative will get right back to you.";
    var collectName = CFG.panel && CFG.panel.collectVisitorName !== false;
    var collectPhone = CFG.panel && CFG.panel.collectVisitorPhone !== false;
  content.innerHTML = '<div style="background:#fff;border-radius:12px;padding:14px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,.06);font-size:16px;line-height:1.5;color:#374151;">' + esc(welcome) + '</div>'
    + (collectName ? '<input id="hw-name" placeholder="Your name" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:12px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;" />' : '')
    + (collectPhone ? '<input id="hw-phone" placeholder="Phone number" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:12px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;" />' : '')
    + '<textarea id="hw-msg" rows="3" placeholder="Your message" style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:12px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;resize:vertical;">' + esc(buildMessage()) + '</textarea>'
    + '<button id="hw-start" type="button" style="width:100%;padding:14px;border:none;border-radius:10px;background:' + brandColor + ';color:#fff;font-weight:600;font-size:16px;cursor:pointer;">' + esc((CFG.panel && CFG.panel.buttonText) || "Start Chat") + '</button>'
    + ((chatMode === "both") ? '<a href="' + waUrl() + '" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:12px;font-size:15px;color:' + brandColor + ';">Or open in WhatsApp</a>' : '');
    var startEl = content.querySelector("#hw-start");
    if (startEl) startEl.onclick = startChat;
  }

  function showWhatsAppOnly() {
    content.innerHTML = '<div style="text-align:center;padding:24px 14px;"><p style="font-size:16px;line-height:1.5;color:#374151;margin-bottom:18px;">' + esc((CFG.panel && CFG.panel.welcomeMessage) || "Chat with us on WhatsApp") + '</p><a href="' + waUrl() + '" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">' + esc((CFG.panel && CFG.panel.buttonText) || "Start Chat") + '</a></div>';
  }

  function showChatComposer() {
    var existing = panel.querySelector("[data-hw-composer]");
    if (existing) return;
    var bar = document.createElement("div");
    bar.setAttribute("data-hw-composer", "true");
    bar.style.cssText = "display:flex;gap:10px;padding:12px 14px;border-top:1px solid #e5e7eb;background:#fff;flex-shrink:0;";
    var input = document.createElement("input");
    input.placeholder = "Type a message…";
    input.style.cssText = "flex:1;padding:12px 14px;border:1px solid #d1d5db;border-radius:10px;font-size:16px;";
    var send = document.createElement("button");
    send.type = "button"; send.textContent = "Send";
    send.style.cssText = "padding:12px 18px;border:none;border-radius:10px;background:" + brandColor + ";color:#fff;font-weight:600;cursor:pointer;font-size:16px;";
    send.onclick = function() {
      var text = (input.value || "").trim();
      if (!text || !visitorToken) return;
      input.value = "";
      send.disabled = true;
      api("/api/public/whatsapp-chat-widget/chat/message", { method: "POST", body: JSON.stringify({ visitorToken: visitorToken, message: text, pageUrl: window.location.href }) })
        .then(function(res) {
          if (res.message) { messages.push(res.message); lastTs = res.message.timestamp || lastTs; renderMessages(); }
        })
        .catch(function(e) { alert(e.message || "Failed to send"); })
        .finally(function() { send.disabled = false; });
    };
    input.addEventListener("keydown", function(e) { if (e.key === "Enter") send.click(); });
    bar.appendChild(input); bar.appendChild(send);
    if (chatMode === "both") {
      var wa = document.createElement("a");
      wa.href = waUrl(); wa.target = "_blank"; wa.rel = "noopener";
      wa.textContent = "WA"; wa.title = "Open in WhatsApp";
      wa.style.cssText = "display:flex;align-items:center;justify-content:center;width:48px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;";
      bar.appendChild(wa);
    }
    panel.appendChild(bar);
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function() {
      if (!visitorToken) return;
      var q = "/api/public/whatsapp-chat-widget/chat/messages?visitorToken=" + encodeURIComponent(visitorToken);
      if (lastTs) q += "&since=" + encodeURIComponent(lastTs);
      fetch(ORIGIN + q).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.messages || !data.messages.length) return;
        for (var i = 0; i < data.messages.length; i++) {
          var exists = messages.some(function(m) { return m.id === data.messages[i].id; });
          if (!exists) messages.push(data.messages[i]);
        }
        lastTs = data.messages[data.messages.length - 1].timestamp || lastTs;
        renderMessages();
      }).catch(function() {});
    }, 3000);
  }

  function startChat() {
    var nameEl = content.querySelector("#hw-name");
    var phoneEl = content.querySelector("#hw-phone");
    var msgEl = content.querySelector("#hw-msg");
    var body = {
      widgetPublicId: CFG.widgetPublicId,
      visitorName: nameEl ? nameEl.value : "",
      visitorPhone: phoneEl ? phoneEl.value : phone,
      message: msgEl ? msgEl.value : buildMessage(),
      pageUrl: window.location.href
    };
    var btn = content.querySelector("#hw-start");
    if (btn) { btn.disabled = true; btn.textContent = "Starting…"; }
    api("/api/public/whatsapp-chat-widget/chat/start", { method: "POST", body: JSON.stringify(body) })
      .then(function(res) {
        visitorToken = res.visitorToken;
        try { localStorage.setItem(storageKey, visitorToken); } catch(e) {}
        messages = res.messages || [];
        if (messages.length) lastTs = messages[messages.length - 1].timestamp || "";
        content.innerHTML = "";
        renderMessages();
        showChatComposer();
        startPolling();
      })
      .catch(function(e) { alert(e.message || "Could not start chat"); if (btn) { btn.disabled = false; btn.textContent = (CFG.panel && CFG.panel.buttonText) || "Start Chat"; } });
  }

  function resumeChat(token) {
    visitorToken = token;
    fetch(ORIGIN + "/api/public/whatsapp-chat-widget/chat/messages?visitorToken=" + encodeURIComponent(token))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        messages = data.messages || [];
        if (messages.length) lastTs = messages[messages.length - 1].timestamp || "";
        renderMessages();
        showChatComposer();
        startPolling();
      })
      .catch(function() { showForm(); });
  }

  function isPanelOpen() {
    return !panel.hidden && panel.style.display === "flex";
  }

  function showTeaser() {
    if (isPanelOpen()) return;
    try { if (sessionStorage.getItem(teaserDismissKey)) return; } catch(e) {}
    teaser.hidden = false;
    teaser.style.display = "block";
  }

  function hideTeaser(persist) {
    teaser.hidden = true;
    teaser.style.display = "none";
    if (persist) {
      try { sessionStorage.setItem(teaserDismissKey, "1"); } catch(e) {}
    }
  }

  function setPanelVisible(visible) {
    if (visible) {
      panel.hidden = false;
      panel.style.display = "flex";
      btn.setAttribute("aria-expanded", "true");
    } else {
      panel.hidden = true;
      panel.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }
  }

  function openPanel() {
    hideTeaser(false);
    setPanelVisible(true);
    var oldBar = panel.querySelector("[data-hw-composer]");
    if (oldBar) oldBar.remove();
    if (chatMode === "whatsapp") { showWhatsAppOnly(); return; }
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved) { resumeChat(saved); return; }
    } catch(e) {}
    showForm();
  }
  function closePanel() {
    setPanelVisible(false);
  }

  btn.addEventListener("click", function() {
    if (CFG.panel && CFG.panel.openOnButtonClick === false) {
      if (chatMode === "whatsapp" || chatMode === "both") window.open(waUrl(), "_blank", "noopener,noreferrer");
      else openPanel();
      return;
    }
    if (!isPanelOpen()) openPanel(); else closePanel();
  });

  function onTeaserDismiss(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    hideTeaser(true);
    return false;
  }
  teaserClose.addEventListener("click", onTeaserDismiss, true);
  teaserClose.addEventListener("mousedown", onTeaserDismiss, true);
  teaserClose.addEventListener("touchstart", onTeaserDismiss, { capture: true, passive: false });
  teaserClose.onclick = onTeaserDismiss;

  teaserCard.addEventListener("click", function(e) {
    if (e.target === teaserClose) return;
    openPanel();
  });

  function onCloseClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    closePanel();
    return false;
  }
  closeBtn.addEventListener("click", onCloseClick, true);
  closeBtn.addEventListener("mousedown", onCloseClick, true);
  closeBtn.addEventListener("touchstart", onCloseClick, { capture: true, passive: false });
  closeBtn.onclick = onCloseClick;

  root.appendChild(teaser);
  root.appendChild(panel);
  root.appendChild(btn);
  document.body.appendChild(root);

  if (CFG.panel && CFG.panel.showByDefault) {
    setTimeout(showTeaser, Math.max(0, Number(CFG.panel.showDelaySeconds) || 0) * 1000);
  }
})();`;
}

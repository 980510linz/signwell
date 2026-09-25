(function () {
  "use strict";
  var VERSION = "24.37.0-impact-r4";
  var STYLE_ID = "swid-style-v2435";
  var OVERLAY_ID = "swArticleIdOverlay";
  var lastFocus = null;
  var JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  var QRCODE_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

  function q(s, r) {
    return (r || document).querySelector(s);
  }
  function qa(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function safeHttps(v) {
    /* ui 25.1: empty input must stay empty (it used to resolve to the current
       page, producing broken avatars and self-links). */
    if (!String(v == null ? "" : v).trim()) return "";
    try {
      var u = new URL(String(v || ""), location.href);
      return /^https?:$/i.test(u.protocol) ? u.href : "";
    } catch (_) {
      return "";
    }
  }
  function fmtDate(v) {
    if (!v) return "—";
    try {
      return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(v));
    } catch (_) {
      return String(v);
    }
  }
  function loadScript(src, test) {
    if (test && test()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var old = qa('script[src="' + src + '"]')[0];
      if (old) {
        old.addEventListener("load", resolve, { once: true });
        old.addEventListener("error", reject, { once: true });
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ensureQrLib() {
    return loadScript(QRCODE_URL, function () {
      return !!window.QRCode;
    });
  }
  function ensureJsQr() {
    return loadScript(JSQR_URL, function () {
      return !!window.jsQR;
    });
  }
  function sourceTypeLabel(v) {
    return (
      {
        pubmed: "PubMed",
        research: "學術研究",
        government: "政府／官方",
        news: "新聞",
        image: "圖片",
        internal: "站內溯源",
      }[String(v || "").toLowerCase()] || "來源"
    );
  }
  function sourceHtml(s) {
    var url = safeHttps(s.url),
      host = "";
    try {
      host = url ? new URL(url).hostname : "";
    } catch (_) {}
    var inner =
      '<span class="swid-source-type">' +
      esc(sourceTypeLabel(s.type)) +
      '</span><span class="swid-source-copy"><strong>' +
      esc(s.title || host || "來源") +
      "</strong><small>" +
      esc(s.meta || host || "") +
      '</small></span><span class="swid-source-arrow">↗</span>';
    return url
      ? '<a class="swid-source" href="' +
          esc(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          inner +
          "</a>"
      : '<div class="swid-source">' + inner + "</div>";
  }
  function listHtml(items, cls) {
    items = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!items.length) return "";
    return (
      '<ul class="' +
      cls +
      '">' +
      items
        .map(function (x) {
          return "<li>" + esc(x) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }
  function expertiseHtml(items) {
    items = Array.isArray(items) ? items.filter(Boolean) : [];
    return items.length
      ? '<div class="swid-author-tags">' +
          items
            .map(function (x) {
              return "<span>" + esc(x) + "</span>";
            })
            .join("") +
          "</div>"
      : "";
  }
  function authorHtml(author) {
    author = author && typeof author === "object" ? author : {};
    var profile = safeHttps(author.profileUrl),
      photo = safeHttps(author.photo);
    if (!author.name && !author.bio && !author.role)
      return '<div class="swid-author-empty">作者資料將由 SIGN WELL 作者頁同步。</div>';
    return (
      '<div class="swid-author-card"><div class="swid-author-head">' +
      (photo
        ? '<img class="swid-author-avatar" src="' +
          esc(photo) +
          '" alt="' +
          esc(author.name || "作者") +
          '" loading="lazy" decoding="async">'
        : '<div class="swid-author-avatar swid-author-avatar-fallback" aria-hidden="true">' +
          esc(String(author.name || "S").slice(0, 1)) +
          "</div>") +
      '<div class="swid-author-title"><strong>' +
      esc(author.name || "SIGN WELL 編輯部") +
      "</strong>" +
      (author.role ? "<span>" + esc(author.role) + "</span>" : "") +
      "</div>" +
      (profile
        ? '<a class="swid-author-link" href="' +
          esc(profile) +
          '" target="_blank" rel="noopener">完整作者頁 ↗</a>'
        : "") +
      "</div>" +
      (author.bio
        ? '<p class="swid-author-bio">' + esc(author.bio) + "</p>"
        : "") +
      expertiseHtml(author.expertise) +
      (Array.isArray(author.education) && author.education.length
        ? '<details class="swid-author-detail"><summary>學歷</summary>' +
          listHtml(author.education, "swid-author-list") +
          "</details>"
        : "") +
      (Array.isArray(author.experience) && author.experience.length
        ? '<details class="swid-author-detail"><summary>經歷</summary>' +
          listHtml(author.experience, "swid-author-list") +
          "</details>"
        : "") +
      "</div>"
    );
  }
  function geoCheckLabel(k) {
    return (
      {
        sitemap: "Sitemap",
        structuredData: "結構化資料",
        robots: "Crawler",
        authorProfile: "作者頁",
        references: "引用文獻",
        updated: "更新日期",
        permanentId: "永久 ID",
      }[k] || k
    );
  }
  function geoChecksHtml(checks) {
    checks = checks && typeof checks === "object" ? checks : {};
    var keys = [
      "sitemap",
      "structuredData",
      "robots",
      "authorProfile",
      "references",
      "updated",
      "permanentId",
    ];
    return (
      '<div class="swid-geo-checks">' +
      keys
        .map(function (k) {
          var on = checks[k] === true;
          return (
            '<span class="' +
            (on ? "is-ready" : "is-missing") +
            '"><i aria-hidden="true">' +
            (on ? "✓" : "–") +
            "</i>" +
            esc(geoCheckLabel(k)) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function geoHtml(geo) {
    geo = geo && typeof geo === "object" ? geo : {};
    var score = Math.max(0, Math.min(100, Number(geo.score || 0))),
      verified = Number(geo.verifiedCitationCount || 0),
      referrals = Number(geo.aiReferralCount || 0),
      note = String(
        geo.measurementNote ||
          "已驗證 AI 引用與可觀測 AI 導流是可稽核訊號，不代表所有 AI 平台的完整引用總量。",
      );
    return (
      '<div class="swid-geo"><div class="swid-geo-hero"><div class="swid-geo-score"><span>GEO READINESS</span><strong>' +
      score +
      '</strong><small>/ 100</small></div><div class="swid-geo-bar" aria-label="GEO readiness ' +
      score +
      ' percent"><i style="--swid-geo-score:' +
      score +
      '%"></i></div><span class="swid-geo-state ' +
      (geo.ready ? "is-ready" : "") +
      '">' +
      (geo.ready ? "AI 可發現基礎完整" : "仍有可補強項目") +
      '</span></div><div class="swid-geo-metrics"><div><span>已驗證 AI 引用</span><strong data-swid-geo-citations>' +
      verified +
      "</strong><small>evidence-backed</small></div><div><span>可觀測 AI 導流</span><strong data-swid-geo-referrals>" +
      referrals +
      '</strong><small>browser referrer</small></div><div><span>最後檢查</span><strong class="swid-geo-date" data-swid-geo-checked>' +
      esc(fmtDate(geo.checkedAt)) +
      "</strong><small>GEO snapshot</small></div></div>" +
      geoChecksHtml(geo.checks) +
      '<p class="swid-geo-note">' +
      esc(note) +
      "</p></div>"
    );
  }
  function quickMetricHtml(payload, sources) {
    var geo = payload.geo || {},
      author = payload.author || {};
    return (
      '<div class="swid-tray-summary"><div class="swid-summary-impact"><span>SW IMPACT</span><strong data-swid-impact-score>—</strong></div><div><span>作者</span><strong>' +
      esc(author.name || "SIGN WELL") +
      "</strong></div><div><span>來源</span><strong>" +
      sources.length +
      "</strong></div><div><span>GEO</span><strong>" +
      Math.max(0, Math.min(100, Number(geo.score || 0))) +
      "</strong></div><div><span>AI 引用</span><strong data-swid-geo-citations>" +
      Number(geo.verifiedCitationCount || 0) +
      "</strong></div></div>"
    );
  }


  function impactSignalLabel(score, signals) {
    score = Number(score || 0);
    signals = Number(signals || 0);
    if (signals <= 0) return "尚無影響訊號";
    if (score < 2) return "早期訊號";
    if (score < 4) return "形成中";
    if (score < 6) return "持續累積";
    if (score < 8) return "高影響訊號";
    return "高度擴散";
  }
  function impactCompute(payload) {
    payload = payload || {};
    var trace = payload._impactTrace;
    if (!trace || typeof trace !== "object") return null;
    var geo = payload.geo || {},
      referencedBy = Math.max(
        0,
        Number(
          trace.referenced_by != null
            ? trace.referenced_by
            : Array.isArray(trace.referenced_by_items)
              ? trace.referenced_by_items.length
              : 0,
        ) || 0,
      ),
      verifiedAi = Math.max(0, Number(geo.verifiedCitationCount || 0) || 0),
      referrals = Math.max(0, Number(geo.aiReferralCount || 0) || 0),
      citationUnits = referencedBy + verifiedAi * 1.5,
      publishedRaw =
        trace.published_at || payload.firstIndexedAt || payload.indexedAt || "",
      publishedTs = Date.parse(publishedRaw),
      ageDays = Number.isFinite(publishedTs)
        ? Math.max(1, (Date.now() - publishedTs) / 86400000)
        : 90,
      effectiveAgeDays = Math.max(90, ageDays),
      annualized = citationUnits * (365 / effectiveAgeDays),
      network = 100 * (1 - Math.exp(-citationUnits / 5)),
      velocity = 100 * (1 - Math.exp(-annualized / 8)),
      discovery = 100 * (1 - Math.exp(-referrals / 25)),
      score = Math.max(
        0,
        Math.min(10, (network * 0.55 + velocity * 0.25 + discovery * 0.2) / 10),
      ),
      signalCount = referencedBy + verifiedAi + referrals;
    return {
      score: Math.round(score * 10) / 10,
      referencedBy: referencedBy,
      verifiedAi: verifiedAi,
      referrals: referrals,
      annualized: Math.round(annualized * 10) / 10,
      ageDays: Math.round(ageDays),
      network: Math.round(network),
      velocity: Math.round(velocity),
      discovery: Math.round(discovery),
      label: impactSignalLabel(score, signalCount),
      completeness: geo.checkedAt ? "live" : "partial",
    };
  }
  function impactSetText(overlay, selector, value) {
    qa(selector, overlay).forEach(function (el) {
      el.textContent = String(value == null ? "—" : value);
    });
  }
  function renderImpact(payload, overlay) {
    if (!overlay) return null;
    var m = impactCompute(payload);
    if (!m) return null;
    impactSetText(overlay, "[data-swid-impact-score]", m.score.toFixed(1));
    impactSetText(overlay, "[data-swid-impact-referenced]", m.referencedBy);
    impactSetText(overlay, "[data-swid-impact-ai]", m.verifiedAi);
    impactSetText(overlay, "[data-swid-impact-referrals]", m.referrals);
    impactSetText(overlay, "[data-swid-impact-velocity]", m.annualized.toFixed(1));
    impactSetText(overlay, "[data-swid-impact-label]", m.label);
    impactSetText(overlay, "[data-swid-impact-age]", m.ageDays + " 天");
    qa("[data-swid-impact-ring]", overlay).forEach(function (el) {
      el.style.setProperty("--swid-impact-pct", Math.max(0, Math.min(100, m.score * 10)) + "%");
    });
    var card = q("[data-swid-impact-card]", overlay);
    if (card) {
      card.dataset.impactState = m.score >= 6 ? "strong" : m.score >= 2 ? "active" : "early";
      card.dataset.impactCompleteness = m.completeness;
    }
    payload.impact = m;
    return m;
  }
  function impactHtml() {
    return (
      '<div class="swid-impact" data-swid-impact-card data-impact-state="early">' +
      '<div class="swid-impact-hero"><div class="swid-impact-ring" data-swid-impact-ring style="--swid-impact-pct:0%"><div><strong data-swid-impact-score>—</strong><span>/10</span></div></div>' +
      '<div class="swid-impact-copy"><span class="swid-impact-kicker">SIGN WELL IMPACT INDEX</span><h4 data-swid-impact-label>同步影響訊號…</h4><p>衡量這篇文章在 SIGN WELL 引用網絡與可驗證 AI 生態中的擴散程度。</p></div>' +
      '<span class="swid-impact-badge">SWII</span></div>' +
      '<div class="swid-impact-metrics"><div><span>站內被引用</span><strong data-swid-impact-referenced>—</strong><small>incoming citations</small></div><div><span>已驗證 AI 引用</span><strong data-swid-impact-ai>—</strong><small>evidence-backed</small></div><div><span>AI 導流</span><strong data-swid-impact-referrals>—</strong><small>observable referrals</small></div><div><span>年化引用速度</span><strong data-swid-impact-velocity>—</strong><small>weighted / year</small></div></div>' +
      '<details class="swid-impact-method"><summary>計算方式與限制</summary><p>SW Impact Index（SWII）為 0–10 的 SIGN WELL 站內指標：55% 引用網絡、25% 年化引用速度、20% 可觀測 AI 導流。站內被引用計 1 個 citation unit；經人工驗證的 AI 引用計 1.5 units；新文章的速度計算以至少 90 天作為分母，並使用對數／飽和轉換避免單一事件使分數暴增。文章年齡：<b data-swid-impact-age>—</b>。</p><p><strong>SWII 不是 Journal Impact Factor，也不代表研究品質、證據等級或臨床建議強度。</strong></p></details>' +
      '</div>'
    );
  }

  function payloadKey(p) {
    return [p.articleId, p.slug, p.title, p.version].join("|");
  }
  function renderOverlay(payload) {
    var old = q("#" + OVERLAY_ID);
    if (old) {
      if (old._swidOnKey) document.removeEventListener("keydown", old._swidOnKey);
      old.remove();
    }
    var sources = Array.isArray(payload.sources) ? payload.sources : [];
    var author =
      payload.author && typeof payload.author === "object"
        ? payload.author
        : {};
    var geo = payload.geo && typeof payload.geo === "object" ? payload.geo : {};
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "swid-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "文章 ID 卡");
    overlay.innerHTML =
      '<div class="swid-shell">' +
      '<div class="swid-toolbar"><div class="swid-toolbar-left"><span class="swid-toolbar-kicker">ARTICLE ID CARD</span><span class="swid-toolbar-title">' +
      esc(payload.title || "SIGN WELL") +
      '</span></div><div class="swid-toolbar-actions"><button class="swid-icon-btn" type="button" data-swid-flip aria-label="翻面">↻</button><button class="swid-icon-btn" type="button" data-swid-close aria-label="關閉">×</button></div></div>' +
      '<div class="swid-viewport"><div class="swid-ambient" aria-hidden="true"></div><div class="swid-shadow" aria-hidden="true"></div><div class="swid-stack" data-flipped="0" data-tray="closed">' +
      '<div class="swid-card-wrap">' +
      '<section class="swid-face swid-front"><div class="swid-front-main"><div class="swid-eyebrow">' +
      esc(payload.category || "SIGN WELL · ARTICLE") +
      "</div><h2>" +
      esc(payload.title || "未命名文章") +
      '</h2><div class="swid-overview">' +
      esc(payload.overview || "") +
      "</div>" +
      (author.name
        ? '<div class="swid-front-byline"><span>AUTHOR</span><strong>' +
          esc(author.name) +
          "</strong>" +
          (author.role ? "<small>" + esc(author.role) + "</small>" : "") +
          "</div>"
        : "") +
      '<div class="swid-meta-row"><span class="swid-chip">' +
      esc(payload.articleId || "ARTICLE") +
      '</span><span class="swid-chip">v' +
      esc(payload.version || "1.0") +
      '</span><span class="swid-chip">' +
      sources.length +
      ' SOURCES</span><span class="swid-chip swid-impact-chip" title="SIGN WELL 站內文章影響力指標；非 Journal Impact Factor"><small>SW IMPACT</small><b data-swid-impact-score>—</b></span></div></div><aside class="swid-qr-pane"><div class="swid-qr" data-swid-qr><span class="swid-qr-placeholder">QR 建立中…</span></div><div class="swid-id">' +
      esc(payload.articleId || "SIGN WELL") +
      '</div><div class="swid-hint">掃描後直接開啟這篇文章</div></aside></section>' +
      '<section class="swid-face swid-back"><div class="swid-back-logo"><strong>SIGN WELL</strong><span>欣緯生醫</span></div></section>' +
      "</div>" +
      '<section class="swid-tray"><button class="swid-tray-handle" type="button" data-swid-tray><span>上滑查看更多</span></button><div class="swid-tray-body">' +
      quickMetricHtml(payload, sources) +
      '<section class="swid-tray-section"><h3>SW Impact · 文章影響力</h3>' +
      impactHtml() +
      "</section>" +
      '<section class="swid-tray-section swid-author-section"><h3>Author · 作者介紹</h3>' +
      authorHtml(author) +
      "</section>" +
      '<section class="swid-tray-section"><h3>GEO · AI Discoverability</h3>' +
      geoHtml(geo) +
      "</section>" +
      '<section class="swid-tray-section"><h3>References & Sources</h3><div class="swid-source-list">' +
      (sources.length
        ? sources.map(sourceHtml).join("")
        : '<div class="swid-legal">這篇文章目前沒有可公開的外部引用來源。</div>') +
      "</div></section>" +
      '<section class="swid-tray-section"><h3>Index & Version</h3><div class="swid-info-grid"><div class="swid-info"><span>最後索引</span><strong>' +
      esc(fmtDate(payload.indexedAt)) +
      '</strong></div><div class="swid-info"><span>首次索引</span><strong>' +
      esc(fmtDate(payload.firstIndexedAt || payload.indexedAt)) +
      '</strong></div><div class="swid-info"><span>文章 ID</span><strong>' +
      esc(payload.articleId || "—") +
      '</strong></div><div class="swid-info"><span>版本</span><strong>' +
      esc(payload.version || "1.0") +
      "</strong></div></div></section>" +
      '<section class="swid-tray-section"><h3>Regulatory Notice</h3><div class="swid-legal">' +
      esc(
        payload.legalNotice ||
          "本站內容僅供醫學教育與資訊整理，不構成個別醫療建議。",
      ) +
      "</div></section>" +
      '<section class="swid-tray-section"><h3>Share</h3><div class="swid-share-row"><button class="primary" type="button" data-swid-share>分享文章</button><button type="button" data-swid-copy>複製連結</button>' +
      (safeHttps(payload.traceUrl)
        ? '<a href="' +
          esc(safeHttps(payload.traceUrl)) +
          '" target="_blank" rel="noopener">文章溯源 ↗</a>'
        : "") +
      "</div></section>" +
      "</div></section>" +
      "</div></div></div>";
    overlay.dataset.key = payloadKey(payload);
    document.body.appendChild(overlay);
    bindOverlay(overlay, payload);
    return overlay;
  }
  function openOverlay(payload) {
    /* ui 25.1: soft routing keeps the page alive between articles — never
       reuse an overlay rendered for a different article. */
    var overlay = q("#" + OVERLAY_ID);
    if (!overlay || overlay.dataset.key !== payloadKey(payload)) overlay = renderOverlay(payload);
    lastFocus = document.activeElement;
    overlay.dataset.open = "1";
    document.documentElement.classList.add("swid-lock");
    document.body.classList.add("swid-lock");
    setTimeout(function () {
      makeQr(
        q("[data-swid-qr]", overlay),
        payload.qrTarget || payload.url || location.href,
      );
      protectVisualAsset(q("[data-swid-qr]", overlay));
      refreshGeo(payload, overlay);
      refreshImpactTrace(payload, overlay);
      var c = q("[data-swid-close]", overlay);
      if (c)
        try {
          c.focus({ preventScroll: true });
        } catch (_) {
          c.focus();
        }
    }, 0);
    return overlay;
  }
  function closeOverlay() {
    var overlay = q("#" + OVERLAY_ID);
    if (overlay) overlay.dataset.open = "0";
    document.documentElement.classList.remove("swid-lock");
    document.body.classList.remove("swid-lock");
    if (lastFocus && document.contains(lastFocus))
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (_) {
        try {
          lastFocus.focus();
        } catch (__) {}
      }
    lastFocus = null;
  }
  function makeQr(el, text) {
    if (!el || !text) return;
    var value = String(text);
    if (el.dataset.swidQrValue === value && el.querySelector("canvas,img"))
      return;
    el.dataset.swidQrValue = value;
    el.innerHTML = '<span class="swid-qr-placeholder">QR 建立中…</span>';
    ensureQrLib()
      .then(function () {
        el.innerHTML = "";
        new window.QRCode(el, {
          text: value,
          width: 220,
          height: 220,
          colorDark: "#50697b",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        setTimeout(function(){ protectVisualAsset(el); }, 20);
      })
      .catch(function () {
        delete el.dataset.swidQrValue;
        el.innerHTML =
          '<span class="swid-qr-placeholder">QR 載入失敗<br>可使用「複製連結」</span>';
      });
  }
  function bindOverlay(overlay, payload) {
    var stack = q(".swid-stack", overlay);
    q("[data-swid-close]", overlay).onclick = closeOverlay;
    q("[data-swid-flip]", overlay).onclick = function () {
      stack.dataset.flipped = stack.dataset.flipped === "1" ? "0" : "1";
    };
    q("[data-swid-tray]", overlay).onclick = function () {
      stack.dataset.tray = stack.dataset.tray === "open" ? "closed" : "open";
    };
    q("[data-swid-copy]", overlay).onclick = function () {
      copyText(payload.qrTarget || payload.url || location.href);
    };
    q("[data-swid-share]", overlay).onclick = function () {
      sharePayload(payload);
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    overlay._swidOnKey = function onKey(e) {
      if (overlay.dataset.open !== "1") return;
      if (e.key === "Escape") closeOverlay();
      if (e.key === "ArrowUp") stack.dataset.tray = "open";
      if (e.key === "ArrowDown") stack.dataset.tray = "closed";
      if (e.key === "ArrowLeft" || e.key === "ArrowRight")
        stack.dataset.flipped = stack.dataset.flipped === "1" ? "0" : "1";
    };
    document.addEventListener("keydown", overlay._swidOnKey);
    bindTilt(overlay);
    var start = null;
    var target = q(".swid-card-wrap", overlay);
    target.addEventListener("pointerdown", function (e) {
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try {
        target.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    target.addEventListener("pointerup", function (e) {
      if (!start) return;
      var dx = e.clientX - start.x,
        dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 42) {
        stack.dataset.tray = dy < 0 ? "open" : "closed";
        return;
      }
      if (Math.abs(dx) > 55)
        stack.dataset.flipped = stack.dataset.flipped === "1" ? "0" : "1";
    });
  }
  function tiltEnabled() {
    try {
      return !!(window.innerWidth >= 980 && window.matchMedia && window.matchMedia("(pointer:fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  }
  function protectVisualAsset(el) {
    if (!el || el.dataset.swidAssetLocked === "1") return;
    el.dataset.swidAssetLocked = "1";
    ['contextmenu','dragstart','selectstart'].forEach(function(type){ el.addEventListener(type,function(e){ e.preventDefault(); }); });
    el.style.webkitUserSelect = 'none';
    el.style.userSelect = 'none';
    el.style.webkitTouchCallout = 'none';
    el.style.webkitUserDrag = 'none';
    qa('canvas,img', el).forEach(function(node){
      node.setAttribute('draggable','false');
      node.style.pointerEvents = 'none';
      node.style.webkitUserDrag = 'none';
      node.style.webkitTouchCallout = 'none';
      node.style.userSelect = 'none';
    });
  }
  function bindTilt(overlay) {
    var viewport = q('.swid-viewport', overlay);
    var card = q('.swid-card-wrap', overlay);
    var ambient = q('.swid-ambient', overlay);
    var shadow = q('.swid-shadow', overlay);
    if (!viewport || !card || card.dataset.swidTiltReady === '1') return;
    card.dataset.swidTiltReady = '1';
    var targetX = 0, targetY = 0, currentX = 0, currentY = 0, active = false;
    function apply(nx, ny) {
      var mx = 50 + nx * 32;
      var my = 44 + ny * 28;
      card.style.setProperty('--swid-mx', mx + '%');
      card.style.setProperty('--swid-my', my + '%');
      card.style.setProperty('--swid-ex', (nx * 16).toFixed(2) + 'px');
      card.style.setProperty('--swid-ey', (ny * 16).toFixed(2) + 'px');
      if (shadow) {
        shadow.style.setProperty('--swid-sx', (-nx * 30).toFixed(2) + 'px');
        shadow.style.setProperty('--swid-sy', (ny * 12).toFixed(2) + 'px');
      }
      if (ambient) {
        ambient.style.setProperty('--swid-gx', mx + '%');
        ambient.style.setProperty('--swid-gy', my + '%');
      }
    }
    function reset(immediate) {
      active = false;
      targetX = 0;
      targetY = 0;
      apply(0, 0);
      viewport.dataset.tiltEnabled = tiltEnabled() ? '1' : '0';
      if (immediate) {
        currentX = 0;
        currentY = 0;
        card.style.setProperty('--swid-rx', '0deg');
        card.style.setProperty('--swid-ry', '0deg');
      }
    }
    function setTarget(clientX, clientY) {
      if (!tiltEnabled()) return reset(true);
      var r = card.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
      var ny = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height) * 2 - 1));
      targetY = nx * 16;
      targetX = -ny * 13;
      apply(nx, ny);
    }
    viewport.addEventListener('pointerenter', function(e){ if (e.pointerType !== 'mouse' || !tiltEnabled()) return; active = true; setTarget(e.clientX,e.clientY); });
    viewport.addEventListener('pointermove', function(e){ if (e.pointerType !== 'mouse' || !tiltEnabled()) return; active = true; setTarget(e.clientX,e.clientY); });
    viewport.addEventListener('pointerleave', function(){ reset(false); });
    window.addEventListener('resize', function(){ reset(true); });
    (function tick(){
      var ease = active ? 0.11 : 0.08;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      card.style.setProperty('--swid-rx', currentX.toFixed(3) + 'deg');
      card.style.setProperty('--swid-ry', currentY.toFixed(3) + 'deg');
      requestAnimationFrame(tick);
    })();
    reset(true);
  }
  function copyText(v) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(String(v)).catch(function () {});
    var x = document.createElement("textarea");
    x.value = String(v);
    document.body.appendChild(x);
    x.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    x.remove();
    return Promise.resolve();
  }
  function sharePayload(p) {
    var url = p.qrTarget || p.url || location.href;
    var text = "SIGN WELL｜" + String(p.title || "文章");
    if (navigator.share)
      return navigator
        .share({ title: p.title || "SIGN WELL", text: text, url: url })
        .catch(function (e) {
          if (e && e.name !== "AbortError") copyText(url);
        });
    return copyText(url);
  }
  function mountButton(payload, root) {
    if (!payload || !payload.title) return;
    /* ui 25.1: reuse the core "文章 ID 卡" button (data-swid-open-card) instead
       of appending a second, duplicate button next to it. */
    var existing = q("[data-swid-open],[data-swid-open-card]");
    if (existing) {
      existing.onclick = function () {
        openOverlay(payload);
      };
      return;
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swid-open-btn";
    btn.setAttribute("data-swid-open", "1");
    btn.innerHTML =
      "文章 ID 卡 <small>" + esc(payload.articleId || "") + "</small>";
    btn.onclick = function () {
      openOverlay(payload);
    };
    var target =
      root ||
      q(".article-actions") ||
      q(".actions") ||
      q("[data-article-actions]");
    if (target) {
      target.appendChild(btn);
    } else {
      btn.classList.add("swid-fab");
      document.body.appendChild(btn);
    }
  }
  function hideLegacyQr() {
    qa(
      "[data-share-qr],[data-qr-share],#shareQr,#qrShare,.share-qr,.qr-share,.article-identity-qr",
    ).forEach(function (el) {
      el.hidden = true;
    });
    qa("button,a").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (/^(?:QR|QR Code|顯示 QR|開啟 QR)$/i.test(t)) el.hidden = true;
    });
  }
  function normalizePayload(article) {
    article = article || {};
    var p = article.articleIdCard || {},
      author = p.author && typeof p.author === "object" ? p.author : {},
      geo = p.geo && typeof p.geo === "object" ? p.geo : {};
    return {
      title: p.title || article.title || "",
      category: p.category || article.category || "",
      overview:
        p.overview ||
        article.ai_summary10s ||
        article.summary10s ||
        article.excerpt ||
        "",
      articleId: p.articleId || article.article_id || article.id || "",
      slug: article.slug || currentSlug() || "",
      version: p.version || article.current_version || "1.0",
      qrTarget: p.qrTarget || article.url || location.href,
      indexedAt:
        p.indexedAt || article.lastPublishedAt || article.updatedAt || "",
      firstIndexedAt: p.firstIndexedAt || p.indexedAt || "",
      sources: Array.isArray(p.sources) ? p.sources : [],
      author: {
        id: author.id || "",
        name: author.name || article.publisherName || "",
        role: author.role || "",
        bio: author.bio || "",
        photo: author.photo || article.publisherPhoto || "",
        expertise: Array.isArray(author.expertise) ? author.expertise : [],
        education: Array.isArray(author.education) ? author.education : [],
        experience: Array.isArray(author.experience) ? author.experience : [],
        profileUrl: author.profileUrl || "",
      },
      geo: {
        schema: geo.schema || "",
        score: Number(geo.score || 0),
        ready: geo.ready === true,
        checks: geo.checks && typeof geo.checks === "object" ? geo.checks : {},
        verifiedCitationCount: Number(geo.verifiedCitationCount || 0),
        aiReferralCount: Number(geo.aiReferralCount || 0),
        providers:
          geo.providers && typeof geo.providers === "object"
            ? geo.providers
            : {},
        checkedAt: geo.checkedAt || "",
        measurementNote:
          geo.measurementNote ||
          "已驗證 AI 引用與可觀測 AI 導流是可稽核訊號，不代表所有 AI 平台的完整引用總量。",
      },
      legalNotice: p.legalNotice || "",
      traceUrl: p.traceUrl || article.trace_url || "",
    };
  }
  function currentSlug() {
    var u = new URL(location.href);
    var qv = u.searchParams.get("article");
    if (qv) return qv;
    var m = u.pathname.match(/\/article\/([^/]+)\/?$/i);
    return m ? decodeURIComponent(m[1]) : "";
  }
  function fetchArticle(slug) {
    if (!slug) return Promise.resolve(null);
    return fetch(
      new URL("articles/" + encodeURIComponent(slug) + ".json", location.href),
      { cache: "no-store" },
    )
      .then(function (r) {
        if (!r.ok) throw new Error("article " + r.status);
        return r.json();
      })
      .catch(function () {
        return fetch(
          new URL(
            "../articles/" + encodeURIComponent(slug) + ".json",
            location.href,
          ),
          { cache: "no-store" },
        )
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          });
      });
  }
  function mountDynamicArticle() {
    var slug = currentSlug();
    if (!slug) return Promise.resolve(false);
    return fetchArticle(slug).then(function (a) {
      if (!a) return false;
      hideLegacyQr();
      var p = normalizePayload(a);
      mountButton(p);
      window.SIGNWELL_ARTICLE_ID_CARD = p;
      trackAiReferral(p);
      return true;
    });
  }

  /* Public GEO observability: valid Apps Script endpoint is enough. No API key is exposed. */
  function backendEndpoint() {
    var n = window.SIGNWELL_NEWSLETTER || {},
      a = window.SIGNWELL_ANALYTICS || {},
      raw = String(n.endpoint || a.endpoint || "").trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[^\s?#]+\/exec(?:[?#].*)?$/i.test(
      raw,
    )
      ? raw
      : "";
  }
  function publicBridge(action, payload, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var endpoint = backendEndpoint();
      if (!endpoint) return reject(new Error("backend unavailable"));
      var requestId =
          "swgeo_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2),
        frameName = "swgeoframe_" + requestId,
        iframe = document.createElement("iframe"),
        form = document.createElement("form");
      iframe.name = frameName;
      iframe.tabIndex = -1;
      iframe.setAttribute("aria-hidden", "true");
      Object.assign(iframe.style, {
        position: "fixed",
        width: "1px",
        height: "1px",
        opacity: "0",
        pointerEvents: "none",
        left: "-9999px",
        top: "-9999px",
      });
      form.method = "POST";
      form.action = endpoint;
      form.target = frameName;
      form.style.display = "none";
      function add(name, value) {
        var i = document.createElement("input");
        i.type = "hidden";
        i.name = name;
        i.value = String(value == null ? "" : value);
        form.appendChild(i);
      }
      add("transport", "iframe");
      add("requestId", requestId);
      add("returnOrigin", location.origin);
      add("action", action);
      add("payload", JSON.stringify(payload || {}));
      var timer = 0;
      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        form.remove();
        setTimeout(function () {
          iframe.remove();
        }, 40);
      }
      function onMessage(e) {
        var d = e.data;
        if (!d || d.source !== "SIGNWELL_GAS" || d.requestId !== requestId)
          return;
        cleanup();
        d.ok
          ? resolve(d.data || {})
          : reject(new Error(d.error || "backend error"));
      }
      window.addEventListener("message", onMessage);
      timer = setTimeout(function () {
        cleanup();
        reject(new Error("backend timeout"));
      }, timeoutMs || 12000);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  function refreshImpactTrace(payload, overlay) {
    if (!payload || !payload.articleId || !overlay) return;
    publicBridge("article.trace", { articleId: payload.articleId }, 9000)
      .then(function (trace) {
        payload._impactTrace = trace || null;
        renderImpact(payload, overlay);
      })
      .catch(function () {
        var label = q("[data-swid-impact-label]", overlay);
        if (label && !payload._impactTrace) label.textContent = "影響資料暫時無法同步";
      });
  }

  function refreshGeo(payload, overlay) {
    if (!payload || (!payload.articleId && !payload.slug) || !overlay) return;
    publicBridge(
      "geo.article",
      {
        articleId: payload.articleId || "",
        slug: payload.slug || currentSlug() || "",
      },
      9000,
    )
      .then(function (r) {
        var citations = Number(r.verifiedCitationCount || 0),
          referrals = Number(r.aiReferralCount || 0);
        qa("[data-swid-geo-citations]", overlay).forEach(function (el) {
          el.textContent = String(citations);
        });
        qa("[data-swid-geo-referrals]", overlay).forEach(function (el) {
          el.textContent = String(referrals);
        });
        var c = q("[data-swid-geo-checked]", overlay);
        if (c)
          c.textContent = fmtDate(r.generatedAt || new Date().toISOString());
        payload.geo = payload.geo || {};
        payload.geo.verifiedCitationCount = citations;
        payload.geo.aiReferralCount = referrals;
        payload.geo.checkedAt = r.generatedAt || payload.geo.checkedAt;
        renderImpact(payload, overlay);
      })
      .catch(function () {});
  }
  function aiReferrerProvider() {
    if (!document.referrer) return "";
    try {
      var h = new URL(document.referrer).hostname.toLowerCase();
      if (
        h === "chatgpt.com" ||
        h === "chat.openai.com" ||
        h.endsWith(".chatgpt.com")
      )
        return "ChatGPT";
      if (h === "gemini.google.com" || h.endsWith(".gemini.google.com"))
        return "Gemini";
      if (h === "perplexity.ai" || h.endsWith(".perplexity.ai"))
        return "Perplexity";
      if (h === "copilot.microsoft.com" || h.endsWith(".copilot.microsoft.com"))
        return "Copilot";
      if (h === "claude.ai" || h.endsWith(".claude.ai")) return "Claude";
      if (h === "you.com" || h.endsWith(".you.com")) return "Other";
      return "";
    } catch (_) {
      return "";
    }
  }
  function trackAiReferral(payload) {
    var provider = aiReferrerProvider(),
      slug = String((payload && payload.slug) || currentSlug() || "").trim();
    if (!provider || !slug) return;
    var key = "sw-geo-referral:" + provider + ":" + slug;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch (_) {}
    publicBridge(
      "analytics.track",
      { kind: "ai_referral", key: provider + "|" + slug, eventId: key },
      7000,
    ).catch(function () {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });
  }

  function allowedHost(host) {
    host = String(host || "").toLowerCase();
    var cur = location.hostname.toLowerCase();
    return (
      host === cur ||
      host === "980510linz.github.io" ||
      host === "signwell.com.tw" ||
      host === "www.signwell.com.tw"
    );
  }
  function routeFromQr(raw) {
    var text = String(raw || "").trim();
    if (!text) return null;

    // Unified resolver from Public core: accepts direct Article ID, ID URL, or article URL.
    try {
      var resolver = window.SignWellArticleResolver;
      if (resolver && typeof resolver.resolve === "function") {
        var hit = resolver.resolve(text);
        if (hit && hit.slug) return { slug: hit.slug, articleId: hit.articleId || "", url: hit.url };
      }
    } catch (_) {}

    // Fallback kept for pages where Public core has not initialized yet.
    try {
      var u = new URL(text, location.href);
      if (!allowedHost(u.hostname)) return null;
      var slug = u.searchParams.get("article");
      if (!slug) {
        var m = u.pathname.match(/\/article\/([^/]+)\/?$/i);
        if (m) slug = decodeURIComponent(m[1]);
      }
      if (!slug) return null;
      return {
        slug: slug,
        url: new URL(
          "index.html?article=" + encodeURIComponent(slug),
          location.href,
        ).href,
      };
    } catch (_) {
      return null;
    }
  }
  function scanWithNative(bitmap) {
    if (!("BarcodeDetector" in window)) return Promise.resolve(null);
    try {
      var d = new BarcodeDetector({ formats: ["qr_code"] });
      return d
        .detect(bitmap)
        .then(function (x) {
          return x && x[0] && x[0].rawValue ? x[0].rawValue : null;
        })
        .catch(function () {
          return null;
        });
    } catch (_) {
      return Promise.resolve(null);
    }
  }
  function scanWithJsQr(bitmap) {
    return ensureJsQr().then(function () {
      var c = document.createElement("canvas"),
        ctx = c.getContext("2d", { willReadFrequently: true });
      c.width = bitmap.width;
      c.height = bitmap.height;
      ctx.drawImage(bitmap, 0, 0);
      var im = ctx.getImageData(0, 0, c.width, c.height),
        out = window.jsQR(im.data, im.width, im.height, {
          inversionAttempts: "attemptBoth",
        });
      return out && out.data ? out.data : null;
    });
  }
  function fileBitmap(file) {
    if (typeof createImageBitmap === "function") return createImageBitmap(file);
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () {
        reject(new Error("無法讀取圖片"));
      };
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          reject(new Error("無法解析圖片"));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  function scanFile(file) {
    if (!file || !/^image\//i.test(file.type || ""))
      return Promise.reject(new Error("請選擇 QR Code 圖片"));
    return fileBitmap(file).then(function (bitmap) {
      return scanWithNative(bitmap)
        .then(function (v) {
          return v || scanWithJsQr(bitmap);
        })
        .finally(function () {
          try {
            if (bitmap && typeof bitmap.close === "function") bitmap.close();
          } catch (_) {}
        });
    });
  }
  function findSearch() {
    return (
      q("#searchInput") ||
      q('input[type="search"]') ||
      q(".searchbar input") ||
      q("[data-search] input")
    );
  }
  function mountHomeScanner() {
    if (currentSlug()) return false;
    var input = findSearch();
    if (!input || q("[data-swid-scan-wrap]")) return false;
    var wrap = document.createElement("span");
    wrap.className = "swid-scan-wrap";
    wrap.setAttribute("data-swid-scan-wrap", "1");
    wrap.innerHTML =
      '<button class="swid-scan-btn" type="button" data-swid-scan>掃 QR 圖片</button><input type="file" accept="image/*" hidden data-swid-file><span class="swid-scan-status" aria-live="polite"></span>';
    var box = input.parentElement || input;
    box.appendChild(wrap);
    var file = q("[data-swid-file]", wrap),
      status = q(".swid-scan-status", wrap),
      btn = q("[data-swid-scan]", wrap);
    function use(f) {
      status.textContent = "掃描中…";
      scanFile(f)
        .then(function (raw) {
          var route = routeFromQr(raw);
          if (!route) throw new Error("這不是 SIGN-WELL 文章 QR");
          status.textContent = "找到文章，正在開啟…";
          location.href = route.url;
        })
        .catch(function (e) {
          status.textContent = e && e.message ? e.message : "無法辨識 QR";
        });
    }
    btn.onclick = function () {
      file.click();
    };
    file.onchange = function () {
      if (file.files && file.files[0]) use(file.files[0]);
      file.value = "";
    };
    box.addEventListener("dragover", function (e) {
      if (
        e.dataTransfer &&
        Array.prototype.some.call(e.dataTransfer.items || [], function (i) {
          return i.kind === "file";
        })
      ) {
        e.preventDefault();
        box.classList.add("swid-drop-active");
      }
    });
    box.addEventListener("dragleave", function () {
      box.classList.remove("swid-drop-active");
    });
    box.addEventListener("drop", function (e) {
      box.classList.remove("swid-drop-active");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        e.preventDefault();
        use(f);
      }
    });
    return true;
  }
  function mountScannerWhenReady() {
    if (mountHomeScanner()) return;
    var root = document.body || document.documentElement;
    if (!root) return;
    var done = false,
      obs = new MutationObserver(function () {
        if (done) return;
        if (mountHomeScanner()) {
          done = true;
          obs.disconnect();
        }
      });
    obs.observe(root, { childList: true, subtree: true });
    setTimeout(function () {
      if (!done) {
        done = true;
        obs.disconnect();
        mountHomeScanner();
      }
    }, 10000);
  }
  function init() {
    hideLegacyQr();
    var cur = window.SIGNWELL_CURRENT_ARTICLE;
    if (cur && cur.slug && cur.slug === currentSlug()) {
      /* public shell already loaded this article: no second fetch, and the
         card inherits article-level fallbacks (title, category, summary). */
      var cp = normalizePayload(cur);
      mountButton(cp);
      trackAiReferral(cp);
      return;
    }
    if (window.SIGNWELL_ARTICLE_ID_CARD) {
      var p = normalizePayload({
        articleIdCard: window.SIGNWELL_ARTICLE_ID_CARD,
      });
      mountButton(p);
      trackAiReferral(p);
      return;
    }
    mountDynamicArticle().then(function (found) {
      if (found) return;
      mountScannerWhenReady();
    });
  }
  window.SignWellArticleIdCard = {
    version: VERSION,
    open: function (p) {
      openOverlay(
        normalizePayload({
          articleIdCard: p || window.SIGNWELL_ARTICLE_ID_CARD || {},
        }),
      );
    },
    close: closeOverlay,
    scanFile: scanFile,
    routeFromQr: routeFromQr,
    mountHomeScanner: mountHomeScanner,
    normalizePayload: normalizePayload,
    aiReferrerProvider: aiReferrerProvider,
    init: init,
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else setTimeout(init, 0);
})();

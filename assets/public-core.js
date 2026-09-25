/* SIGN WELL · 欣緯生醫 — Public core (release 24.36.3 · ui 25.1 · newsletter cleanup R8B · R9.2.1 Hero Studio)
   Routing, rendering, search, newsletter/OTP bridge and the Liquid dock.
   Backend protocol (Apps Script iframe bridge) is unchanged from 24.36.3. */
(() => {
  "use strict";
  const VERSION = "24.36.3";
  const UI_VERSION = "25.1";
  const PAGES = ["home", "topics", "about", "share", "newsletter"];
  const FILE = {
    home: "index.html",
    topics: "topics.html",
    about: "about.html",
    share: "share.html",
    newsletter: "newsletter.html",
  };
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const DEFAULT = window.SIGNWELL_SITE_TEXT || {};
  const HERO_DEFAULT = Object.freeze({spinRate:.24,ringSize:.78,tube:.36,ior:1.40,iorFresnel:1.50,dispersion:.018,baseRoll:36,baseTilt:-52,textZ:-.22,jelly:1,floatAmp:.020,ringLift:.10,word:"SIGN WELL"});
  const HERO_LIMITS = Object.freeze({spinRate:[.02,.60],ringSize:[.55,.94],tube:[.20,.52],ior:[1.02,1.75],iorFresnel:[.50,2.40],dispersion:[0,.050],baseRoll:[-90,90],baseTilt:[-80,-15],textZ:[-.65,.40],jelly:[0,2.20],floatAmp:[0,.060],ringLift:[-.08,.26]});
  const normalizeHeroConfig = (value) => {const x=value&&typeof value==="object"?value:{},out={...HERO_DEFAULT};Object.entries(HERO_LIMITS).forEach(([k,[lo,hi]])=>{const n=Number(x[k]);if(Number.isFinite(n))out[k]=Math.min(hi,Math.max(lo,n));});const word=String(x.word??out.word).trim().slice(0,28);out.word=word||"SIGN WELL";return out;};
  const reducedMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const INTRO_T0 = performance.now();
  let site = { ...DEFAULT },
    heroConfig = { ...HERO_DEFAULT },
    articles = [],
    topics = [],
    people = [],
    articleCache = new Map(),
    routeBusy = false,
    dataReady = false,
    renderedSlug = "",
    routeKey = location.pathname + location.search,
    dock = null,
    searchFilter = null,
    searchScope = "all";

  /* ------------------------------------------------------------------ utils */
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  /* Empty input must stay empty (previously resolved to the current page URL,
     which rendered broken <img> tags for articles / authors without media). */
  const safeUrl = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    try {
      const u = new URL(s, location.href);
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch (_) {
      return "";
    }
  };
  const fileOf = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const pageFromFile = (f) =>
    f === "topics.html"
      ? "topics"
      : f === "about.html"
        ? "about"
        : f === "share.html"
          ? "share"
          : f === "newsletter.html"
            ? "newsletter"
            : "home";
  const slugFromUrl = () => {
    const u = new URL(location.href),
      q = u.searchParams.get("article");
    if (q) return q;
    const m = u.pathname.match(/\/article\/([^/]+)\/?$/i);
    return m ? decodeURIComponent(m[1]) : "";
  };
  const hash = (s) => {
    let h = 2166136261;
    for (const ch of String(s || "")) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const HUES = [205, 152, 28, 340, 188];
  const hueOf = (s) => HUES[hash(s) % HUES.length];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dateOf = (a) => new Date(a?.publishedAt || a?.updatedAt || 0);
  const byDate = (a, b) => dateOf(b) - dateOf(a);
  const articleIdOf = (a) => String(a?.articleId || a?.article_id || a?.id || "").trim();
  const articleIdKey = (v) =>
    String(v ?? "")
      .toUpperCase()
      .replace(/[–—−]/g, "-")
      .replace(/[^A-Z0-9]/g, "");
  const allowedArticleHost = (host) => {
    const h = String(host || "").toLowerCase();
    const cur = String(location.hostname || "").toLowerCase();
    return !h || h === cur || h === "980510linz.github.io" || h === "signwell.com.tw" || h === "www.signwell.com.tw";
  };
  function resolveArticleRef(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return null;

    // 1) Direct Article ID (hyphens/spaces/case are ignored).
    const idKey = articleIdKey(text);
    if (idKey) {
      const byId = articles.find((a) => articleIdKey(articleIdOf(a)) === idKey);
      if (byId?.slug)
        return {
          type: "articleId",
          exact: true,
          article: byId,
          slug: byId.slug,
          articleId: articleIdOf(byId),
          url: new URL("index.html?article=" + encodeURIComponent(byId.slug), location.href).href,
        };
    }

    // 2) SIGN WELL article URL (supports ?article=, /article/slug, and ?articleId=).
    try {
      const u = new URL(text, location.href);
      if (!allowedArticleHost(u.hostname)) return null;
      const urlArticleId = u.searchParams.get("articleId") || u.searchParams.get("article_id") || "";
      if (urlArticleId) {
        const k = articleIdKey(urlArticleId);
        const byId = articles.find((a) => articleIdKey(articleIdOf(a)) === k);
        if (byId?.slug)
          return {
            type: "articleIdUrl",
            exact: true,
            article: byId,
            slug: byId.slug,
            articleId: articleIdOf(byId),
            url: new URL("index.html?article=" + encodeURIComponent(byId.slug), location.href).href,
          };
      }
      let slug = u.searchParams.get("article") || "";
      if (!slug) {
        const m = u.pathname.match(/\/article\/([^/]+)\/?$/i);
        if (m) slug = decodeURIComponent(m[1]);
      }
      if (slug) {
        const a = articles.find((x) => String(x.slug || "") === String(slug));
        return {
          type: "url",
          exact: true,
          article: a || null,
          slug,
          articleId: a ? articleIdOf(a) : "",
          url: new URL("index.html?article=" + encodeURIComponent(slug), location.href).href,
        };
      }
    } catch (_) {}
    return null;
  }
  window.SignWellArticleResolver = {
    resolve: resolveArticleRef,
    articleIdKey,
    articleIdOf,
    version: "R8G",
  };

  const QRCODE_URL = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  const canDesktopTilt = () =>
    !!(
      window.innerWidth >= 980 &&
      matchMedia("(pointer:fine)").matches &&
      !reducedMQ.matches
    );
  function loadScript(url, test) {
    if (typeof test === 'function' && test()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const ex = document.querySelector('script[data-sw-src="' + url + '"]');
      if (ex) {
        ex.addEventListener('load', () => resolve(), { once: true });
        ex.addEventListener('error', () => reject(new Error('load failed')), { once: true });
        if (!test || test()) resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.dataset.swSrc = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    });
  }
  function ensureQrLib() {
    return loadScript(QRCODE_URL, () => !!window.QRCode);
  }
  function protectVisualAsset(el) {
    if (!el || el.dataset.assetLocked === '1') return;
    el.dataset.assetLocked = '1';
    el.setAttribute('aria-label', (el.getAttribute('aria-label') || '') + '');
    Object.assign(el.style, {
      WebkitUserSelect: 'none',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitUserDrag: 'none',
      touchAction: 'manipulation',
    });
    ['contextmenu', 'dragstart', 'selectstart'].forEach((type) => {
      el.addEventListener(type, (e) => e.preventDefault());
    });
    const touchBlock = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener('touchstart', touchBlock, { passive: false });
    el.addEventListener('touchend', () => {}, { passive: true });
  }
  function mountPageQr(el, text, opts = {}) {
    if (!el || !text) return;
    const value = String(text);
    if (el.dataset.qrValue === value && el.querySelector('canvas,img')) {
      protectVisualAsset(el);
      return;
    }
    el.dataset.qrValue = value;
    el.innerHTML = '<span class="share-qr-placeholder">QR 建立中…</span>';
    ensureQrLib().then(() => {
      el.innerHTML = '';
      new window.QRCode(el, {
        text: value,
        width: opts.size || 188,
        height: opts.size || 188,
        colorDark: opts.dark || '#142236',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      setTimeout(() => {
        protectVisualAsset(el);
        $('canvas,img', el).forEach((node) => {
          node.setAttribute('draggable', 'false');
          node.setAttribute('aria-hidden', 'true');
          Object.assign(node.style, {
            pointerEvents: 'none',
            WebkitUserDrag: 'none',
            WebkitTouchCallout: 'none',
            userSelect: 'none',
          });
        });
      }, 20);
    }).catch(() => {
      delete el.dataset.qrValue;
      el.innerHTML = '<span class="share-qr-placeholder">QR 載入失敗<br>請改用複製連結</span>';
    });
  }
  function mountTiltCard(card) {
    if (!card || card.dataset.tiltReady === '1') return;
    card.dataset.tiltReady = '1';
    const scene = card.closest('.sw3d-scene') || card.parentElement;
    const ambient = scene ? scene.querySelector('.sw3d-ambient') : null;
    const shadow = scene ? scene.querySelector('.sw3d-shadow') : null;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, active = false;
    const maxX = 13, maxY = 16;
    function applyVars(nx, ny) {
      const mx = 50 + nx * 32;
      const my = 44 + ny * 30;
      card.style.setProperty('--sw3d-mx', mx + '%');
      card.style.setProperty('--sw3d-my', my + '%');
      card.style.setProperty('--sw3d-ex', (nx * 16).toFixed(2) + 'px');
      card.style.setProperty('--sw3d-ey', (ny * 16).toFixed(2) + 'px');
      if (shadow) {
        shadow.style.setProperty('--sw3d-sx', (-nx * 28).toFixed(2) + 'px');
        shadow.style.setProperty('--sw3d-sy', (ny * 12).toFixed(2) + 'px');
      }
      if (ambient) {
        ambient.style.setProperty('--sw3d-gx', mx + '%');
        ambient.style.setProperty('--sw3d-gy', my + '%');
      }
    }
    function setTarget(clientX, clientY) {
      if (!canDesktopTilt()) return reset(true);
      const r = card.getBoundingClientRect();
      const nx = clamp(((clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const ny = clamp(((clientY - r.top) / r.height) * 2 - 1, -1, 1);
      targetY = nx * maxY;
      targetX = -ny * maxX;
      applyVars(nx, ny);
      card.dataset.tilt = '1';
      if (scene) scene.dataset.tilt = '1';
    }
    function reset(immediate = false) {
      active = false;
      targetX = 0;
      targetY = 0;
      applyVars(0, 0);
      if (immediate) {
        currentX = 0;
        currentY = 0;
        card.style.setProperty('--sw3d-rx', '0deg');
        card.style.setProperty('--sw3d-ry', '0deg');
      }
      card.dataset.tilt = '0';
      if (scene) scene.dataset.tilt = '0';
    }
    card.addEventListener('pointerenter', (e) => {
      if (!canDesktopTilt() || e.pointerType !== 'mouse') return;
      active = true;
      setTarget(e.clientX, e.clientY);
    });
    card.addEventListener('pointermove', (e) => {
      if (!canDesktopTilt() || e.pointerType !== 'mouse') return;
      active = true;
      setTarget(e.clientX, e.clientY);
    });
    card.addEventListener('pointerleave', () => reset(false));
    window.addEventListener('resize', () => reset(true));
    (function animate() {
      const ease = active ? 0.11 : 0.08;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      card.style.setProperty('--sw3d-rx', currentX.toFixed(3) + 'deg');
      card.style.setProperty('--sw3d-ry', currentY.toFixed(3) + 'deg');
      requestAnimationFrame(animate);
    })();
    reset(true);
  }
  function mountPublicTiltAndQr() {
    $('[data-tilt-card]').forEach(mountTiltCard);
    $('[data-qr-lock]').forEach((el) => protectVisualAsset(el));
  }


  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowUR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.6"/><path d="m16 16 4.2 4.2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>',
    id: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M6.2 16c.6-1.6 1.6-2.3 2.8-2.3s2.2.7 2.8 2.3M14.5 10h3.5M14.5 13.5h3.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.6"/><path d="m5.5 8 6.5 5 6.5-5"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  };
  const ECG = [
    "M0 62H64l7-6 6 6h22l6 16 10-58 10 54 6-12h40l8-7 8 7h46l6 16 10-58 10 54 6-12h40l7-6 6 6H400",
    "M0 60H40l7-5 6 5h40l6 14 10-52 10 50 6-14h52l8-6 8 6h30l6 14 10-52 10 50 6-14h48l7-5 6 5H400",
  ];
  const COVER_SETS = [
    ["#eaf2f9", "#b9d6ee", "#d6ebdf", "#f3dde6"],
    ["#edf5f0", "#bddbc9", "#dce8f4", "#f2e5d4"],
    ["#f7f0e8", "#e5cdae", "#dce9f3", "#f1dee4"],
    ["#f9eef2", "#ebc6d3", "#dae7f3", "#e2eee5"],
    ["#eef1f9", "#c7cfee", "#d5eae5", "#f4e3d5"],
  ];
  function genCover(a, { label = true } = {}) {
    const h = hash(a.slug || a.title),
      set = COVER_SETS[h % COVER_SETS.length];
    const gx = 12 + (h % 50),
      gy = 4 + ((h >> 6) % 30);
    const cat = String(a.category || "SIGN WELL");
    return `<div class="gen-cover" aria-hidden="true" style="--g0:${set[0]};--g1:${set[1]};--g2:${set[2]};--g3:${set[3]};--gx:${gx}%;--gy:${gy}%"><svg viewBox="0 0 400 100" preserveAspectRatio="none"><path d="${ECG[(h >> 3) % ECG.length]}"/></svg>${label ? `<b>${esc(Array.from(cat).slice(0, 5).join(""))}</b>` : ""}</div>`;
  }
  function coverMedia(a, { label = true, eager = false } = {}) {
    const cover = safeUrl(a.cover);
    return cover
      ? `<img src="${esc(cover)}" alt="" loading="${eager ? "eager" : "lazy"}" decoding="async">`
      : genCover(a, { label });
  }

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2000);
  }
  async function jsonFetch(path, fallback) {
    try {
      const r = await fetch(path, { cache: "no-cache" });
      if (!r.ok) throw 0;
      return await r.json();
    } catch (_) {
      return fallback;
    }
  }

  /* ------------------------------------------------------------- bootstrap */
  async function bootstrap() {
    const [bundle, idx, tp] = await Promise.all([
      jsonFetch("public-data.json", {}),
      jsonFetch("articles/index.json", []),
      jsonFetch("topics/index.json", []),
    ]);
    site = { ...DEFAULT, ...(bundle.siteText || {}) };
    heroConfig = normalizeHeroConfig(bundle.heroConfig);
    window.SignWellHeroConfig = { ...heroConfig };
    try { window.SignWellLiquidHero?.config?.(heroConfig); } catch (_) {}
    people = Array.isArray(bundle.people) ? bundle.people : [];
    topics = Array.isArray(tp) && tp.length ? tp : Array.isArray(bundle.topics) ? bundle.topics : [];
    articles = Array.isArray(idx) ? idx : [];
    dataReady = true;
    applyBrand();
    renderCurrent(false, { refresh: true });
    idlePrefetch();
    trackPage();
  }
  function applyBrand() {
    const be = $("#brandEnglish"),
      bc = $("#brandChinese");
    if (be) be.textContent = site.brandEnglish || "SIGN WELL";
    if (bc) bc.textContent = site.brandChinese || "欣緯生醫";
    const f = $("#footerBrand");
    if (f) f.textContent = site.siteTitle || "SIGN WELL · 欣緯生醫";
    const ft = $("#footerTagline");
    if (ft) ft.textContent = site.footerTagline || "";
    const fd = $("#footerDisclaimer");
    if (fd) fd.textContent = site.footerDisclaimer || "";
    const si = $("#searchInput");
    if (si) {
      const configured = String(site.searchPlaceholder || "搜尋文章、主題、關鍵字…").trim();
      si.placeholder = /article\s*id/i.test(configured) ? configured : configured.replace(/…?$/, "") + "、Article ID…";
    }
  }

  /* --------------------------------------------------------------- routing */
  function currentPage() {
    return slugFromUrl() ? "article" : pageFromFile(fileOf());
  }
  function activeIndex() {
    const p = currentPage();
    return p === "article" ? 0 : Math.max(0, PAGES.indexOf(p));
  }
  function setActive(i) {
    $$("#pager > .pager-items .nav-item").forEach((b, n) => {
      b.classList.toggle("active", n === i);
      b.setAttribute("aria-current", n === i ? "page" : "false");
    });
    const rail = $("#pager");
    if (rail) {
      rail.setAttribute("aria-valuenow", String(i));
      rail.setAttribute("aria-valuetext", $$("#pager > .pager-items .nav-item")[i]?.textContent?.trim() || "");
    }
  }
  function updateThumb(i, animate = true) {
    if (dock) dock.setIndex(i, animate);
  }
  function saveScroll() {
    try {
      history.replaceState({ ...(history.state || {}), scroll: Math.round(scrollY) }, "");
    } catch (_) {}
  }

  /* View-transition shared elements (card → article morph). */
  const VT = { cover: "sw-hero-cover", title: "sw-hero-title" };
  function nameEl(el, name) {
    if (el) el.style.viewTransitionName = name;
  }
  function clearMorph() {
    $$("[style*='view-transition-name']", app).forEach((el) => (el.style.viewTransitionName = ""));
  }
  function inView(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  }
  let pendingMorph = null;
  function tagCardMorph(card) {
    const out = { cover: false, title: false };
    if (!card) return out;
    const img = card.querySelector(".cover img, .thumb img");
    if (img && inView(img)) {
      nameEl(img, VT.cover);
      out.cover = true;
    }
    const t = card.querySelector("h3, h4, b");
    if (t && inView(t)) {
      nameEl(t, VT.title);
      out.title = true;
    }
    return out;
  }

  function renderCurrent(transition = true, opts = {}) {
    const leaving = renderedSlug;
    const restore = typeof opts.scroll === "number" ? opts.scroll : null;
    const go = async () => {
      routeKey = location.pathname + location.search;
      const p = currentPage();
      setActive(activeIndex());
      updateThumb(activeIndex(), !opts.refresh);
      if (p === "article") await renderArticle(slugFromUrl());
      else {
        renderedSlug = "";
        if (p === "topics") renderTopics();
        else if (p === "about") renderAbout();
        else if (p === "share") renderShare();
        else if (p === "newsletter") renderNewsletter();
        else renderHome();
      }
      if (!opts.refresh) window.scrollTo({ top: restore || 0, behavior: "instant" });
      else if (restore != null) window.scrollTo({ top: restore, behavior: "instant" });
      /* morph back: article → the card it came from */
      if (transition && leaving && p !== "article") {
        tagCardMorph($(`[data-article="${CSS.escape(leaving)}"]`, app));
      }
      setTitle(p);
      document.dispatchEvent(new CustomEvent("signwell:render", { detail: { page: p } }));
    };
    const canVT = transition && document.startViewTransition && !reducedMQ.matches && !document.hidden;
    if (!canVT) pendingMorph = null;
    if (canVT) {
      if (leaving && currentPage() !== "article") {
        nameEl($(".article-cover", app), VT.cover);
        nameEl($(".article-head h1", app), VT.title);
      }
      let vt;
      try {
        vt = document.startViewTransition(() => go());
      } catch (_) {
        clearMorph();
        go();
        return;
      }
      vt.finished
        .finally(() => {
          pendingMorph = null;
          clearMorph();
        })
        .catch(() => {});
    } else go();
  }
  function setTitle(p) {
    const brand = site.siteTitle || "SIGN WELL · 欣緯生醫";
    const part =
      p === "article"
        ? $(".article-head h1", app)?.textContent || ""
        : { topics: site.topicsTitle || "主題分類", about: site.aboutTitle ? `關於${site.aboutTitle}` : "關於", share: "分享", newsletter: "電子報" }[p] || "";
    document.title = part && !/載入中|找不到/.test(part) ? `${part}｜${brand}` : brand;
  }
  function navigate(page, { replace = false, params = null } = {}) {
    if (routeBusy) return;
    const url = new URL(FILE[page] || "index.html", location.href);
    url.search = "";
    url.hash = "";
    if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    if (!replace && url.href === location.href) {
      window.scrollTo({ top: 0, behavior: reducedMQ.matches ? "auto" : "smooth" });
      return;
    }
    if (!replace) saveScroll();
    (replace ? history.replaceState : history.pushState).call(history, { page }, "", url);
    renderCurrent(true);
    trackPage();
  }
  function articleNavigate(slug, source) {
    saveScroll();
    const u = new URL("index.html", location.href);
    u.searchParams.set("article", slug);
    clearMorph();
    pendingMorph = source && document.startViewTransition && !reducedMQ.matches ? tagCardMorph(source) : null;
    history.pushState({ article: slug }, "", u);
    renderCurrent(true);
    trackPage();
  }
  function topicNavigate(slug) {
    navigate("topics", { params: { topic: slug } });
  }

  /* ------------------------------------------------------------ formatting */
  function fmtDate(v) {
    if (!v) return "";
    try {
      return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));
    } catch (_) {
      return String(v);
    }
  }
  function mmdd(v) {
    const d = new Date(v || 0);
    if (!v || isNaN(d)) return "—";
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }
  function reading(a) {
    return Math.max(1, Number(a.readingTime || 1));
  }

  /* ---------------------------------------------------------------- pieces */
  function articleCard(a, { eager = false } = {}) {
    const tags = (a.tags || []).slice(0, 3);
    return `<article class="article-card" data-article="${esc(a.slug)}"><div class="cover">${coverMedia(a, { eager })}${a.category ? `<span class="card-chip">${esc(a.category)}</span>` : ""}</div><div class="card-body"><div class="card-meta">${a.publishedAt || a.updatedAt ? `<time>${esc(fmtDate(a.publishedAt || a.updatedAt))}</time><span class="dot"></span>` : ""}<span>${ICON.clock} ${reading(a)} 分鐘</span></div><h3>${esc(a.title || "未命名文章")}</h3><p>${esc(a.excerpt || a.summary10s || "")}</p>${tags.length ? `<div class="tagrow">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : ""}</div><span class="card-arrow" aria-hidden="true">${ICON.arrowUR}</span></article>`;
  }
  function recentRow(a) {
    const d = dateOf(a),
      ok = !isNaN(d) && d.getTime() > 0;
    return `<div class="recent-row" data-article="${esc(a.slug)}"><div class="date"><b>${ok ? String(d.getDate()).padStart(2, "0") : "—"}</b><span>${ok ? `${d.getMonth() + 1} 月` : ""}</span></div><div><h4>${esc(a.title || "未命名文章")}</h4><small>${esc(a.excerpt || a.summary10s || "")}</small></div><span class="cat">${esc(a.category || "醫學筆記")}</span><span class="go" aria-hidden="true">${ICON.arrow}</span></div>`;
  }
  function topicHue(t) {
    const i = topics.findIndex((x) => (x.slug || x.name) === (t.slug || t.name));
    return i >= 0 ? HUES[i % HUES.length] : hueOf(t.name);
  }
  function topicCard(t) {
    const count = articles.filter((a) => a.category === t.name).length;
    const name = String(t.name || "主題");
    return `<article class="topic-card" data-topic="${esc(t.slug || t.name)}" style="--h:${topicHue(t)}"><div class="topic-icon" aria-hidden="true">${esc(Array.from(name)[0] || "主")}</div><div><div class="kicker">TOPIC</div><h3>${esc(name)}</h3><p>${esc(t.description || "")}</p></div><div class="topic-foot"><span>${count} 篇文章</span><span class="go">查看 ${ICON.arrow}</span></div></article>`;
  }
  function skeletonCards(n = 3) {
    return Array.from({ length: n }, () => `<div class="article-card" aria-hidden="true" style="cursor:default"><div class="cover skeleton"></div><div class="card-body"><div class="skeleton sk-line" style="width:40%"></div><div class="skeleton sk-line" style="height:22px;width:88%"></div><div class="skeleton sk-line" style="width:70%"></div></div></div>`).join("");
  }
  function sectionHead(idx, eyebrow, title, right = "") {
    return `<div class="section-head"><div><div class="eyebrow"><span class="idx">${idx}</span>${esc(eyebrow)}</div><h2>${esc(title)}</h2></div>${right ? `<p>${right}</p>` : ""}</div>`;
  }
  function emptyPanel(text) {
    return `<div class="panel" style="padding:28px;grid-column:1/-1;color:var(--muted)">${esc(text)}</div>`;
  }

  /* ------------------------------------------------------------------ home */
  function renderHome() {
    /* first-load intro: a re-render (data arrival) resumes the animation mid-way */
    if (document.documentElement.classList.contains("sw-intro"))
      document.documentElement.style.setProperty("--intro-t", `${-Math.round(performance.now() - INTRO_T0)}ms`);
    const sorted = articles.slice().sort(byDate);
    const featured = articles.filter((a) => a.featured).slice(0, 3);
    const lead = (featured.length ? featured : sorted).slice(0, 3);
    const rest = sorted.filter((a) => !lead.includes(a)).slice(0, 4);
    const latest = sorted[0];
    const activeTopics = topics.filter((t) => t.active !== false);
    const t1 = site.homeTitle1 || "從臨床出發，",
      t2 = site.homeTitle2 || "把醫學寫清楚。";
    const stats = dataReady && !articles.length
      ? ""
      : dataReady
      ? `<div class="hero-stats"><div class="stat"><b data-count="${articles.length}">${articles.length}</b><span>篇文章</span></div><div class="stat"><b data-count="${activeTopics.length}">${activeTopics.length}</b><span>個主題</span></div><div class="stat"><b>${latest ? mmdd(latest.publishedAt || latest.updatedAt) : "—"}</b><span>最近更新</span></div></div>`
      : `<div class="hero-stats" aria-hidden="true"><div class="stat"><b class="skeleton" style="width:44px;height:28px"></b><span>篇文章</span></div><div class="stat"><b class="skeleton" style="width:34px;height:28px"></b><span>個主題</span></div><div class="stat"><b class="skeleton" style="width:64px;height:28px"></b><span>最近更新</span></div></div>`;
    app.innerHTML = `<section class="sw-liquid-hero" data-liquid-hero aria-label="SIGN WELL Liquid Glass 動態主視覺"><canvas aria-hidden="true"></canvas><div class="liquid-caustic" aria-hidden="true"></div><div class="liquid-grain" aria-hidden="true"></div><div class="liquid-static-word" aria-hidden="true">SIGN WELL</div><div class="liquid-hero-caption" aria-hidden="true">Explore</div></section><section class="hero" data-hero><div class="hero-copy"><div class="hero-badge"><i aria-hidden="true"></i>${esc(site.homeEyebrow || "SIGN WELL")}</div><h1 aria-label="${esc(t1 + t2)}"><span class="l1" aria-hidden="true">${esc(t1)}</span><span class="l2" aria-hidden="true">${esc(t2)}</span></h1><p>${esc(site.homeSubtitle || "")}</p>${stats}</div><aside class="hero-card"><span class="quote-mark" aria-hidden="true">“</span><span class="note-chip">EDITORIAL NOTE</span><strong>${esc(site.homeCardTitle || "醫學不只是答案。")}</strong><p>${esc(site.homeCardBody || "")}</p>${latest ? `<div class="hero-latest" data-article="${esc(latest.slug)}"><div class="thumb">${coverMedia(latest, { label: false, eager: true })}</div><div><small>最新發布</small><b>${esc(latest.title || "")}</b></div><span class="go" aria-hidden="true">${ICON.arrow}</span></div>` : ""}</aside></section><section class="section" id="latest">${sectionHead("01", site.dailyEyebrow || "最近整理", site.dailyTitle || "最新文章", `<span class="count">${dataReady ? `${articles.length} 篇已發布` : ""}</span>`)}<div class="bento">${!dataReady ? skeletonCards(3) : lead.length ? lead.map((a, i) => articleCard(a, { eager: i === 0 })).join("") : emptyPanel("目前尚無已發布文章。CMS 完整發布後會自動出現。")}</div>${rest.length ? `<div class="recent-list" aria-label="最近發布">${rest.map(recentRow).join("")}</div>` : ""}</section><section class="section">${sectionHead("02", site.topicsEyebrow || "知識地圖", site.topicsTitle || "主題分類")}<div class="topic-grid">${activeTopics.slice(0, 6).map(topicCard).join("") || (dataReady ? emptyPanel("尚未建立主題。") : "")}</div></section>`;
    bindCards();
  }

  /* ---------------------------------------------------------------- topics */
  function renderTopics() {
    const list = topics.filter((t) => t.active !== false);
    app.innerHTML = `<header class="page-hero"><div class="eyebrow">${esc(site.topicsEyebrow || "知識地圖")}</div><h1>${esc(site.topicsTitle || "主題分類")}</h1><p>${esc(site.topicsSubtitle || "依領域整理文章與延伸閱讀。")}</p></header><div class="topic-grid">${list.map(topicCard).join("") || (dataReady ? emptyPanel("尚未建立主題。") : "")}</div><section class="section" id="topicArticles" aria-live="polite"></section>`;
    $$("[data-topic]", app).forEach((el) => (el.onclick = () => selectTopic(el.dataset.topic, { scroll: true })));
    const q = new URL(location.href).searchParams.get("topic");
    if (q && dataReady) selectTopic(q, { scroll: true, replace: false });
  }
  function selectTopic(slug, { scroll = true, replace = true } = {}) {
    const t = topics.find((x) => (x.slug || x.name) === slug),
      list = articles.filter((a) => a.category === t?.name).sort(byDate);
    const sec = $("#topicArticles");
    if (!sec) return;
    $$("[data-topic]", app).forEach((el) => el.classList.toggle("is-active", el.dataset.topic === slug));
    sec.innerHTML = t
      ? `${sectionHead("·", t.name || "主題", "相關文章", `<span>${list.length} 篇</span>`)}<div class="cards">${list.map((a) => articleCard(a)).join("") || emptyPanel("這個主題目前沒有文章。")}</div>`
      : "";
    bindCards(sec);
    if (replace) {
      const u = new URL(location.href);
      u.searchParams.set("topic", slug);
      try {
        history.replaceState({ ...(history.state || {}), page: "topics" }, "", u);
        routeKey = location.pathname + location.search;
      } catch (_) {}
    }
    if (scroll && t) {
      requestAnimationFrame(() => sec.scrollIntoView({ behavior: reducedMQ.matches ? "auto" : "smooth", block: "start" }));
    }
  }
  // kept for backwards compatibility (older callers)
  function renderTopicArticles(slug) {
    selectTopic(slug, { scroll: true });
  }

  /* ----------------------------------------------------------------- about */
  function renderAbout() {
    const ppl = people.filter((p) => p.active !== false);
    app.innerHTML = `<header class="page-hero"><div class="eyebrow">${esc(site.aboutEyebrow || "關於 SIGN WELL")}</div><h1>${esc(site.aboutTitle || "欣緯生醫")}</h1><p>${esc(site.aboutBody || "")}</p></header><section class="panel manifesto"><div class="kicker">OUR PRINCIPLE</div><h2>${esc(site.aboutManifestoTitle || "把複雜的醫學寫清楚。")}</h2><p>${esc(site.aboutManifestoBody || "")}</p></section><section class="section">${sectionHead("01", site.aboutPeopleEyebrow || "PEOPLE", site.aboutPeopleTitle || "我們是誰")}${site.aboutPeopleSubtitle ? `<p style="margin:-10px 0 24px;color:var(--muted);max-width:640px">${esc(site.aboutPeopleSubtitle)}</p>` : ""}<div class="people-grid">${ppl.map(personCard).join("") || (dataReady ? emptyPanel("作者資料會由 CMS 同步。") : "")}</div></section>`;
  }
  function personCard(p) {
    const photo = safeUrl(p.photo),
      tags = (p.expertise || []).slice(0, 5),
      name = String(p.name || "SIGN WELL");
    return `<article class="person-card" style="--h:${hueOf(name)}"><div>${photo ? `<img class="avatar" src="${esc(photo)}" alt="${esc(name)}" loading="lazy" decoding="async">` : `<div class="avatar" aria-hidden="true">${esc(Array.from(name)[0] || "S")}</div>`}</div><div><div class="person-role">${esc(p.role || "")}</div><h3>${esc(name)}</h3><p>${esc(p.bio || "")}</p>${tags.length ? `<div class="person-tags">${tags.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}</div></article>`;
  }

  /* ----------------------------------------------------------------- share */
  function renderShare() {
    const url = new URL("index.html", location.href).href;
    const title = site.siteTitle || "SIGN WELL · 欣緯生醫";
    const enc = encodeURIComponent;
    app.innerHTML = `<header class="page-hero"><div class="eyebrow">${esc(site.shareEyebrow || "分享我們")}</div><h1>${esc(site.shareTitle || "把 SIGN WELL 分享給需要的人。")}</h1><p>${esc(site.shareSubtitle || "文章分享與 QR Code 已統一放在每篇文章的 Article ID Card。")}</p></header><div class="sw3d-scene share-scene"><div class="sw3d-ambient" aria-hidden="true"></div><div class="sw3d-shadow" aria-hidden="true"></div><section class="share-card sw3d-card" data-tilt-card><div class="share-grid"><div class="share-main"><div class="kicker">SIGN WELL</div><h1>分享網站</h1><div class="share-url"><input value="${esc(url)}" readonly id="shareSiteUrl" aria-label="網站連結"><button class="softbtn" id="copySite" type="button">${ICON.link} 複製連結</button></div><div class="share-buttons">${navigator.share ? `<button type="button" id="nativeShare">${ICON.share} 系統分享</button>` : ""}<a href="https://social-plugins.line.me/lineit/share?url=${enc(url)}" target="_blank" rel="noopener noreferrer"><i style="background:#06c755" aria-hidden="true"></i>分享到 LINE</a><a href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}" target="_blank" rel="noopener noreferrer"><i style="background:#1877f2" aria-hidden="true"></i>Facebook</a><a href="https://www.threads.net/intent/post?text=${enc(title + " " + url)}" target="_blank" rel="noopener noreferrer"><i style="background:#1d1d1f" aria-hidden="true"></i>Threads</a></div><p class="share-note">個別文章請開啟文章後使用「文章 ID 卡」。QR Code、作者、引用文獻、索引時間、GEO 與分享都集中在同一張卡片，不再維護另一套 QR 分享頁。</p></div><aside class="share-qr-pane"><div class="share-qr-card"><div class="share-qr-head"><span class="share-qr-kicker">SCAN TO OPEN</span><strong>SIGN WELL 網站 QR</strong></div><div class="share-qr" id="shareSiteQr" data-qr-lock aria-label="SIGN WELL 網站 QR Code"></div><div class="share-qr-id">SIGN WELL · SITE ROOT</div><div class="share-qr-hint">桌機版會跟隨滑鼠呈現類 3D 傾斜。QR 以 canvas 生成，不提供長按儲存。</div></div></aside></div></section></div>`;
    $("#copySite").onclick = async () => {
      await copyText(url);
      toast("已複製網站連結");
    };
    const ns = $("#nativeShare");
    if (ns) ns.onclick = () => navigator.share({ title, url }).catch(() => {});
    mountPageQr($("#shareSiteQr"), url, { size: 184, dark: "#163149" });
    mountPublicTiltAndQr();
  }

  /* ------------------------------------------------------- backend bridge */
  function backendConfig() {
    const n = window.SIGNWELL_NEWSLETTER || {},
      a = window.SIGNWELL_ANALYTICS || {};
    const endpoint = String(n.endpoint || a.endpoint || "").trim().replace(/\/+$/, "");
    return {
      endpoint,
      enabled: (n.enabled === true || a.enabled === true) && /^https:\/\/script\.google\.com\/macros\/s\//i.test(endpoint),
    };
  }
  function bridge(action, payload = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const c = backendConfig();
      if (!c.enabled) return reject(new Error("後端尚未完成同步"));
      const id = "swp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2),
        name = "swp_" + id,
        frame = document.createElement("iframe"),
        form = document.createElement("form");
      frame.name = name;
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", opacity: "0", left: "-9999px", top: "-9999px" });
      form.method = "POST";
      form.action = c.endpoint;
      form.target = name;
      form.style.display = "none";
      const add = (n, v) => {
        const i = document.createElement("input");
        i.type = "hidden";
        i.name = n;
        i.value = String(v ?? "");
        form.appendChild(i);
      };
      add("transport", "iframe");
      add("requestId", id);
      add("returnOrigin", location.origin);
      add("action", action);
      add("payload", JSON.stringify(payload || {}));
      let timer;
      const clean = () => {
        clearTimeout(timer);
        removeEventListener("message", on);
        form.remove();
        setTimeout(() => frame.remove(), 30);
      };
      const on = (e) => {
        const d = e.data;
        if (!d || d.source !== "SIGNWELL_GAS" || d.requestId !== id) return;
        clean();
        d.ok ? resolve(d.data || {}) : reject(new Error(d.error || "SIGN WELL Backend error"));
      };
      addEventListener("message", on);
      timer = setTimeout(() => {
        clean();
        reject(new Error("後端連線逾時"));
      }, timeout);
      document.body.append(frame, form);
      form.submit();
    });
  }
  function deviceId() {
    let v = "";
    try {
      v = localStorage.getItem("signwell-device-v2") || "";
      if (!/^[A-Za-z0-9_-]{24,}$/.test(v)) {
        v = "d_" + crypto.getRandomValues(new Uint32Array(4)).join("_") + "_" + Date.now().toString(36);
        localStorage.setItem("signwell-device-v2", v);
      }
    } catch (_) {
      v = "d_" + Date.now().toString(36) + "_" + Math.random().toString(36).repeat(3);
    }
    return v;
  }

  /* ------------------------------------------------------------ newsletter */
  let otp = { email: "", requestId: "", expiresAt: "", deviceId: "" };
  let newsletterTermsRead = false;
  let newsletterTermsReachedEnd = false;
  const NEWSLETTER_TERMS_VERSION = "2026-09-25-r1";
  function renderNewsletter() {
    const ready = backendConfig().enabled;
    const qrUrl = new URL("newsletter.html", location.href).href;
    newsletterTermsRead = false;
    newsletterTermsReachedEnd = false;
    app.innerHTML = `<div class="newsletter-experience newsletter-experience-compact">
      <div class="newsletter-bg-orb orb-a" aria-hidden="true"></div><div class="newsletter-bg-orb orb-b" aria-hidden="true"></div><div class="newsletter-bg-orb orb-c" aria-hidden="true"></div>
      <div class="sw3d-scene newsletter-scene newsletter-scene-compact"><div class="sw3d-ambient" aria-hidden="true"></div><div class="sw3d-shadow" aria-hidden="true"></div><section class="newsletter-card newsletter-card-compact sw3d-card" data-tilt-card>
        <div class="newsletter-card-grid newsletter-card-grid-compact"><div class="newsletter-main">
          <div class="kicker">SIGN WELL LETTER</div><h1>訂閱電子報</h1><p class="newsletter-lead">留下 Email，完成驗證後即可收到 SIGN WELL 發布內容。</p>
          <form class="newsletter-form" id="newsletterForm" novalidate><input id="newsletterEmail" type="email" autocomplete="email" inputmode="email" enterkeyhint="send" placeholder="you@example.com" aria-label="Email"><button class="newsletter-submit" id="newsletterSubmit" type="submit" disabled>寄送驗證碼</button></form>
          <label class="newsletter-consent locked" id="newsletterConsentLabel"><input id="newsletterConsent" type="checkbox" disabled><span>我已閱讀並同意 <button class="newsletter-terms-textlink" id="newsletterTermsOpen" type="button">服務條款</button>，並同意接收 SIGN WELL 電子報；隱私資料依 <a href="privacy.html" target="_blank" rel="noopener">隱私權政策</a> 處理。<small class="newsletter-terms-done" id="newsletterTermsState" aria-live="polite"></small></span></label>
          <div class="newsletter-status ${ready ? "" : "error"}" id="newsletterStatus" role="status">${ready ? "請先閱讀服務條款，再輸入 Email 完成訂閱。" : "後端設定尚未同步；完成 CMS 全站發布後會自動啟用。"}</div>
        </div><aside class="share-qr-pane newsletter-qr-pane newsletter-qr-minimal"><div class="share-qr-card newsletter-qr-card-simple"><div class="share-qr" id="newsletterQr" data-qr-lock aria-label="訂閱 QR Code"></div></div></aside></div>
      </section></div>
    </div>`;
    $("#newsletterForm").onsubmit = (e) => { e.preventDefault(); requestOtp(); };
    $("#newsletterTermsOpen").onclick = openNewsletterTerms;
    $("#newsletterConsent").onchange = updateNewsletterGate;
    $("#newsletterEmail").oninput = updateNewsletterGate;
    mountPageQr($("#newsletterQr"), qrUrl, { size: 184, dark: "#163149" });
    mountPublicTiltAndQr();
    ensureNewsletterTermsModal();
    updateNewsletterGate();
  }
  function newsletterStep(name, state) {
    const el = document.querySelector('[data-newsletter-step="' + name + '"]');
    if (!el) return;
    el.classList.toggle("active", state === "active");
    el.classList.toggle("done", state === "done");
  }
  function updateNewsletterGate() {
    const consent = $("#newsletterConsent");
    const label = $("#newsletterConsentLabel");
    const btn = $("#newsletterSubmit");
    const email = $("#newsletterEmail");
    const termsState = $("#newsletterTermsState");
    const termsHint = $("#newsletterTermsHint");
    const ready = backendConfig().enabled;
    if (consent) consent.disabled = !newsletterTermsRead;
    if (label) label.classList.toggle("locked", !newsletterTermsRead);
    if (termsState) termsState.textContent = newsletterTermsRead ? "✓ 已閱讀" : "";
    if (termsHint) termsHint.textContent = newsletterTermsRead ? "已閱讀完整服務條款" : "";
    $("#newsletterTermsOpen")?.classList.toggle("complete", newsletterTermsRead);
    const emailOk = /^\S+@\S+\.\S+$/.test(email?.value.trim() || "");
    const consentOk = !!consent?.checked;
    if (btn) btn.disabled = !(ready && newsletterTermsRead && consentOk && emailOk);
    if (newsletterTermsRead) {
      newsletterStep("terms", "done");
      newsletterStep("email", "active");
    } else {
      newsletterStep("terms", "active");
      newsletterStep("email", "");
    }
  }
  function ensureNewsletterTermsModal() {
    if ($("#newsletterTermsOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "newsletterTermsOverlay";
    overlay.className = "newsletter-terms-overlay";
    overlay.innerHTML = `<section class="newsletter-terms-modal" role="dialog" aria-modal="true" aria-labelledby="newsletterTermsTitle">
      <header class="newsletter-terms-head"><div><div class="kicker">REQUIRED · TERMS</div><h2 id="newsletterTermsTitle">服務條款</h2><p>請完整閱讀至最下方，才會解鎖訂閱。</p></div><button class="newsletter-terms-close" type="button" id="newsletterTermsClose" aria-label="關閉">×</button></header>
      <div class="newsletter-terms-progress"><span id="newsletterTermsProgress"></span></div>
      <div class="newsletter-terms-scroll" id="newsletterTermsScroll" tabindex="0"><div class="newsletter-terms-loading">正在載入完整服務條款…</div></div>
      <footer class="newsletter-terms-foot"><div><strong id="newsletterTermsProgressText">閱讀進度 0%</strong><small>條款版本：${NEWSLETTER_TERMS_VERSION}</small></div><button id="newsletterTermsDone" type="button" disabled>請先閱讀到底</button></footer>
    </section>`;
    document.body.appendChild(overlay);
    $("#newsletterTermsClose").onclick = closeNewsletterTerms;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeNewsletterTerms(); });
    const scroller = $("#newsletterTermsScroll");
    scroller.addEventListener("scroll", updateNewsletterTermsProgress, { passive: true });
    $("#newsletterTermsDone").onclick = () => {
      if (!newsletterTermsReachedEnd) return;
      newsletterTermsRead = true;
      closeNewsletterTerms();
      updateNewsletterGate();
      const status = $("#newsletterStatus");
      if (status && backendConfig().enabled) { status.className = "newsletter-status success"; status.textContent = "服務條款已閱讀完成；請輸入 Email 並勾選同意。"; }
      $("#newsletterConsent")?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("show")) closeNewsletterTerms(); });
  }
  async function loadNewsletterTerms() {
    const box = $("#newsletterTermsScroll");
    if (!box || box.dataset.loaded === "1") return;
    try {
      const r = await fetch("terms.html", { cache: "no-cache" });
      if (!r.ok) throw new Error("terms load failed");
      const html = await r.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const source = doc.querySelector(".card");
      if (!source) throw new Error("terms content missing");
      box.innerHTML = '<article class="newsletter-terms-document">' + source.innerHTML + '</article>';
      box.dataset.loaded = "1";
    } catch (_) {
      box.innerHTML = '<article class="newsletter-terms-document"><h1>服務條款</h1><p>SIGN WELL 提供醫學教育、資訊整理與出版內容，不提供個別醫療服務，也不構成診斷、治療或處方建議。</p><h2>內容使用</h2><p>文章可能隨新證據與法規更新。讀者應以正式醫療評估、主管機關公告與原始研究為準。</p><h2>電子報</h2><p>訂閱者可隨時退訂。驗證碼、退訂憑證與安全限制僅用於保護訂閱流程。</p></article>';
      box.dataset.loaded = "1";
    }
    requestAnimationFrame(() => { box.scrollTop = 0; updateNewsletterTermsProgress(); });
  }
  function updateNewsletterTermsProgress() {
    const box = $("#newsletterTermsScroll");
    if (!box) return;
    const max = Math.max(0, box.scrollHeight - box.clientHeight);
    const pct = max <= 6 ? 100 : Math.max(0, Math.min(100, (box.scrollTop / max) * 100));
    newsletterTermsReachedEnd = pct >= 98;
    const bar = $("#newsletterTermsProgress");
    if (bar) bar.style.width = pct.toFixed(1) + "%";
    const text = $("#newsletterTermsProgressText");
    if (text) text.textContent = newsletterTermsReachedEnd ? "已閱讀至條款底部" : "閱讀進度 " + Math.round(pct) + "%";
    const done = $("#newsletterTermsDone");
    if (done) { done.disabled = !newsletterTermsReachedEnd; done.textContent = newsletterTermsReachedEnd ? "我已閱讀完畢" : "請先閱讀到底"; }
  }
  async function openNewsletterTerms() {
    ensureNewsletterTermsModal();
    const overlay = $("#newsletterTermsOverlay");
    newsletterTermsReachedEnd = false;
    overlay.classList.add("show");
    document.documentElement.classList.add("newsletter-terms-lock");
    document.body.classList.add("newsletter-terms-lock");
    await loadNewsletterTerms();
    const box = $("#newsletterTermsScroll");
    if (box) box.scrollTop = 0;
    updateNewsletterTermsProgress();
    setTimeout(() => box?.focus({ preventScroll: true }), 60);
  }
  function closeNewsletterTerms() {
    $("#newsletterTermsOverlay")?.classList.remove("show");
    document.documentElement.classList.remove("newsletter-terms-lock");
    document.body.classList.remove("newsletter-terms-lock");
  }
  async function requestOtp() {
    const email = $("#newsletterEmail")?.value.trim() || otp.email,
      consent = $("#newsletterConsent") ? $("#newsletterConsent").checked : true,
      status = $("#newsletterStatus"),
      btn = $("#newsletterSubmit");
    const setStatus = (cls, txt) => {
      if (!status) return;
      status.className = "newsletter-status " + cls;
      status.textContent = txt;
    };
    if (!newsletterTermsRead) { setStatus("error", "請先開啟並完整閱讀服務條款"); openNewsletterTerms(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) return setStatus("error", "請輸入有效的 Email");
    if (!consent) return setStatus("error", "請先勾選同意電子報條款");
    setStatus("", "正在寄送驗證碼…");
    if (btn) btn.disabled = true;
    try {
      const dev = deviceId(),
        r = await bridge("newsletter.subscribe", {
          email,
          consent: true,
          honeypot: "",
          deviceId: dev,
          elapsed: 1800,
          source: "signwell-public-clean",
        });
      if (r.status === "already_subscribed") {
        setStatus("success", "這個 Email 已經完成訂閱。");
        return;
      }
      if (r.status !== "otp_sent")
        throw new Error(
          r.status === "cooldown"
            ? `請 ${r.retryAfter || 60} 秒後再試`
            : r.status === "daily_limit"
              ? "今天的驗證碼次數已達上限"
              : r.status === "challenge_required"
                ? "安全驗證未通過，請稍後再試"
                : "暫時無法寄送驗證碼",
        );
      otp = { email, requestId: r.requestId, expiresAt: r.expiresAt, deviceId: dev };
      newsletterStep("email", "done"); newsletterStep("otp", "active");
      openOtp();
      setStatus("success", "驗證碼已寄出。");
    } catch (e) {
      setStatus("error", e.message || "寄送失敗");
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  function ensureOtpModal() {
    if ($("#otpOverlay")) return;
    const d = document.createElement("div");
    d.id = "otpOverlay";
    d.className = "otp-overlay";
    d.innerHTML = `<div class="otp-card" role="dialog" aria-modal="true" aria-label="確認 Email"><div class="otp-head"><div><div class="kicker">SIGN WELL LETTER</div><h2>確認你的 Email</h2></div><button class="iconbtn" id="otpClose" type="button" aria-label="關閉">${ICON.close}</button></div><p class="otp-copy">我們已將 6 位數驗證碼寄到 <strong id="otpEmail"></strong>。輸入正確後才會正式加入電子報。</p><div class="otp-digits">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i === 0 ? "one-time-code" : "off"}" aria-label="第 ${i + 1} 位驗證碼" data-otp-digit>`).join("")}</div><div class="otp-meta"><span id="otpTimer">05:00 後失效</span><span>最多可輸錯 6 次</span></div><div class="otp-actions"><button class="otp-primary" id="otpVerify" type="button">確認驗證碼</button><button class="otp-secondary" id="otpResend" type="button">重新寄送驗證碼</button></div><div class="otp-error" id="otpError" role="alert"></div></div>`;
    document.body.appendChild(d);
    $("#otpClose").onclick = closeOtp;
    $("#otpVerify").onclick = verifyOtp;
    $("#otpResend").onclick = () => {
      closeOtp();
      requestOtp();
    };
    d.addEventListener("click", (e) => {
      if (e.target === d) closeOtp();
    });
    const digits = $$("[data-otp-digit]");
    digits.forEach((el, i) => {
      el.oninput = () => {
        const v = el.value.replace(/\D/g, "");
        if (v.length > 1) {
          // pasted / autofilled full code
          v.slice(0, 6 - i).split("").forEach((c, k) => (digits[i + k].value = c));
          digits[Math.min(5, i + v.length - 1)].focus();
          if (digits.every((x) => x.value)) verifyOtp();
          return;
        }
        el.value = v.slice(0, 1);
        if (el.value && i < 5) digits[i + 1].focus();
        if (i === 5 && el.value && digits.every((x) => x.value)) verifyOtp();
      };
      el.onkeydown = (e) => {
        if (e.key === "Backspace" && !el.value && i > 0) digits[i - 1].focus();
        if (e.key === "ArrowLeft" && i > 0) digits[i - 1].focus();
        if (e.key === "ArrowRight" && i < 5) digits[i + 1].focus();
        if (e.key === "Enter") verifyOtp();
      };
      el.onpaste = (e) => {
        const t = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (t.length > 1) {
          e.preventDefault();
          t.split("").forEach((c, k) => digits[k] && (digits[k].value = c));
          digits[Math.min(5, t.length - 1)].focus();
          if (t.length === 6) verifyOtp();
        }
      };
    });
  }
  function maskEmail(e) {
    const [u, d] = e.split("@");
    return `${u.slice(0, 2)}••••@${d || ""}`;
  }
  function openOtp() {
    ensureOtpModal();
    $("#otpEmail").textContent = maskEmail(otp.email);
    $$("[data-otp-digit]").forEach((x) => (x.value = ""));
    $("#otpError").textContent = "";
    $("#otpOverlay").classList.add("show");
    $$("[data-otp-digit]")[0].focus();
    updateOtpTimer();
    clearInterval(openOtp.t);
    openOtp.t = setInterval(updateOtpTimer, 1000);
  }
  function updateOtpTimer() {
    const el = $("#otpTimer");
    if (!el) return;
    const left = Math.max(0, Math.floor((new Date(otp.expiresAt).getTime() - Date.now()) / 1000));
    el.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")} 後失效`;
  }
  function closeOtp() {
    clearInterval(openOtp.t);
    $("#otpOverlay")?.classList.remove("show");
  }
  async function verifyOtp() {
    if (verifyOtp.busy) return;
    const code = $$("[data-otp-digit]")
        .map((x) => x.value)
        .join(""),
      err = $("#otpError");
    if (!/^\d{6}$/.test(code)) {
      err.textContent = "請輸入完整 6 位數驗證碼";
      return;
    }
    err.textContent = "驗證中…";
    verifyOtp.busy = true;
    try {
      const r = await bridge("newsletter.verifyOtp", {
        requestId: otp.requestId,
        email: otp.email,
        deviceId: otp.deviceId,
        code,
      });
      if (r.status !== "verified")
        throw new Error(
          r.status === "expired" ? "驗證碼已失效" : r.status === "locked" ? "輸入錯誤次數過多，請重新寄送" : "驗證碼不正確",
        );
      err.textContent = "";
      closeOtp();
      newsletterStep("otp", "done");
      toast("訂閱完成");
      const s = $("#newsletterStatus");
      if (s) {
        s.className = "newsletter-status success";
        s.textContent = "Email 驗證完成，已正式加入 SIGN WELL 電子報。";
      }
    } catch (e) {
      err.textContent = e.message || "驗證失敗";
    } finally {
      verifyOtp.busy = false;
    }
  }

  /* --------------------------------------------------------------- article */
  async function loadArticle(slug) {
    if (articleCache.has(slug)) return articleCache.get(slug);
    const a = await jsonFetch(`articles/${encodeURIComponent(slug)}.json`, null);
    if (a) articleCache.set(slug, a);
    return a;
  }
  function relatedOf(a, slug) {
    const tags = new Set(a.tags || []);
    return articles
      .filter((x) => x.slug !== slug)
      .map((x) => ({ x, s: (x.category && x.category === a.category ? 3 : 0) + (x.tags || []).filter((t) => tags.has(t)).length }))
      .filter((o) => o.s > 0)
      .sort((p, q) => q.s - p.s || byDate(p.x, q.x))
      .slice(0, 3)
      .map((o) => o.x);
  }
  async function renderArticle(slug) {
    renderedSlug = slug;
    if (!articleCache.has(slug))
      app.innerHTML = `<div class="article-view" aria-busy="true"><header class="article-head"><div class="skeleton sk-line" style="width:140px"></div><div class="skeleton sk-title"></div><div class="skeleton sk-title" style="width:56%"></div><div class="skeleton sk-line" style="width:260px"></div></header><div class="skeleton sk-cover"></div><div class="skeleton sk-line"></div><div class="skeleton sk-line" style="width:92%"></div><div class="skeleton sk-line" style="width:84%"></div></div>`;
    const a = await loadArticle(slug);
    if (renderedSlug !== slug) return; // user navigated elsewhere meanwhile
    if (!a) {
      app.innerHTML = `<div class="article-view"><header class="article-head"><div class="kicker">NOT FOUND</div><h1>找不到文章</h1><p style="color:var(--muted)">文章可能尚未發布，或網址已改變。</p><div class="article-actions"><button class="btn btn-primary" id="backHome" type="button">回首頁 ${ICON.arrow}</button></div></header></div>`;
      $("#backHome").onclick = () => navigate("home");
      return;
    }
    const idx = articles.find((x) => x.slug === slug) || {};
    const p = people.find((x) => String(x.id || "") === String(a.publisherId || ""));
    const author = p?.name || a.publisherName || "SIGN WELL",
      cover = safeUrl(a.cover),
      category = a.category || idx.category || "醫學筆記",
      summary = a.ai_summary10s || a.summary10s || a.articleIdCard?.overview || a.excerpt || "";
    const topic = topics.find((t) => t.name === category);
    const related = relatedOf({ ...idx, ...a }, slug);
    app.innerHTML = `<article class="article-view" data-slug="${esc(slug)}" data-minutes="${reading(a)}"><header class="article-head"><nav class="article-crumbs" aria-label="路徑"><button type="button" data-nav="home">首頁</button><span aria-hidden="true">/</span>${topic ? `<button type="button" class="cat" data-topic="${esc(topic.slug || topic.name)}">${esc(category)}</button>` : `<span class="cat">${esc(category)}</span>`}</nav><h1>${esc(a.title || "未命名文章")}</h1><div class="article-meta"><span class="who" style="--h:${hueOf(author)}"><i aria-hidden="true">${esc(Array.from(author)[0] || "S")}</i>${esc(author)}</span><span class="dot"></span><time>${esc(fmtDate(a.publishedAt || a.updatedAt))}</time><span class="dot"></span><span>${reading(a)} 分鐘閱讀</span></div><div class="article-actions"><button class="softbtn" type="button" data-swid-open-card data-swid-open="1">${ICON.id} 文章 ID 卡</button><button class="softbtn" id="articleShare" type="button">${ICON.share} 分享</button></div></header>${cover ? `<img class="article-cover" src="${esc(cover)}" alt="" decoding="async" fetchpriority="high">` : ""}${summary ? `<aside class="summary10s"><b>${ICON.bolt} 10 秒摘要</b><p>${esc(summary)}</p></aside>` : ""}<div class="article-body">${a.content || ""}</div><footer class="article-foot">${esc(site.footerDisclaimer || "本站內容僅供醫學教育與資訊整理，不構成個別醫療建議。")}</footer>${related.length ? `<section class="section related">${sectionHead("→", "延伸閱讀", "你可能也想看")}<div class="cards">${related.map((x) => articleCard(x)).join("")}</div></section>` : ""}</article>`;
    if (pendingMorph) {
      if (pendingMorph.cover) nameEl($(".article-cover", app), VT.cover);
      if (pendingMorph.title) nameEl($(".article-head h1", app), VT.title);
      pendingMorph = null;
    }
    window.SIGNWELL_CURRENT_ARTICLE = { ...idx, ...a, slug };
    window.SIGNWELL_ARTICLE_ID_CARD = a.articleIdCard || null;
    window.SignWellArticleIdCard?.init?.();
    $("#articleShare").onclick = async () => {
      const u = location.href,
        t = a.title || "SIGN WELL";
      try {
        if (navigator.share) await navigator.share({ title: t, url: u });
        else {
          await copyText(u);
          toast("已複製文章連結");
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          await copyText(u);
          toast("已複製文章連結");
        }
      }
    };
    bindCards();
    track("article", slug);
  }

  /* --------------------------------------------------------------- binding */
  function bindCards(root = app) {
    $$("[data-article]", root).forEach((el) => {
      if (el.dataset.swBound) return;
      el.dataset.swBound = "1";
      el.onclick = () => articleNavigate(el.dataset.article, el);
    });
    $$("[data-topic]", root).forEach((el) => {
      if (el.dataset.swBound) return;
      el.dataset.swBound = "1";
      el.onclick = (e) => {
        e.stopPropagation();
        topicNavigate(el.dataset.topic);
      };
    });
  }
  async function copyText(v) {
    try {
      return await navigator.clipboard.writeText(v);
    } catch (_) {
      const t = document.createElement("textarea");
      t.value = v;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
  }

  /* ---------------------------------------------------------------- search */
  let lastFocus = null;
  function openSearch() {
    const ov = $("#searchOverlay");
    if (!ov || ov.classList.contains("show")) return;
    lastFocus = document.activeElement;
    ov.classList.add("show");
    document.documentElement.classList.add("sw-search-open");
    document.body.style.overflow = "hidden";
    const i = $("#searchInput");
    i.value = "";
    renderSearch("");
    requestAnimationFrame(() => searchFilter?.measure?.() || 0);
    setTimeout(() => {
      searchFilter?.refresh?.();
      i.focus();
    }, 60);
  }
  function closeSearch() {
    const ov = $("#searchOverlay");
    if (!ov || !ov.classList.contains("show")) return;
    ov.classList.remove("show");
    document.documentElement.classList.remove("sw-search-open");
    document.body.style.overflow = "";
    try {
      lastFocus?.focus?.({ preventScroll: true });
    } catch (_) {}
  }
  function hl(text, q) {
    const s = String(text ?? "");
    if (!q) return esc(s);
    const i = s.toLowerCase().indexOf(q);
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + q.length)) + "</mark>" + esc(s.slice(i + q.length));
  }
  function renderSearch(q) {
    const raw = q.trim();
    const s = raw.toLowerCase();
    const wantA = searchScope !== "topics",
      wantT = searchScope !== "articles";
    const resolved = wantA && raw ? resolveArticleRef(raw) : null;
    const resolvedSlug = resolved?.slug || "";
    let aa = !wantA
      ? []
      : (s
          ? articles.filter((a) =>
              [
                a.title,
                a.category,
                (a.tags || []).join(" "),
                a.searchText,
                a.excerpt,
                articleIdOf(a),
              ]
                .join(" ")
                .toLowerCase()
                .includes(s) ||
              (articleIdKey(raw) && articleIdKey(articleIdOf(a)).includes(articleIdKey(raw))),
            )
          : articles.slice().sort(byDate).slice(0, 6)
        ).slice(0, 12);
    if (resolvedSlug) {
      const exactArticle = resolved.article || articles.find((a) => a.slug === resolvedSlug);
      if (exactArticle) aa = [exactArticle, ...aa.filter((a) => a.slug !== resolvedSlug)].slice(0, 12);
    }
    const tt = !wantT
      ? []
      : (s
          ? topics.filter((t) => t.active !== false && [t.name, t.description].join(" ").toLowerCase().includes(s))
          : topics.filter((t) => t.active !== false).slice(0, 4)
        ).slice(0, 6);
    const box = $("#searchResults");
    const count = $("#searchCount");
    if (count) count.textContent = s ? `${aa.length + tt.length} 筆結果` : "";
    let html = "";
    if (aa.length)
      html +=
        `<div class="search-group">${resolvedSlug ? "Article ID / 文章" : s ? "文章" : "最新文章"}</div>` +
        aa
          .map((a) => {
            const exactId = resolvedSlug && a.slug === resolvedSlug && /^articleId/i.test(resolved.type || "");
            const id = articleIdOf(a);
            return `<div class="search-result${exactId ? " exact-id" : ""}" data-sr-article="${esc(a.slug)}" role="option"><div class="search-thumb">${coverMedia(a, { label: false })}</div><div class="search-copy">${exactId ? '<em class="search-id-hit">ARTICLE ID 精確命中</em>' : ""}<strong>${hl(a.title, s)}</strong><span>${id ? `<code class="search-article-id">${esc(id)}</code> · ` : ""}${esc(a.category || "醫學筆記")} · ${reading(a)} 分鐘${a.excerpt ? " · " + hl(a.excerpt, s) : ""}</span></div><span aria-hidden="true">›</span></div>`;
          })
          .join("");
    if (tt.length)
      html +=
        `<div class="search-group">主題</div>` +
        tt
          .map(
            (t) =>
              `<div class="search-result" data-sr-topic="${esc(t.slug || t.name)}" role="option"><div class="search-thumb topic" style="--h:${topicHue(t)}">${esc(Array.from(String(t.name || "主"))[0])}</div><div class="search-copy"><strong>${hl(t.name, s)}</strong><span>${hl(t.description || "主題", s)}</span></div><span aria-hidden="true">›</span></div>`,
          )
          .join("");
    if (!html) {
      const tags = [...new Set(articles.flatMap((a) => a.tags || []))].slice(0, 8);
      const idHint = /^\s*sw[-\s_]?/i.test(raw)
        ? '<p class="search-id-help">找不到這個 Article ID。請確認代號，或改用文章 QR Code。</p>'
        : "";
      html = `<div class="search-empty"><b>${s ? "找不到符合的內容" : "還沒有可以搜尋的內容"}</b>${s ? "換個關鍵字、Article ID，或使用 QR 掃描。" : "CMS 發布文章後就能在這裡搜尋。"}${idHint}${tags.length ? `<div class="search-suggest">${tags.map((t) => `<button type="button" data-sr-fill="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}</div>`;
    }
    box.innerHTML = html;
    $$("[data-sr-article]", box).forEach(
      (el) =>
        (el.onclick = () => {
          closeSearch();
          articleNavigate(el.dataset.srArticle);
        }),
    );
    $$("[data-sr-topic]", box).forEach(
      (el) =>
        (el.onclick = () => {
          closeSearch();
          topicNavigate(el.dataset.srTopic);
        }),
    );
    $$("[data-sr-fill]", box).forEach(
      (el) =>
        (el.onclick = () => {
          const i = $("#searchInput");
          i.value = el.dataset.srFill;
          renderSearch(i.value);
          i.focus();
        }),
    );
  }

  /* -------------------------------------------------------------- analytics */
  function track(kind, key) {
    const c = backendConfig();
    if (!c.enabled) return;
    const id = "evt_" + kind + "_" + key + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    bridge("analytics.track", { kind, key, eventId: id }, 7000).catch(() => {});
  }
  function trackPage() {
    track("page", currentPage());
  }
  function idlePrefetch() {
    const c = navigator.connection;
    if (c?.saveData) return;
    const run = () =>
      articles
        .slice()
        .sort(byDate)
        .slice(0, 6)
        .forEach((a, i) => setTimeout(() => loadArticle(a.slug), i * 120));
    "requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 1200 }) : setTimeout(run, 700);
  }

  /* =======================================================================
     LiquidSegmented — draggable glass capsule shared by the dock and every
     segmented control. Press → capsule swells into a lens (magnified,
     tinted copy of the items underneath), drag → squash & stretch with
     rubber-banding at the ends, release → spring snap to the nearest item.
     ======================================================================= */
  class LiquidSegmented {
    constructor(root, o = {}) {
      this.root = root;
      this.itemsWrap = o.itemsWrap;
      this.items = o.items;
      this.thumb = o.thumb;
      this.index = clamp(o.index || 0, 0, this.items.length - 1);
      this.onCommit = o.onCommit;
      this.onPreview = o.onPreview;
      this.radio = !!o.radio;
      this.panY = !!o.panY;
      this.x = 0;
      this.w = 0;
      this.hover = -1;
      this.lastPointerCommit = 0;
      this.build();
      this.itemsWrap.classList.add("lg-hole");
      this.measure();
      this.place(this.index, false);
      this.bind();
      if ("ResizeObserver" in window) {
        this.ro = new ResizeObserver(() => {
          if (this.pressed) return;
          this.mirrorLayout();
          this.measure();
          this.place(this.index, false);
        });
        this.ro.observe(root);
      }
      document.fonts?.ready?.then(() => this.refresh());
    }
    build() {
      let body = this.thumb.querySelector(".lq-body");
      if (!body) {
        const spec = this.thumb.querySelector(".thumb-spec");
        body = document.createElement("div");
        body.className = "lq-body";
        this.thumb.textContent = "";
        this.thumb.appendChild(body);
        if (spec) body.appendChild(spec);
      }
      this.body = body;
      const lens = document.createElement("div");
      lens.className = "lq-lens";
      const inner = document.createElement("div");
      /* own class only — the copy must never match selectors meant for the
         real items (e.g. ".pager-items .nav-item"); layout is mirrored inline */
      inner.className = "lq-lens-inner" + (this.radio ? " seg" : "");
      inner.setAttribute("aria-hidden", "true");
      inner.innerHTML = this.itemsWrap.innerHTML;
      $$("[id]", inner).forEach((n) => n.removeAttribute("id"));
      $$("button,a,[tabindex]", inner).forEach((n) => {
        n.setAttribute("tabindex", "-1");
        n.removeAttribute("aria-current");
        n.removeAttribute("aria-checked");
        n.removeAttribute("role");
      });
      try {
        inner.inert = true;
      } catch (_) {}
      lens.appendChild(inner);
      body.insertBefore(lens, body.firstChild);
      this.lens = lens;
      this.lensInner = inner;
      this.mirrorLayout();
    }
    mirrorLayout() {
      const cs = getComputedStyle(this.itemsWrap),
        st = this.lensInner.style;
      ["display", "gridTemplateColumns", "gridAutoFlow", "gridAutoColumns", "alignItems", "justifyItems", "columnGap", "rowGap"].forEach((k) => (st[k] = cs[k]));
    }
    refresh() {
      this.mirrorLayout();
      this.measure();
      this.place(this.index, false);
    }
    measure() {
      const root = this.root,
        rr = root.getBoundingClientRect();
      if (!rr.width) return;
      this.scale = rr.width / (root.offsetWidth || rr.width) || 1;
      this.rootLeft = rr.left;
      const bl = root.clientLeft,
        bt = root.clientTop;
      this.geom = this.items.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: (r.left - rr.left) / this.scale - bl, w: r.width / this.scale };
      });
      const ic = this.itemsWrap.getBoundingClientRect();
      this.icx = (ic.left - rr.left) / this.scale - bl;
      this.icy = (ic.top - rr.top) / this.scale - bt;
      this.lensInner.style.width = ic.width / this.scale + "px";
      this.lensInner.style.height = ic.height / this.scale + "px";
      this.thumbTop = this.thumb.offsetTop;
    }
    syncRect() {
      const rr = this.root.getBoundingClientRect();
      if (!rr.width) return;
      this.rootLeft = rr.left;
      this.scale = rr.width / (this.root.offsetWidth || rr.width) || 1;
    }
    toLocal(clientX) {
      return (clientX - this.rootLeft) / (this.scale || 1) - this.root.clientLeft;
    }
    centers() {
      return this.geom.map((g) => g.x + g.w / 2);
    }
    indexAt(lx) {
      const cs = this.centers();
      let best = 0,
        bd = Infinity;
      cs.forEach((c, i) => {
        const d = Math.abs(c - lx);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    }
    fromCenter(c) {
      const cs = this.centers(),
        g = this.geom,
        n = g.length;
      if (c <= cs[0]) return { x: c - g[0].w / 2, w: g[0].w };
      if (c >= cs[n - 1]) return { x: c - g[n - 1].w / 2, w: g[n - 1].w };
      let i = 0;
      while (i < n - 2 && c > cs[i + 1]) i++;
      const t = (c - cs[i]) / (cs[i + 1] - cs[i] || 1);
      const w = g[i].w + (g[i + 1].w - g[i].w) * t;
      return { x: c - w / 2, w };
    }
    set(x, w) {
      this.x = x;
      this.w = w;
      this.thumb.style.setProperty("--tx", x.toFixed(2) + "px");
      if (Math.abs((this._w || 0) - w) > 0.1) {
        this.thumb.style.width = w.toFixed(2) + "px";
        this._w = w;
      }
      this.lensInner.style.transform = `translate3d(${(this.icx - x).toFixed(2)}px,${(this.icy - this.thumbTop).toFixed(2)}px,0)`;
    }
    /* Hide the real items under the capsule so the lens shows only the
       magnified copy (no ghosting). Tracks the capsule's *rendered* rect, so it
       follows spring transitions exactly; runs only while something moves. */
    syncHole() {
      const ir = this.itemsWrap.getBoundingClientRect(),
        br = this.body.getBoundingClientRect();
      if (!ir.width || !br.width) return;
      const s = ir.width / (this.itemsWrap.offsetWidth || ir.width) || 1;
      const inset = Math.min(br.width, br.height) * 0.16;
      const l = (br.left - ir.left + inset) / s,
        r = (br.right - ir.left - inset) / s;
      this.itemsWrap.style.setProperty("--hole-l", l.toFixed(1) + "px");
      this.itemsWrap.style.setProperty("--hole-r", Math.max(l, r).toFixed(1) + "px");
    }
    startSync(ms = 950) {
      this.syncUntil = Math.max(this.syncUntil || 0, performance.now() + ms);
      if (this.syncRaf) return;
      const loop = () => {
        this.syncHole();
        if (this.pressed || performance.now() < this.syncUntil) this.syncRaf = requestAnimationFrame(loop);
        else this.syncRaf = 0;
      };
      this.syncRaf = requestAnimationFrame(loop);
    }
    stretch(sx, sy) {
      this.body.style.setProperty("--sx", sx.toFixed(3));
      this.body.style.setProperty("--sy", sy.toFixed(3));
    }
    place(i, animate = true) {
      if (!this.geom?.[i]) return;
      if (!animate) this.root.classList.add("no-anim");
      this.set(this.geom[i].x, this.geom[i].w);
      if (!animate) {
        void this.thumb.offsetWidth;
        requestAnimationFrame(() => this.root.classList.remove("no-anim"));
      }
      this.startSync(animate ? 950 : 60);
      if (this.radio)
        this.items.forEach((b, n) => {
          b.setAttribute("aria-checked", n === i ? "true" : "false");
          b.tabIndex = n === i ? 0 : -1;
        });
    }
    setIndex(i, animate = true) {
      this.index = clamp(i, 0, this.items.length - 1);
      if (!this.pressed) this.place(this.index, animate);
    }
    setHover(i) {
      if (i === this.hover) return;
      this.hover = i;
      this.items.forEach((b, n) => b.classList.toggle("is-hover", n === i));
      if (i >= 0) {
        this.onPreview?.(i);
        if (this.dragging) navigator.vibrate?.(4);
      }
    }
    commit(i, via) {
      i = clamp(i, 0, this.items.length - 1);
      const changed = i !== this.index;
      this.index = i;
      this.place(i, true);
      this.onCommit?.(i, { changed, via });
    }
    bind() {
      const root = this.root;
      root.addEventListener("pointerdown", (e) => {
        if (e.button > 0 || this.pressed) return;
        this.measure();
        this.pressed = true;
        this.dragging = false;
        this.pid = e.pointerId;
        this.sx0 = e.clientX;
        this.sy0 = e.clientY;
        this.lastX = e.clientX;
        this.lastT = performance.now();
        this.vx = 0;
        const lx = this.toLocal(e.clientX);
        this.grab = lx >= this.x && lx <= this.x + this.w ? lx - this.x : null;
        root.classList.add("is-pressed");
        this.startSync();
        document.documentElement.classList.remove("sw-dock-mini");
        if (!this.panY) {
          try {
            root.setPointerCapture(e.pointerId);
          } catch (_) {}
        }
      });
      root.addEventListener("pointermove", (e) => {
        if (!this.pressed || e.pointerId !== this.pid) return;
        const dx = e.clientX - this.sx0,
          dy = e.clientY - this.sy0;
        if (!this.dragging) {
          if (Math.abs(dx) < 6) {
            if (this.panY && Math.abs(dy) > 8) this.cancel();
            return;
          }
          this.dragging = true;
          root.classList.add("is-dragging");
          if (this.grab == null) this.grab = this.w / 2;
          if (this.panY) {
            try {
              root.setPointerCapture(e.pointerId);
            } catch (_) {}
          }
        }
        this.syncRect();
        const now = performance.now(),
          dt = Math.max(8, now - this.lastT);
        this.vx = this.vx * 0.55 + ((e.clientX - this.lastX) / dt) * 0.45;
        this.lastX = e.clientX;
        this.lastT = now;
        const cs = this.centers(),
          lo = cs[0],
          hi = cs[cs.length - 1];
        let c = this.toLocal(e.clientX) - this.grab + this.w / 2;
        if (c < lo) c = lo - 26 * (1 - 1 / (1 + (lo - c) / 48));
        if (c > hi) c = hi + 26 * (1 - 1 / (1 + (c - hi) / 48));
        const f = this.fromCenter(c);
        this.set(f.x, f.w);
        const s = Math.min(Math.abs(this.vx) * 0.16, 0.24);
        this.stretch(1 + s, 1 - s * 0.42);
        clearTimeout(this.relax);
        this.relax = setTimeout(() => this.stretch(1, 1), 110);
        this.setHover(this.indexAt(c));
      });
      const up = (e) => {
        if (!this.pressed || e.pointerId !== this.pid) return;
        const wasDrag = this.dragging;
        let target;
        if (wasDrag) {
          const c = this.x + this.w / 2 + clamp(this.vx * 70, -40, 40);
          target = this.indexAt(c);
        } else target = this.indexAt(this.toLocal(e.clientX));
        this.release();
        this.lastPointerCommit = performance.now();
        this.commit(target, wasDrag ? "drag" : "tap");
      };
      root.addEventListener("pointerup", up);
      root.addEventListener("pointercancel", () => this.cancel());
      root.addEventListener("lostpointercapture", (e) => {
        if (this.pressed && this.dragging && e.pointerId === this.pid) up(e);
      });
      this.items.forEach((b, i) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (performance.now() - this.lastPointerCommit < 600) return;
          this.commit(i, "click");
        }),
      );
      root.addEventListener("keydown", (e) => {
        const k = e.key;
        let i = null;
        if (k === "ArrowRight" || k === "ArrowDown") i = this.index + 1;
        else if (k === "ArrowLeft" || k === "ArrowUp") i = this.index - 1;
        else if (k === "Home") i = 0;
        else if (k === "End") i = this.items.length - 1;
        if (i == null) return;
        e.preventDefault();
        i = clamp(i, 0, this.items.length - 1);
        this.commit(i, "key");
        if (this.radio) this.items[i].focus();
      });
    }
    release() {
      this.startSync(950);
      this.pressed = false;
      this.dragging = false;
      clearTimeout(this.relax);
      this.stretch(1, 1);
      this.root.classList.remove("is-pressed", "is-dragging");
      this.setHover(-1);
    }
    cancel() {
      if (!this.pressed) return;
      this.release();
      this.place(this.index, true);
    }
  }

  function mountSegmented(root, { labels, index = 0, onCommit, ariaLabel, panY = true } = {}) {
    root.classList.add("lg-seg");
    root.setAttribute("role", "radiogroup");
    if (ariaLabel) root.setAttribute("aria-label", ariaLabel);
    root.innerHTML = `<div class="lg-seg-thumb"><span class="thumb-spec"></span></div><div class="lg-seg-items">${labels.map((l) => `<button type="button" role="radio" aria-checked="false">${esc(l)}</button>`).join("")}</div>`;
    return new LiquidSegmented(root, {
      itemsWrap: $(".lg-seg-items", root),
      items: $$(".lg-seg-items button", root),
      thumb: $(".lg-seg-thumb", root),
      index,
      onCommit,
      radio: true,
      panY,
    });
  }

  function setupDock() {
    const rail = $("#pager"),
      thumb = $("#navThumb"),
      wrap = $(".pager-items", rail || document),
      items = $$("#pager > .pager-items .nav-item");
    if (!rail || !thumb || !wrap || !items.length) return;
    dock = new LiquidSegmented(rail, {
      itemsWrap: wrap,
      items,
      thumb,
      index: activeIndex(),
      onPreview: (i) => rail.setAttribute("aria-valuetext", items[i]?.textContent?.trim() || ""),
      onCommit: (i, { changed }) => {
        setActive(i);
        if (!changed && currentPage() !== "article" && !new URL(location.href).search) {
          window.scrollTo({ top: 0, behavior: reducedMQ.matches ? "auto" : "smooth" });
          return;
        }
        navigate(PAGES[i]);
      },
    });
    window.SignWellDock = dock;
  }

  /* ---------------------------------------------------- chrome upgrades */
  function ensureChrome() {
    const brand = $("#brandHome");
    const sb = $("#searchBtn");
    if (sb && !$("svg", sb)) sb.innerHTML = ICON.search;
    const sc = $("#searchClose");
    if (sc && !$("svg", sc)) sc.innerHTML = ICON.close;
    const sg = $(".search-glyph");
    if (sg && !$("svg", sg)) sg.innerHTML = ICON.search;
    const ov = $("#searchOverlay");
    if (ov) {
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-modal", "true");
      const box = $(".searchbox", ov);
      if (box && !$(".search-tools", box)) {
        const tools = document.createElement("div");
        tools.className = "search-tools";
        tools.innerHTML = `<div id="searchFilter"></div><span class="search-count" id="searchCount" style="font-size:12px;color:var(--muted);font-weight:700"></span>`;
        $(".search-input", box)?.after(tools);
      }
      if (box && !$(".search-foot", box)) {
        const foot = document.createElement("div");
        foot.className = "search-foot";
        foot.innerHTML = `<span><kbd>↑</kbd><kbd>↓</kbd>選擇</span><span><kbd>Enter</kbd>開啟</span><span><kbd>Esc</kbd>關閉</span>`;
        box.appendChild(foot);
      }
      const results = $("#searchResults");
      if (results) results.setAttribute("role", "listbox");
    }
    if (!$(".skip-link")) {
      const a = document.createElement("a");
      a.className = "skip-link";
      a.href = "#app";
      a.textContent = "跳到主要內容";
      document.body.prepend(a);
    }
    if (app && !app.hasAttribute("tabindex")) app.setAttribute("tabindex", "-1");
    const foot = $(".footer > div:first-child");
    if (foot && !$(".footer-nav", foot)) {
      const nav = document.createElement("nav");
      nav.className = "footer-nav";
      nav.setAttribute("aria-label", "頁尾導覽");
      nav.innerHTML = PAGES.map((p, i) => `<button type="button" data-nav="${p}">${esc($$("#pager > .pager-items .nav-item")[i]?.textContent?.trim() || p)}</button>`).join("");
      foot.appendChild(nav);
    }
  }

  function setupGlobal() {
    ensureChrome();
    setupDock();
    const fEl = $("#searchFilter");
    if (fEl)
      searchFilter = mountSegmented(fEl, {
        labels: ["全部", "文章", "主題"],
        ariaLabel: "搜尋範圍",
        onCommit: (i) => {
          searchScope = ["all", "articles", "topics"][i];
          renderSearch($("#searchInput").value);
        },
      });
    const brand = $("#brandHome");
    brand.onclick = () => navigate("home");
    brand.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate("home");
      }
    };
    $("#searchBtn").onclick = openSearch;
    $("#searchClose").onclick = closeSearch;
    $("#searchOverlay").onclick = (e) => {
      if (e.target === $("#searchOverlay")) closeSearch();
    };
    $("#searchInput").oninput = (e) => renderSearch(e.target.value);
    $("#searchInput").onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const hit = resolveArticleRef(e.currentTarget.value);
      if (hit?.slug) {
        e.preventDefault();
        closeSearch();
        articleNavigate(hit.slug);
      }
    };
    /* delegated actions inside rendered pages */
    document.addEventListener("click", (e) => {
      const n = e.target.closest("[data-nav]");
      if (n) {
        e.preventDefault();
        navigate(n.dataset.nav);
        return;
      }
      if (e.target.closest("[data-open-search]")) {
        openSearch();
        return;
      }
      const s = e.target.closest("[data-scroll-to]");
      if (s) {
        const t = document.getElementById(s.dataset.scrollTo);
        t?.scrollIntoView({ behavior: reducedMQ.matches ? "auto" : "smooth", block: "start" });
      }
    });
    addEventListener("popstate", (e) => {
      /* in-page anchors (skip link, footnotes like #fn1 in article HTML) also
         fire popstate — let the browser scroll instead of re-rendering */
      if (location.pathname + location.search === routeKey) return;
      renderCurrent(true, { scroll: e.state?.scroll ?? 0 });
    });
    $(".skip-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      app.focus({ preventScroll: false });
      app.scrollIntoView({ block: "start" });
    });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSearch();
        closeOtp();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName || "") && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        openSearch();
      }
    });
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }

  if (!reducedMQ.matches && currentPage() === "home") {
    document.documentElement.classList.add("sw-intro");
    setTimeout(() => {
      document.documentElement.classList.remove("sw-intro");
      document.documentElement.style.removeProperty("--intro-t");
    }, 2800);
  }
  setupGlobal();
  renderCurrent(false);
  bootstrap();
  window.SignWellLiquidSegmented = LiquidSegmented;
  window.SIGNWELL_CLEAN_PUBLIC = {
    version: VERSION,
    uiVersion: UI_VERSION,
    bridge,
    navigate,
    articleNavigate,
    topicNavigate,
    renderCurrent,
    renderTopicArticles,
    openSearch,
    closeSearch,
    toast,
    mountSegmented,
  };
})();

/* Canonical app-shell: safe no-op outside HTTPS/localhost. */
function swRegisterPublicServiceWorker_() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(() => {});
    },
    { once: true },
  );
}
swRegisterPublicServiceWorker_();

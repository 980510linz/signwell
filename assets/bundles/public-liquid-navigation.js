(() => {
  "use strict";
  const VERSION = "24.36.0";
  const UI_VERSION = "25.1";
  const PAGES = [
    "index.html",
    "topics.html",
    "about.html",
    "share.html",
    "newsletter.html",
  ];
  const PAGE_INDEX = new Map(PAGES.map((x, i) => [x, i]));
  const root = document.documentElement;
  root.classList.add("sw-public-spa-v2436");

  function basename(urlLike) {
    try {
      const u = new URL(urlLike, location.href);
      const b = (u.pathname.split("/").pop() || "index.html").toLowerCase();
      return PAGES.includes(b) ? b : "";
    } catch (_) {
      return "";
    }
  }
  function pageIndex(urlLike) {
    const b = basename(urlLike);
    return b ? PAGE_INDEX.get(b) : 0;
  }
  function retireLegacyShareQr() {
    const onShare = basename(location.href) === "share.html";
    root.classList.toggle("sw-share-no-legacy-qr", onShare);
    if (!onShare) return;
    const app = document.getElementById("app");
    if (!app) return;
    app
      .querySelectorAll(
        "#qrcode,.share-card .qr-box,#refreshQr,[data-share-qr],[data-qr-share]",
      )
      .forEach((el) => el.remove());
  }
  function setDirection(from, to) {
    const a = pageIndex(from),
      b = pageIndex(to),
      forward = b >= a;
    root.style.setProperty("--sw-route-old-x", forward ? "-8px" : "8px");
    root.style.setProperty("--sw-route-new-x", forward ? "12px" : "-12px");
    root.dataset.swRouteDirection = forward ? "forward" : "back";
  }

  /* Observe history changes so transitions can reflect the travel direction.
   This does not own routing; the public shell still owns route/render state. */
  let currentHref = location.href;
  const push = history.pushState.bind(history),
    replace = history.replaceState.bind(history);
  history.pushState = function (state, title, url) {
    if (url != null)
      setDirection(currentHref, new URL(url, location.href).href);
    const out = push(state, title, url);
    currentHref = location.href;
    queueMicrotask(retireLegacyShareQr);
    return out;
  };
  history.replaceState = function (state, title, url) {
    if (url != null)
      setDirection(currentHref, new URL(url, location.href).href);
    const out = replace(state, title, url);
    currentHref = location.href;
    queueMicrotask(retireLegacyShareQr);
    return out;
  };
  addEventListener(
    "popstate",
    () => {
      setDirection(currentHref, location.href);
      currentHref = location.href;
    },
    { passive: true },
  );

  /* Fallback entrance animation. The main shell uses View Transitions when
   supported; this observer only runs when that API is unavailable. */
  if (!document.startViewTransition) {
    const app = document.getElementById("app");
    if (app) {
      let raf = 0;
      new MutationObserver(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          raf = 0;
          root.classList.remove("sw-route-fallback-in");
          requestAnimationFrame(() => {
            root.classList.add("sw-route-fallback-in");
            setTimeout(
              () => root.classList.remove("sw-route-fallback-in"),
              280,
            );
          });
        });
      }).observe(app, { childList: true });
    }
  }
  const routeApp = document.getElementById("app");
  if (routeApp)
    new MutationObserver(() => retireLegacyShareQr()).observe(routeApp, {
      childList: true,
      subtree: false,
    });
  retireLegacyShareQr();

  /* Warm all five shell documents after first paint. Navigation itself no longer
   needs them once soft routing is active, but this makes reload/fallback nearly
   instant and satisfies direct-entry pages without blocking FCP. */
  const warmed = new Set();
  function warmUrl(url) {
    const abs = new URL(url, location.href).href;
    if (warmed.has(abs) || abs === location.href) return;
    warmed.add(abs);
    fetch(abs, {
      method: "GET",
      cache: "force-cache",
      credentials: "same-origin",
    }).catch(() => {});
  }
  function prewarm() {
    const c =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (c?.saveData || /slow-2g/i.test(String(c?.effectiveType || ""))) return;
    PAGES.forEach((p, i) => setTimeout(() => warmUrl(p), i * 90));
    ["public-data.json", "articles/index.json", "topics/index.json"].forEach(
      (p, i) => setTimeout(() => warmUrl(p), 480 + i * 90),
    );
  }
  if ("requestIdleCallback" in window)
    requestIdleCallback(prewarm, { timeout: 900 });
  else setTimeout(prewarm, 320);

  /* The dock should never trigger browser image dragging/selection or accidental
   double-tap text selection. Keep all touch work on the existing pointer loop. */
  const pager =
    document.getElementById("pager") || document.querySelector(".pager");
  if (pager) {
    pager.setAttribute("data-sw-liquid-version", VERSION);
    pager.addEventListener("dragstart", (e) => e.preventDefault());
    pager.addEventListener("selectstart", (e) => e.preventDefault());
    pager.addEventListener(
      "pointerdown",
      () => root.classList.add("sw-dock-interacting"),
      { passive: true },
    );
    const end = () => root.classList.remove("sw-dock-interacting");
    pager.addEventListener("pointerup", end, { passive: true });
    pager.addEventListener("pointercancel", end, { passive: true });
  }

  /* Scroll-aware chrome (ui 25.1):
     · html.sw-scrolled — top glass gets a touch more fill once content passes under it
     · html.sw-dock-mini — tab bar shrinks while reading downward, returns on the
       slightest upward scroll, at the top, near the page end, or on touch. */
  let lastY = scrollY,
    acc = 0,
    ticking = false;
  function onScroll() {
    ticking = false;
    const y = Math.max(0, scrollY),
      dy = y - lastY;
    lastY = y;
    root.classList.toggle("sw-scrolled", y > 24);
    if (root.classList.contains("sw-search-open") || root.classList.contains("sw-dock-interacting")) return;
    const nearEnd = y + innerHeight >= document.documentElement.scrollHeight - 80;
    if (y < 90 || nearEnd) {
      acc = 0;
      root.classList.remove("sw-dock-mini");
      return;
    }
    if (dy > 0) {
      acc = Math.max(0, acc) + dy;
      if (acc > 48) root.classList.add("sw-dock-mini");
    } else if (dy < 0) {
      acc = Math.min(0, acc) + dy;
      if (acc < -18) root.classList.remove("sw-dock-mini");
    }
  }
  addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    },
    { passive: true },
  );
  document.addEventListener("signwell:render", () => {
    acc = 0;
    root.classList.remove("sw-dock-mini");
  });
  onScroll();

  window.SIGNWELL_PUBLIC_LIQUID_NAV = Object.freeze({
    version: VERSION,
    uiVersion: UI_VERSION,
    pages: PAGES.slice(),
    prewarm,
  });
})();

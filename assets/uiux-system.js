/* SIGN WELL · UI/UX enhancement layer (ui 25.1)
   Progressive enhancement only — core rendering in public-core.js stays
   authoritative. Everything here degrades gracefully and honours
   prefers-reduced-motion / prefers-reduced-transparency.

   Open-source inspirations (ideas only — re-implemented in vanilla JS,
   no code copied, no dependencies):
   · Liquid Glass refraction via SVG feDisplacementMap — shuding/liquid-glass,
     rdev/liquid-glass-react
   · Blur-fade reveal, Magic Card spotlight, Number Ticker — Magic UI
   · Image zoom — medium-zoom
   · Table of contents + scrollspy — tocbot                                  */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const mq = (q) => matchMedia(q).matches;
  const reduced = mq("(prefers-reduced-motion: reduce)");
  const lowTransparency = mq("(prefers-reduced-transparency: reduce)");
  const finePointer = mq("(hover: hover) and (pointer: fine)");
  const isChromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand));
  let lowEnd =
    (navigator.deviceMemory && navigator.deviceMemory < 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ||
    !!navigator.connection?.saveData;
  if (lowEnd) root.classList.add("sw-lite");
  // Runtime safety net: repeated long tasks shortly after boot indicate that
  // the current visual tier is too expensive even on nominally capable hardware.
  if (!lowEnd && "PerformanceObserver" in window) {
    try {
      let longTaskScore = 0;
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= 80) longTaskScore += entry.duration;
        }
        if (longTaskScore >= 360 && !root.classList.contains("sw-lite")) {
          lowEnd = true;
          root.classList.add("sw-lite");
          document.querySelectorAll(".sw-lens,.sw-lens-hint").forEach((n) => n.remove());
          po.disconnect();
        }
      });
      po.observe({ type: "longtask", buffered: true });
      setTimeout(() => po.disconnect(), 6500);
    } catch (_) {}
  }
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (_) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (_) {}
    },
  };
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* =====================================================================
     SWGlass — SVG displacement maps for Liquid Glass refraction
     ===================================================================== */
  const SVGNS = "http://www.w3.org/2000/svg",
    XLINK = "http://www.w3.org/1999/xlink";
  let defs = null,
    uid = 0;
  function ensureDefs() {
    if (defs && defs.isConnected) return defs;
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;left:-9999px";
    defs = document.createElementNS(SVGNS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }
  /* Rounded-rect SDF → inward-pointing displacement ramp near the rim.
     R = x offset, G = y offset (0.5 = neutral). Zero outside the shape. */
  function displacementMap(w, h, radius, band) {
    const W = Math.max(4, Math.round(w)),
      H = Math.max(4, Math.round(h));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(W, H),
      d = img.data;
    const hw = W / 2,
      hh = H / 2,
      r = Math.min(radius, hw, hh);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5 - hw,
          py = y + 0.5 - hh;
        const qx = Math.abs(px) - (hw - r),
          qy = Math.abs(py) - (hh - r);
        const ox = Math.max(qx, 0),
          oy = Math.max(qy, 0);
        const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
        let dx = 0,
          dy = 0;
        if (sdf < 0 && -sdf < band) {
          let nx, ny;
          if (qx > 0 && qy > 0) {
            const l = Math.hypot(ox, oy) || 1;
            nx = (ox / l) * Math.sign(px);
            ny = (oy / l) * Math.sign(py);
          } else if (qx > qy) {
            nx = Math.sign(px);
            ny = 0;
          } else {
            nx = 0;
            ny = Math.sign(py);
          }
          const t = 1 + sdf / band; // 1 at rim → 0 at band depth
          const k = t * t * (0.6 + 0.4 * t);
          dx = -nx * k;
          dy = -ny * k;
        }
        const i = (y * W + x) * 4;
        d[i] = 128 + dx * 127;
        d[i + 1] = 128 + dy * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }
  function buildFilter(id, w, h, radius, { band, scale, chroma = 0 } = {}) {
    const dfs = ensureDefs();
    let f = document.getElementById(id);
    if (f) f.remove();
    f = document.createElementNS(SVGNS, "filter");
    f.setAttribute("id", id);
    f.setAttribute("x", "0");
    f.setAttribute("y", "0");
    f.setAttribute("width", String(Math.round(w)));
    f.setAttribute("height", String(Math.round(h)));
    f.setAttribute("filterUnits", "userSpaceOnUse");
    f.setAttribute("primitiveUnits", "userSpaceOnUse");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const url = displacementMap(w, h, radius, band);
    const fe = document.createElementNS(SVGNS, "feImage");
    fe.setAttribute("x", "0");
    fe.setAttribute("y", "0");
    fe.setAttribute("width", String(Math.round(w)));
    fe.setAttribute("height", String(Math.round(h)));
    fe.setAttribute("preserveAspectRatio", "none");
    fe.setAttribute("result", "map");
    fe.setAttribute("href", url);
    fe.setAttributeNS(XLINK, "xlink:href", url);
    f.appendChild(fe);
    const disp = (s, result) => {
      const n = document.createElementNS(SVGNS, "feDisplacementMap");
      n.setAttribute("in", "SourceGraphic");
      n.setAttribute("in2", "map");
      n.setAttribute("scale", String(s));
      n.setAttribute("xChannelSelector", "R");
      n.setAttribute("yChannelSelector", "G");
      if (result) n.setAttribute("result", result);
      f.appendChild(n);
    };
    if (!chroma) disp(scale);
    else {
      const cm = (inp, values, result) => {
        const n = document.createElementNS(SVGNS, "feColorMatrix");
        n.setAttribute("in", inp);
        n.setAttribute("type", "matrix");
        n.setAttribute("values", values);
        n.setAttribute("result", result);
        f.appendChild(n);
      };
      disp(scale * (1 - chroma), "dr");
      cm("dr", "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0", "r");
      disp(scale, "dg");
      cm("dg", "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0", "g");
      disp(scale * (1 + chroma), "db");
      cm("db", "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0", "b");
      const b1 = document.createElementNS(SVGNS, "feBlend");
      b1.setAttribute("in", "r");
      b1.setAttribute("in2", "g");
      b1.setAttribute("mode", "screen");
      b1.setAttribute("result", "rg");
      f.appendChild(b1);
      const b2 = document.createElementNS(SVGNS, "feBlend");
      b2.setAttribute("in", "rg");
      b2.setAttribute("in2", "b");
      b2.setAttribute("mode", "screen");
      f.appendChild(b2);
    }
    dfs.appendChild(f);
    return `url(#${id})`;
  }
  const canRefract = !reduced && !lowTransparency && typeof CSS !== "undefined" && CSS.supports?.("filter", "url(#a)");
  /* backdrop-filter:url() is only honoured by Chromium — elsewhere it would
     void the whole declaration, so it is strictly gated. */
  const canBackdropRefract = canRefract && isChromium && !lowEnd && CSS.supports?.("backdrop-filter", "url(#a) blur(1px)");
  if (canBackdropRefract) root.classList.add("sw-refract");

  function radiusOf(node) {
    const r = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    return Math.min(r, node.offsetHeight / 2, node.offsetWidth / 2);
  }
  function backdropGlass(node, { depth = 0.36, strength = 0.42 } = {}) {
    if (!canBackdropRefract || !node || node._swGlass) return;
    node._swGlass = true;
    const id = "swlg-" + ++uid;
    const update = () => {
      const w = node.offsetWidth,
        h = node.offsetHeight;
      if (!w || !h) return;
      const key = w + "x" + h;
      if (node._swKey === key) return;
      node._swKey = key;
      const m = Math.min(w, h);
      const url = buildFilter(id, w, h, radiusOf(node), { band: m * depth, scale: m * strength });
      const blur = getComputedStyle(node).getPropertyValue("--lg-blur").trim() || "6px";
      node.style.backdropFilter = `${url} blur(${blur}) saturate(var(--lg-sat, 190%)) brightness(var(--lg-bright, 1.05))`;
    };
    update();
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(node);
  }
  /* Capsule lens refraction (filter on the lens content — works cross-engine). */
  function capsuleRefract(control) {
    if (!canRefract || !control || control._swCap) return;
    const lens = $(".lq-lens", control);
    if (!lens) return;
    control._swCap = true;
    const id = "swcap-" + ++uid;
    const update = () => {
      const w = lens.offsetWidth,
        h = lens.offsetHeight;
      if (!w || !h) return;
      const key = w + "x" + h;
      if (control._swKey === key) return;
      control._swKey = key;
      const m = Math.min(w, h);
      control.style.setProperty("--lq-refract", buildFilter(id, w, h, h / 2, { band: m * 0.3, scale: m * 0.2 }));
    };
    update();
    if ("ResizeObserver" in window) new ResizeObserver(update).observe(lens);
  }
  window.SWGlass = { displacementMap, buildFilter, backdropGlass, capsuleRefract, canRefract, canBackdropRefract };

  /* =====================================================================
     Hero lens — draggable SVG-displacement magnifier
     ===================================================================== */
  function mountLens(hero) {
    if (!hero || hero.dataset.swLens || lowTransparency) return;
    hero.dataset.swLens = "1";
    const lens = el("div", "sw-lens", '<div class="sw-lens-view"><div class="sw-lens-stage"></div></div><i class="sw-lens-glint"></i>');
    lens.setAttribute("aria-hidden", "true");
    const hint = el("span", "sw-lens-hint", "拖曳鏡片 ⇆");
    hint.setAttribute("aria-hidden", "true");
    hero.append(lens, hint);
    const view = $(".sw-lens-view", lens),
      stage = $(".sw-lens-stage", lens);
    const M = 1.34;
    let ls = 1; // lens scale (intro pop-in)
    /* The lens paints an exact replica of the page background (same gradient
       layers, offset to the lens position) so the unmagnified originals never
       show through — no masking of page content needed. */
    function syncBackdrop() {
      const cs = getComputedStyle(document.body);
      view.style.backgroundColor = cs.backgroundColor;
      view.style.backgroundImage = cs.backgroundImage;
      view.style.backgroundRepeat = "no-repeat";
    }
    let R = 0,
      cx = 0,
      cy = 0,
      W = 0,
      H = 0,
      clone = null,
      placed = false,
      vx = 0,
      vy = 0,
      raf = 0,
      drag = null;
    const fid = "swlens-" + ++uid;
    function reclone() {
      W = hero.offsetWidth;
      H = hero.offsetHeight;
      R = lens.offsetWidth / 2;
      const c = hero.cloneNode(true);
      $$(".sw-lens,.sw-lens-hint", c).forEach((n) => n.remove());
      $$("[id]", c).forEach((n) => n.removeAttribute("id"));
      c.removeAttribute("data-sw-lens");
      c.classList.add("sw-lens-copy");
      c.setAttribute("aria-hidden", "true");
      try {
        c.inert = true;
      } catch (_) {}
      c.style.width = W + "px";
      c.style.height = H + "px";
      stage.replaceChildren(c);
      clone = c;
      syncBackdrop();
      if (canRefract) view.style.filter = buildFilter(fid, R * 2, R * 2, R, { band: R * 0.5, scale: R * 0.6, chroma: 0.016 });
      if (!placed) home();
      clampPos();
      apply();
    }
    function home() {
      /* rest on the last meaningful glyph of the headline ("…寫清楚。" → 楚):
         a lens that makes "clear" bigger. */
      const line = $(".l2", hero) || $(".l1", hero) || $("h1", hero);
      const hr = hero.getBoundingClientRect();
      let x = W * 0.3,
        y = H * 0.3;
      const tn = line && [...line.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (tn) {
        const chars = Array.from(tn.textContent);
        let k = chars.length - 1;
        while (k > 0 && /[\s。，、！？：；.,!?:;」』）)]/.test(chars[k])) k--;
        const start = chars.slice(0, k).join("").length;
        const rg = document.createRange();
        rg.setStart(tn, start);
        rg.setEnd(tn, start + chars[k].length);
        const f = rg.getBoundingClientRect();
        if (f.width) {
          x = f.left + f.width / 2 - hr.left;
          y = f.top + f.height / 2 - hr.top;
        }
      }
      cx = x;
      cy = y;
      placed = true;
    }
    function clampPos() {
      cx = Math.max(R, Math.min(W - R, cx));
      cy = Math.max(R, Math.min(H - R, cy));
    }
    function apply(squash = 1) {
      const k = squash * ls;
      lens.style.transform = `translate3d(${(cx - R).toFixed(1)}px,${(cy - R).toFixed(1)}px,0) scale(${k.toFixed(3)})`;
      const br = document.body.getBoundingClientRect(),
        hr = hero.getBoundingClientRect();
      view.style.backgroundSize = `${br.width.toFixed(1)}px ${br.height.toFixed(1)}px`;
      view.style.backgroundPosition = `${(br.left - hr.left - cx + R).toFixed(1)}px ${(br.top - hr.top - cy + R).toFixed(1)}px`;
      if (clone) clone.style.transform = `translate3d(${(R - cx * M).toFixed(1)}px,${(R - cy * M).toFixed(1)}px,0) scale(${M})`;
      /* hint sits beside the lens (right if there is room, else left, else below) */
      const hw = hint.offsetWidth,
        hh = hint.offsetHeight;
      let hx = cx + R * k + 10,
        hy = cy - hh / 2;
      if (hx + hw > W) hx = cx - R * k - 10 - hw;
      if (hx < 0) {
        hx = cx - hw / 2;
        hy = cy + R * k + 10;
      }
      hint.style.transform = `translate3d(${hx.toFixed(1)}px,${hy.toFixed(1)}px,0)`;
    }
    function coast() {
      cancelAnimationFrame(raf);
      if (reduced) return;
      const step = () => {
        vx *= 0.92;
        vy *= 0.92;
        cx += vx;
        cy += vy;
        if (cx < R || cx > W - R) {
          vx = -vx * 0.55;
          clampPos();
        }
        if (cy < R || cy > H - R) {
          vy = -vy * 0.55;
          clampPos();
        }
        apply();
        if (Math.abs(vx) + Math.abs(vy) > 0.15) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    lens.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      cancelAnimationFrame(raf);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      vx = vy = 0;
      lens.classList.add("is-grabbed");
      hint.classList.add("is-gone");
      try {
        lens.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    lens.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = performance.now(),
        dt = Math.max(8, now - drag.t);
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      vx = vx * 0.5 + (dx / dt) * 16 * 0.5;
      vy = vy * 0.5 + (dy / dt) * 16 * 0.5;
      cx += dx;
      cy += dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = now;
      clampPos();
      apply(1.06);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      lens.classList.remove("is-grabbed");
      apply(1);
      coast();
    };
    lens.addEventListener("pointerup", end);
    lens.addEventListener("pointercancel", end);
    if ("ResizeObserver" in window) {
      let t = 0;
      new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => hero.isConnected && reclone(), 120);
      }).observe(hero);
    }
    document.fonts?.ready?.then(() => hero.isConnected && reclone());
    hero._swLensRefresh = () => hero.isConnected && reclone();
    /* intro pop-in: scale lens and hole together (spring-ish ease) */
    if (root.classList.contains("sw-intro") && !reduced) {
      ls = 0;
      const t0 = performance.now() + 900,
        dur = 820;
      const ease = (t) => 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.08;
      const pop = (t) => {
        const p = Math.max(0, Math.min(1, (t - t0) / dur));
        ls = p === 1 ? 1 : ease(p);
        apply();
        if (p < 1) requestAnimationFrame(pop);
      };
      requestAnimationFrame(pop);
    }
    reclone();
    setTimeout(() => hint.classList.add("is-gone"), 7000);
  }

  /* =====================================================================
     Reveal (blur-fade), spotlight, number ticker
     ===================================================================== */
  let revealIO = null;
  function setupReveal() {
    if (reduced || !("IntersectionObserver" in window)) return;
    revealIO =
      revealIO ||
      new IntersectionObserver(
        (entries) => {
          let n = 0;
          entries.forEach((x) => {
            if (!x.isIntersecting) return;
            const t = x.target,
              delay = Math.min(n++, 6) * 60;
            t.style.setProperty("--rd", `${delay}ms`);
            t.classList.add("is-visible");
            revealIO.unobserve(t);
            /* hand transitions back to the component once revealed */
            setTimeout(() => {
              t.classList.remove("sw-reveal", "is-visible");
              t.style.removeProperty("--rd");
            }, 1000 + delay);
          });
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
      );
    const vh = innerHeight;
    $$("#app .article-card, #app .topic-card, #app .person-card, #app .recent-list, #app .panel, #app .share-card, #app .newsletter-card, #app .section-head, #app .related").forEach((n) => {
      if (n.dataset.swReveal) return;
      n.dataset.swReveal = "1";
      if (n.getBoundingClientRect().top < vh * 0.94) return; // already on screen: never hide it
      n.classList.add("sw-reveal");
      revealIO.observe(n);
    });
  }
  function setupSpotlight() {
    if (!finePointer || reduced || lowEnd) return;
    let raf = 0,
      last = null;
    document.addEventListener(
      "pointermove",
      (e) => {
        last = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const card = last.target.closest?.(".article-card, .topic-card, .person-card, .hero-card, .recent-row");
          if (!card) return;
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", `${last.clientX - r.left}px`);
          card.style.setProperty("--my", `${last.clientY - r.top}px`);
        });
      },
      { passive: true },
    );
  }
  let tickIO = null;
  function setupTickers() {
    const nodes = $$("[data-count]:not([data-sw-ticked])");
    if (!nodes.length) return;
    const run = (node) => {
      node.dataset.swTicked = "1";
      const to = Number(node.dataset.count) || 0;
      if (reduced || to <= 1 || !root.classList.contains("sw-intro")) {
        node.textContent = to.toLocaleString("zh-TW");
        return;
      }
      const t0 = performance.now(),
        dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur),
          e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        node.textContent = Math.round(to * e).toLocaleString("zh-TW");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!("IntersectionObserver" in window)) return nodes.forEach(run);
    tickIO =
      tickIO ||
      new IntersectionObserver((entries) =>
        entries.forEach((x) => {
          if (x.isIntersecting) {
            tickIO.unobserve(x.target);
            run(x.target);
          }
        }),
      );
    nodes.forEach((n) => {
      n.dataset.swTicked = "0";
      tickIO.observe(n);
    });
  }

  /* =====================================================================
     Reading tools: progress, reader settings (size / typeface), TOC,
     rail, image zoom
     ===================================================================== */
  const SIZES = ["s", "m", "l", "xl"],
    SIZE_LABELS = ["小", "標準", "大", "特大"];
  const FONTS = ["serif", "sans"],
    FONT_LABELS = ["明體", "黑體"];
  function applyReaderPrefs() {
    const size = SIZES.includes(store.get("sw-reader-size")) ? store.get("sw-reader-size") : "m";
    const font = FONTS.includes(store.get("sw-reader-font")) ? store.get("sw-reader-font") : "serif";
    if (size === "m") root.removeAttribute("data-reader-size");
    else root.setAttribute("data-reader-size", size);
    root.classList.toggle("reader-sans", font === "sans");
    return { size, font };
  }
  applyReaderPrefs();

  let progress = null,
    bar = null,
    rail = null,
    readerBtn = null,
    panel = null,
    toc = null,
    headings = [],
    segSize = null,
    segFont = null;
  function ensureChrome() {
    if (!progress) {
      progress = el("div", "sw-reading-progress", "<i></i>");
      progress.setAttribute("aria-hidden", "true");
      document.body.appendChild(progress);
      bar = progress.firstElementChild;
    }
    if (!rail) {
      rail = el(
        "div",
        "sw-rail sw-reading-rail",
        '<button type="button" data-swux-top aria-label="回到文章頂端"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button><button type="button" data-swux-share aria-label="分享這篇文章"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg></button>',
      );
      rail.setAttribute("aria-label", "文章閱讀工具");
      document.body.appendChild(rail);
      $("[data-swux-top]", rail).onclick = () => scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      $("[data-swux-share]", rail).onclick = () => $("#articleShare")?.click();
    }
    const actions = $(".top-actions");
    if (actions && !readerBtn) {
      readerBtn = el(
        "button",
        "iconbtn sw-reader-btn",
        '<svg class="sw-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle class="p" cx="20" cy="20" r="17" pathLength="100"/></svg><span class="aa" aria-hidden="true">Aa</span>',
      );
      readerBtn.type = "button";
      readerBtn.id = "readerBtn";
      readerBtn.setAttribute("aria-label", "閱讀設定與目錄");
      readerBtn.setAttribute("aria-expanded", "false");
      readerBtn.setAttribute("aria-controls", "swReaderPanel");
      actions.prepend(readerBtn);
      readerBtn.onclick = (e) => {
        e.stopPropagation();
        togglePanel();
      };
      backdropGlass(readerBtn);
    }
  }
  function ensurePanel() {
    if (panel) return panel;
    panel = el(
      "div",
      "sw-reader-panel",
      '<div class="rp-head"><strong>閱讀設定</strong><span class="rp-prog" aria-live="polite"></span><button type="button" class="rp-top" data-rp-top>回到頂端 ↑</button></div><div class="rp-row"><span>字級</span><div data-seg="size"></div></div><div class="rp-row"><span>字體</span><div data-seg="font"></div></div><div class="rp-toc"><strong>本文目錄</strong><ol></ol></div>',
    );
    panel.id = "swReaderPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "閱讀設定與目錄");
    document.body.appendChild(panel);
    const prefs = applyReaderPrefs();
    const mount = window.SIGNWELL_CLEAN_PUBLIC?.mountSegmented;
    if (mount) {
      segSize = mount($("[data-seg=size]", panel), {
        labels: SIZE_LABELS,
        index: SIZES.indexOf(prefs.size),
        ariaLabel: "字級",
        onCommit: (i) => {
          store.set("sw-reader-size", SIZES[i]);
          applyReaderPrefs();
          updateReading();
        },
      });
      segFont = mount($("[data-seg=font]", panel), {
        labels: FONT_LABELS,
        index: FONTS.indexOf(prefs.font),
        ariaLabel: "字體",
        onCommit: (i) => {
          store.set("sw-reader-font", FONTS[i]);
          applyReaderPrefs();
          updateReading();
        },
      });
      [segSize, segFont].forEach((s) => capsuleRefract(s.root));
    }
    $("[data-rp-top]", panel).onclick = () => {
      togglePanel(false);
      scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    };
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("is-open")) return;
      if (e.target.closest(".sw-reader-panel, .sw-reader-btn")) return;
      togglePanel(false);
    });
    return panel;
  }
  function togglePanel(force) {
    ensurePanel();
    const open = force ?? !panel.classList.contains("is-open");
    panel.classList.toggle("is-open", open);
    readerBtn?.setAttribute("aria-expanded", String(open));
    if (open) requestAnimationFrame(() => [segSize, segFont].forEach((s) => s?.refresh()));
  }
  function slugify(t, i) {
    return "sec-" + (i + 1);
  }
  function buildToc(article) {
    const body = $(".article-body", article);
    headings = body ? $$("h2, h3", body).filter((h) => h.textContent.trim()) : [];
    headings.forEach((h, i) => {
      if (!h.id) h.id = slugify(h.textContent, i);
    });
    const escA = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const items = headings
      .map((h) => `<li class="lv-${h.tagName.toLowerCase()}"><a href="#${escA(encodeURIComponent(h.id))}" data-toc="${escA(h.id)}">${escA(h.textContent.trim())}</a></li>`)
      .join("");
    ensurePanel();
    $(".rp-toc", panel).hidden = headings.length < 2;
    $(".rp-toc ol", panel).innerHTML = items;
    if (!toc) {
      toc = el("nav", "sw-toc", '<strong>本文目錄</strong><ol></ol><div class="sw-toc-meter"><i></i></div>');
      toc.setAttribute("aria-label", "本文目錄");
      document.body.appendChild(toc);
    }
    $("ol", toc).innerHTML = items;
    toc.classList.toggle("has-items", headings.length >= 2);
    const go = (e) => {
      const a = e.target.closest("[data-toc]");
      if (!a) return;
      e.preventDefault();
      const h = document.getElementById(a.dataset.toc);
      h?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      togglePanel(false);
    };
    toc.onclick = go;
    $(".rp-toc", panel).onclick = go;
  }
  function updateReading() {
    if (!bar) return;
    const article = $(".article-view[data-slug]");
    const on = !!article;
    root.classList.toggle("sw-reading", on);
    if (!on) {
      progress.classList.remove("is-active");
      rail.classList.remove("is-active");
      toc?.classList.remove("is-active");
      bar.style.transform = "scaleX(0)";
      if (panel) togglePanel(false);
      return;
    }
    const body = $(".article-body", article);
    if (!body) return;
    const top = body.getBoundingClientRect().top + scrollY;
    const start = top - innerHeight * 0.2;
    const end = top + body.offsetHeight - innerHeight * 0.6;
    const p = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
    progress.classList.add("is-active");
    rail.classList.toggle("is-active", scrollY > 320);
    toc?.classList.toggle("is-active", scrollY > top - innerHeight * 0.5);
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    readerBtn?.style.setProperty("--p", (p * 100).toFixed(1));
    const meter = $(".sw-toc-meter i", toc || document);
    if (meter) meter.style.transform = `scaleY(${p.toFixed(4)})`;
    if (panel) {
      const mins = Number(article.dataset.minutes || 0);
      const left = Math.max(0, Math.ceil(mins * (1 - p)));
      $(".rp-prog", panel).textContent = `已讀 ${Math.round(p * 100)}%${mins ? ` · 約剩 ${left} 分鐘` : ""}`;
    }
    let cur = -1;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top < 150) cur = i;
      else break;
    }
    const id = cur >= 0 ? headings[cur].id : "";
    $$("[data-toc]").forEach((a) => a.classList.toggle("is-current", a.dataset.toc === id));
  }
  function setupArticle() {
    const article = $(".article-view[data-slug]");
    if (!article || article.dataset.swReader) return;
    article.dataset.swReader = "1";
    if (!article.dataset.minutes) {
      const m = ($(".article-meta", article)?.textContent || "").match(/(?:^|\D)(\d{1,3})\s*分鐘/);
      article.dataset.minutes = m ? m[1] : "";
    }
    buildToc(article);
    $$(".article-body img", article).forEach((img) => {
      if (img.closest("a")) return;
      img.classList.add("sw-zoomable");
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", (img.alt ? img.alt + "，" : "") + "點擊放大圖片");
      img.onclick = () => zoom(img);
      img.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          zoom(img);
        }
      };
    });
    $$(".article-body table", article).forEach((t) => {
      if (t.parentElement.classList.contains("sw-table")) return;
      const w = el("div", "sw-table");
      t.replaceWith(w);
      w.appendChild(t);
    });
  }
  function zoom(img) {
    if (!img.complete || !img.naturalWidth) return;
    const r = img.getBoundingClientRect();
    const ov = el("div", "sw-zoom");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "放大圖片");
    const big = img.cloneNode();
    big.removeAttribute("id");
    big.className = "sw-zoom-img";
    Object.assign(big.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    ov.appendChild(big);
    document.body.appendChild(ov);
    img.style.visibility = "hidden";
    const pad = innerWidth < 700 ? 12 : 40;
    const s = Math.min((innerWidth - pad * 2) / r.width, (innerHeight - pad * 2) / r.height, Math.max(1, img.naturalWidth / r.width) * 1.02);
    const tx = innerWidth / 2 - (r.left + r.width / 2),
      ty = innerHeight / 2 - (r.top + r.height / 2);
    requestAnimationFrame(() => {
      ov.classList.add("is-open");
      big.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${s})`;
    });
    let closed = false;
    const y0 = scrollY;
    const onScroll = () => {
      if (Math.abs(scrollY - y0) > 40) close(); // tolerate momentum / tiny scrolls
    };
    const close = () => {
      if (closed) return;
      closed = true;
      ov.classList.remove("is-open");
      big.style.transform = "none";
      removeEventListener("scroll", onScroll);
      removeEventListener("keydown", onKey);
      setTimeout(() => {
        img.style.visibility = "";
        ov.remove();
      }, reduced ? 0 : 340);
    };
    const onKey = (e) => e.key === "Escape" && close();
    ov.onclick = close;
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("keydown", onKey);
  }

  /* =====================================================================
     Search keyboard navigation + accessible cards
     ===================================================================== */
  function setupSearchKeyboard() {
    const input = $("#searchInput");
    if (!input || input.dataset.swuxKeys === "1") return;
    input.dataset.swuxKeys = "1";
    input.addEventListener("keydown", (e) => {
      const rows = $$(".search-result", $("#searchResults"));
      if (!rows.length) return;
      let i = rows.findIndex((x) => x.classList.contains("active"));
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        rows.forEach((x) => x.classList.remove("active"));
        i = e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i < 0 ? rows.length - 1 : i - 1);
        rows[i].classList.add("active");
        rows[i].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        (rows[i >= 0 ? i : 0]).click();
      }
    });
  }
  function upgradeInteractiveCards() {
    $$("[data-article],[data-topic],[data-sr-article],[data-sr-topic]").forEach((n) => {
      if (n.dataset.swuxA11y === "1" || n.tagName === "BUTTON") return;
      n.dataset.swuxA11y = "1";
      n.tabIndex = 0;
      n.setAttribute("role", n.getAttribute("role") === "option" ? "option" : "link");
      n.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          n.click();
        }
      });
    });
  }

  /* =====================================================================
     Wiring
     ===================================================================== */
  function enhance() {
    ensureChrome();
    upgradeInteractiveCards();
    setupReveal();
    setupTickers();
    setupSearchKeyboard();
    setupArticle();
    const hero = $("#app .hero[data-hero]");
    // Hero refraction lens is a desktop signature interaction only.
    // On touch/coarse pointers it competes with the headline and scrolling.
    if (hero && !reduced && !lowEnd && finePointer) mountLens(hero);
    updateReading();
  }
  function setupGlassChrome() {
    backdropGlass($(".brand-top"), { depth: 0.34, strength: 0.36 });
    backdropGlass($("#searchBtn"), { depth: 0.4, strength: 0.42 });
    backdropGlass($("#pager"), { depth: 0.3, strength: 0.34 });
    capsuleRefract($("#pager"));
    capsuleRefract($("#searchFilter"));
  }
  let raf = 0;
  addEventListener(
    "scroll",
    () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateReading();
      });
    },
    { passive: true },
  );
  addEventListener("resize", () => updateReading(), { passive: true });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel?.classList.contains("is-open")) togglePanel(false);
  });
  const mo = new MutationObserver(() => {
    clearTimeout(mo.t);
    mo.t = setTimeout(enhance, 16);
  });
  mo.observe($("#app") || document.body, { subtree: true, childList: true });
  document.addEventListener("signwell:render", () => {
    clearTimeout(mo.t);
    enhance();
  });
  function init() {
    setupSpotlight();
    setupGlassChrome();
    enhance();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

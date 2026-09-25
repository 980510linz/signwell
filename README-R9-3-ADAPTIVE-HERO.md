SIGN WELL R9.3 ADAPTIVE HERO

Purpose
- Keep the Jelly Glass Hero visually consistent across devices while scaling GPU cost.
- Prevent black flashes during shader compile / context loss.

Runtime rules
HIGH: full ray budget, up to 60 fps, max ~3.0 MP.
MID: reduced ray budget, 50 fps, max ~1.05 MP.
LOW: same torus/material silhouette, 34 fps, max ~0.42 MP.
SAFE: compressed ray budget, 24 fps, max ~0.26 MP.

Selection signals
- prefers-reduced-motion
- navigator.deviceMemory
- navigator.hardwareConcurrency
- saveData / pointer / viewport class
- WebGL MAX_TEXTURE_SIZE and software-renderer detection
- learned per-device tier/quality cached for 7 days

No-black-frame protection
- A lightweight 2D Jelly Glass poster is rendered before WebGL starts.
- WebGL is faded in only after 2 successful frames.
- On context loss, the poster immediately reappears.
- Repeated context loss permanently falls back for that session and stores SAFE for future visits.

Adaptive performance
- frame-time and Long Task pressure reduce internal resolution first
- sustained slowness drops shader tier
- learned tier/quality is cached to avoid repeating an expensive first load
- offscreen rendering remains paused by IntersectionObserver

Caching
- Hero JS/CSS are pre-cached by the service worker
- versioned hero assets use cache-first + background refresh
- index.html preloads the hero script

CMS
- CMS live preview continues to request LOW tier explicitly, preserving responsiveness while using exactly the same Hero code/CSS as Public.

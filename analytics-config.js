window.SIGNWELL_ANALYTICS = {
  enabled: true,
  endpoint: "https://script.google.com/macros/s/AKfycbzmZXZSepxCD1jbfpjMxsnvn0nRl-xEpeXdJoTO-TZL6Z5Zk7T-OsVGpTkIxWaCh-Y/exec"
};

window.SIGNWELL_NEWSLETTER = {
  enabled: true,
  endpoint: "https://script.google.com/macros/s/AKfycbzmZXZSepxCD1jbfpjMxsnvn0nRl-xEpeXdJoTO-TZL6Z5Zk7T-OsVGpTkIxWaCh-Y/exec"
};

// Email OTP v24.2.0: first send is frictionless. If Turnstile is configured, repeat/high-risk sends use it.
// If it is not configured or Cloudflare is temporarily unavailable, normal resends remain usable under a stricter
// email + device + global rate-limit fallback (2 sends/day instead of 5). Set the site key here and
// SW_TURNSTILE_SECRET in Apps Script Script Properties when you want the full 5-send/day challenge path.
window.SIGNWELL_TURNSTILE_SITE_KEY = window.SIGNWELL_TURNSTILE_SITE_KEY || "";

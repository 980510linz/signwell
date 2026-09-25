# SIGN WELL R9.4 Social Preview

This release updates Public share thumbnails to match the current Jelly Glass hero.

## Social preview assets
- assets/social/signwell-share-r9-4-20260925.jpg — 1200x630 Open Graph / LINE / Facebook / Discord / Slack / iMessage / X
- assets/social/signwell-share-square-r9-4-20260925.jpg — 1080x1080 companion asset

## Metadata
Public HTML pages now include canonical, Open Graph and Twitter Card metadata. The image filename is versioned to avoid stale LINE/social crawler caches.

## Notes
Article URLs currently use the same brand-level preview because the Public site is a query-string SPA. Article-specific crawler thumbnails require prerendered article HTML or a server-side edge renderer.

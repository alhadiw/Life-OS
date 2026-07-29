Self-hosted webfonts for Life OS (PWA-6)
========================================

These replace the render-blocking Google Fonts CDN <link>. Both families are
served by Google Fonts as VARIABLE fonts, so one file per subset covers every
weight the app uses — four files instead of twelve.

  inter-latin.woff2       Inter, weights 400-600, U+0000-00FF and friends
  inter-latin-ext.woff2   Inter, weights 400-600, Latin Extended
  outfit-latin.woff2      Outfit, weights 500-700, U+0000-00FF and friends
  outfit-latin-ext.woff2  Outfit, weights 500-700, Latin Extended

The `latin-ext` files only download when a page actually renders a character in
that range — that is what the `unicode-range` descriptors in src/fonts.css are
for. English-only usage pays for the two `latin` files and nothing else.

Licensing
---------
Both are licensed under the SIL Open Font License, Version 1.1 (see OFL.txt),
which permits redistribution as part of this app.

  Inter   Copyright 2020 The Inter Project Authors
          https://github.com/rsms/inter
  Outfit  Copyright 2021 The Outfit Project Authors
          https://github.com/Outfitio/Outfit-Fonts

Updating
--------
Request the CSS from Google Fonts with a modern browser User-Agent (an old UA
gets you .ttf instead of .woff2), then download the URLs it hands back:

  curl -A "Mozilla/5.0 ... Chrome/126.0.0.0 ..." \
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap'

Keep the `unicode-range` values in src/fonts.css in sync with that response.

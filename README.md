[![Make GTA 6 Cover Art](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/Erwinsays12/makefun-vice-cover-studio/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/Erwinsays12/makefun-vice-cover-studio/reward.svg)](https://make.fun/c/gta6-cover-art-01)

# Vice Cover Studio — GTA-style cover art maker

An entry for the [Make GTA 6 Cover Art competition on make.fun](https://make.fun/c/gta6-cover-art-01):
a web app that turns your own photo and a caption into a multi-panel poster
in the style of GTA 6's covers — diagonal photo panels over a procedural
Vice City sunset, bold gradient lettering, print effects — exported as a PNG
to share. It runs entirely from static files, in a desktop browser, with no
network requests and no uploads: your photos never leave your machine.

## How to use it

1. Open `app/index.html` in a desktop browser (or serve `app/` with any
   static file server).
2. Add your photos — click **Add photos from your machine**, or try
   **Load sample photos** first.
3. Click a photo in the tray to place it in the selected panel, or
   **Fill all panels with first photo** to use one photo everywhere.
4. Click any panel on the cover to select it, drag it to reposition the
   photo, and use the zoom slider.
5. Pick a layout, a colour grade, print effects and a caption style; type
   your title and subtitle.
6. Choose an export size and press **Export PNG**.

## What is inside

- **5 layouts** — Vice Grid (5 panels), Sunset Trio (3), Hero Duo (2),
  Quad (4) and Solo (1 full-bleed photo), all with slanted poster edges.
- **Crop and position per panel** — click a panel to select it, drag to pan,
  zoom slider from 100% to 300%. One photo can fill several panels, or each
  panel can hold a different photo.
- **4 colour grades** — Sunset, Neon, Teal and Mono, applied to every panel
  plus a matching tint over the whole cover.
- **Print effects** — halftone dots sampled from the cover's own luminance,
  seeded film grain and a vignette. All deterministic: the same settings
  always export the same PNG.
- **Bold caption lettering** — Anton (SIL Open Font License, shipped under
  `app/fonts/`) in three gradient styles, with a hard outline and a
  subtitle in tracked capitals.
- **Export sizes** — 1080 × 1080, 1080 × 1350 and 1920 × 1080 PNG.
- **Demo and shot modes** — `?demo=1` loads the bundled sample photos;
  `?shot=cover&size=wide|square|portrait` draws the cover full-frame for
  screenshots.

## Files

- `app/index.html` — the editor page.
- `app/style.css` — the editor chrome.
- `app/src/cover.js` — the cover renderer: layouts, sunset backdrop,
  panels, grades, halftone, grain, vignette and caption.
- `app/src/main.js` — editor wiring: photo tray, panel picking and
  dragging, controls, PNG export, demo/shot modes.
- `app/fonts/Anton-Regular.ttf` (+ `OFL.txt`) — the display face.
- `app/samples/` — two sample photos made for make.fun, free to use.
- `main.ts` — copies `app/` and `screenshots/` to the output directory and
  writes `dossier.json` with `buildDossier` from `vendor/makefun-app.ts`.
- `screenshots/` — the cover and the editor at work.

## Originality

Everything on the cover is original: the sunset sky, skyline and palm
silhouettes are drawn procedurally in code, the lettering uses Anton (not a
Rockstar font), and no Rockstar Games logo, wordmark or artwork appears
anywhere. The sample photos were made with an image model for make.fun.

/* Vice Cover Studio — cover renderer.
 *
 * Draws a multi-panel GTA-style poster cover onto a canvas: a procedural
 * sunset sky with sun, skyline and palm silhouettes behind diagonal photo
 * panels, a colour grade, halftone dots, film grain, a vignette and a bold
 * Anton caption. Everything is deterministic for a given state + seed, so
 * the same settings always export the same PNG.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Layouts: every panel is a polygon in unit coordinates (0..1).      */
/* The slanted edges give the collage its poster feel.                */
/* ------------------------------------------------------------------ */

const VICE_LAYOUTS = {
  'vice-grid': {
    label: 'Vice Grid',
    panels: [
      [[0.00, 0.00], [0.58, 0.00], [0.52, 1.00], [0.00, 1.00]],
      [[0.62, 0.00], [1.00, 0.00], [1.00, 0.28], [0.58, 0.28]],
      [[0.60, 0.32], [1.00, 0.32], [1.00, 0.52], [0.56, 0.52]],
      [[0.58, 0.56], [1.00, 0.56], [1.00, 0.76], [0.54, 0.76]],
      [[0.56, 0.80], [1.00, 0.80], [1.00, 1.00], [0.52, 1.00]],
    ],
  },
  'sunset-trio': {
    label: 'Sunset Trio',
    panels: [
      [[0.00, 0.00], [0.36, 0.00], [0.32, 1.00], [0.00, 1.00]],
      [[0.38, 0.00], [0.70, 0.00], [0.66, 1.00], [0.34, 1.00]],
      [[0.72, 0.00], [1.00, 0.00], [1.00, 1.00], [0.68, 1.00]],
    ],
  },
  'hero-duo': {
    label: 'Hero Duo',
    panels: [
      [[0.00, 0.00], [0.62, 0.00], [0.48, 1.00], [0.00, 1.00]],
      [[0.66, 0.00], [1.00, 0.00], [1.00, 1.00], [0.52, 1.00]],
    ],
  },
  quad: {
    label: 'Quad',
    panels: [
      [[0.00, 0.00], [0.52, 0.00], [0.48, 0.48], [0.00, 0.48]],
      [[0.54, 0.00], [1.00, 0.00], [1.00, 0.48], [0.50, 0.48]],
      [[0.00, 0.52], [0.48, 0.52], [0.52, 1.00], [0.00, 1.00]],
      [[0.50, 0.52], [1.00, 0.52], [1.00, 1.00], [0.54, 1.00]],
    ],
  },
  solo: {
    label: 'Solo',
    panels: [
      [[0.00, 0.00], [1.00, 0.00], [1.00, 1.00], [0.00, 1.00]],
    ],
  },
};

const VICE_LAYOUT_IDS = Object.keys(VICE_LAYOUTS);

/* ------------------------------------------------------------------ */
/* Colour grades: a canvas filter for the photo plus a tint overlay.  */
/* ------------------------------------------------------------------ */

const VICE_GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.35) contrast(1.08) sepia(0.22) hue-rotate(-8deg)',
    tintTop: 'rgba(255, 122, 61, 0.10)',
    tintBottom: 'rgba(255, 64, 129, 0.12)',
    blend: 'soft-light',
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.65) contrast(1.15) hue-rotate(16deg)',
    tintTop: 'rgba(0, 229, 255, 0.10)',
    tintBottom: 'rgba(255, 0, 170, 0.14)',
    blend: 'overlay',
  },
  teal: {
    label: 'Teal',
    filter: 'saturate(1.15) contrast(1.06) sepia(0.18) hue-rotate(115deg)',
    tintTop: 'rgba(0, 200, 190, 0.10)',
    tintBottom: 'rgba(0, 60, 110, 0.14)',
    blend: 'soft-light',
  },
  mono: {
    label: 'Mono',
    filter: 'grayscale(1) contrast(1.18) brightness(1.04)',
    tintTop: 'rgba(255, 255, 255, 0.05)',
    tintBottom: 'rgba(0, 0, 0, 0.10)',
    blend: 'soft-light',
  },
};

const VICE_GRADE_IDS = Object.keys(VICE_GRADES);

/* ------------------------------------------------------------------ */
/* Caption styles: gradient fills for the big Anton lettering.        */
/* ------------------------------------------------------------------ */

const VICE_CAPTION_STYLES = {
  sunset: {
    label: 'Sunset Pop',
    stops: [[0, '#ffe259'], [0.45, '#ff7e3d'], [0.75, '#ff3d81'], [1, '#c724b1']],
  },
  neon: {
    label: 'Neon Nights',
    stops: [[0, '#a6ffcb'], [0.4, '#12d8fa'], [0.7, '#a6ffcb'], [1, '#ff00c8']],
  },
  gold: {
    label: 'Gold Rush',
    stops: [[0, '#fff7ae'], [0.5, '#ffd23d'], [1, '#ff8a00']],
  },
};

const VICE_CAPTION_STYLE_IDS = Object.keys(VICE_CAPTION_STYLES);

/* ------------------------------------------------------------------ */
/* Export sizes: the common post sizes.                               */
/* ------------------------------------------------------------------ */

const VICE_EXPORT_SIZES = {
  square: { label: 'Square · 1080 × 1080', width: 1080, height: 1080 },
  portrait: { label: 'Portrait · 1080 × 1350', width: 1080, height: 1350 },
  wide: { label: 'Wide · 1920 × 1080', width: 1920, height: 1080 },
};

const VICE_EXPORT_SIZE_IDS = Object.keys(VICE_EXPORT_SIZES);

/* ------------------------------------------------------------------ */
/* Small deterministic helpers.                                       */
/* ------------------------------------------------------------------ */

/** Mulberry32: a tiny seeded PRNG so grain and palms never wobble. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonBounds(polygon) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of polygon) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function tracePolygonPath(ctx, polygon, width, height) {
  ctx.beginPath();
  polygon.forEach((point, index) => {
    const x = point[0] * width;
    const y = point[1] * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Backdrop: sunset sky, sun disc, skyline and palm silhouettes.      */
/* ------------------------------------------------------------------ */

function drawSunsetSky(ctx, width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0.0, '#2b0a4a');
  sky.addColorStop(0.35, '#7b1e6e');
  sky.addColorStop(0.62, '#e8446c');
  sky.addColorStop(0.85, '#ff8a3d');
  sky.addColorStop(1.0, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Low sun with a warm halo.
  const sunX = width * 0.74;
  const sunY = height * 0.3;
  const sunR = width * 0.15;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.4);
  halo.addColorStop(0, 'rgba(255, 214, 120, 0.55)');
  halo.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  const sun = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sun.addColorStop(0, '#fff3b0');
  sun.addColorStop(0.6, '#ffd23d');
  sun.addColorStop(1, '#ff7e3d');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkylineSilhouette(ctx, width, height) {
  const rng = seededRandom(20261119);
  const baseY = height * 0.98;
  ctx.fillStyle = 'rgba(26, 8, 44, 0.85)';
  let x = -width * 0.02;
  while (x < width * 1.02) {
    const bw = width * (0.05 + rng() * 0.07);
    const bh = height * (0.1 + rng() * 0.22);
    ctx.fillRect(x, baseY - bh, bw, bh);
    if (rng() > 0.72) {
      // A rooftop antenna on some towers.
      ctx.fillRect(x + bw * 0.45, baseY - bh - height * 0.06, width * 0.006, height * 0.06);
    }
    x += bw + width * 0.008;
  }
}

function drawPalmSilhouette(ctx, x, y, size, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = 'round';
  // Curved trunk.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.55, size * 0.02, -size);
  ctx.stroke();
  // Fronds fanning from the crown.
  const crownX = size * 0.02;
  const crownY = -size;
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (0.08 + (i / 6) * 0.84);
    const len = size * (0.42 + (i % 2) * 0.12);
    const tipX = crownX + Math.cos(angle) * len;
    const tipY = crownY - Math.abs(Math.sin(angle)) * len * 0.55 + len * 0.18;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + Math.cos(angle) * len * 0.5,
      crownY - Math.abs(Math.sin(angle)) * len * 0.7,
      tipX,
      tipY,
    );
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(crownX - size * 0.03, crownY + size * 0.05, size * 0.035, 0, Math.PI * 2);
  ctx.arc(crownX + size * 0.04, crownY + size * 0.06, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawViceBackdrop(ctx, width, height) {
  drawSunsetSky(ctx, width, height);
  drawSkylineSilhouette(ctx, width, height);
  const palmColor = 'rgba(22, 8, 38, 0.92)';
  drawPalmSilhouette(ctx, width * 0.06, height * 0.99, height * 0.34, -0.1, palmColor);
  drawPalmSilhouette(ctx, width * 0.97, height * 1.0, height * 0.42, 0.12, palmColor);
  drawPalmSilhouette(ctx, width * 0.9, height * 0.99, height * 0.24, 0.06, palmColor);
}

/* ------------------------------------------------------------------ */
/* Panels: photo placement, empty-panel fill, white grid lines.       */
/* ------------------------------------------------------------------ */

function coverFitPlacement(panel, image, transform, width, height) {
  const bounds = polygonBounds(panel);
  const panelW = bounds.w * width;
  const panelH = bounds.h * height;
  const zoom = transform && transform.zoom ? transform.zoom : 1;
  const scale =
    Math.max(panelW / image.naturalWidth, panelH / image.naturalHeight) * zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const centerX = (bounds.x + bounds.w / 2) * width + (transform ? transform.ox || 0 : 0) * panelW;
  const centerY = (bounds.y + bounds.h / 2) * height + (transform ? transform.oy || 0 : 0) * panelH;
  return { x: centerX - drawW / 2, y: centerY - drawH / 2, w: drawW, h: drawH };
}

function drawEmptyPanel(ctx, panel, index, width, height) {
  const bounds = polygonBounds(panel);
  const fill = ctx.createLinearGradient(
    bounds.x * width,
    bounds.y * height,
    (bounds.x + bounds.w) * width,
    (bounds.y + bounds.h) * height,
  );
  fill.addColorStop(0, '#4a1160');
  fill.addColorStop(1, '#c22a72');
  ctx.fillStyle = fill;
  tracePolygonPath(ctx, panel, width, height);
  ctx.fill();
  // Big ghost number so an empty panel reads as a slot, not a hole.
  const cx = (bounds.x + bounds.w / 2) * width;
  const cy = (bounds.y + bounds.h / 2) * height;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.font = `${Math.round(Math.min(bounds.w * width, bounds.h * height) * 0.42)}px Anton, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), cx, cy);
  ctx.restore();
}

function drawCoverPanel(ctx, panel, index, image, transform, grade, width, height) {
  ctx.save();
  tracePolygonPath(ctx, panel, width, height);
  ctx.clip();
  if (image) {
    const place = coverFitPlacement(panel, image, transform, width, height);
    ctx.filter = grade.filter;
    ctx.drawImage(image, place.x, place.y, place.w, place.h);
    ctx.filter = 'none';
  } else {
    drawEmptyPanel(ctx, panel, index, width, height);
  }
  ctx.restore();
  // Crisp white seam around every panel.
  ctx.save();
  tracePolygonPath(ctx, panel, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(2, width * 0.0035);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Print effects: halftone dots, film grain, vignette, grade tint.    */
/* ------------------------------------------------------------------ */

function applyHalftoneDots(ctx, width, height, strength) {
  const cell = Math.max(9, Math.round(width / 150));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const sample = document.createElement('canvas');
  sample.width = cols;
  sample.height = rows;
  const sampleCtx = sample.getContext('2d');
  sampleCtx.drawImage(ctx.canvas, 0, 0, cols, rows);
  const pixels = sampleCtx.getImageData(0, 0, cols, rows).data;
  ctx.save();
  ctx.fillStyle = '#12041f';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const at = (row * cols + col) * 4;
      const luminance = (pixels[at] * 0.299 + pixels[at + 1] * 0.587 + pixels[at + 2] * 0.114) / 255;
      const darkness = 1 - luminance;
      if (darkness < 0.35) continue;
      const radius = ((darkness - 0.35) / 0.65) * (cell * 0.52) * strength;
      if (radius < 0.4) continue;
      ctx.globalAlpha = 0.34 * strength;
      ctx.beginPath();
      ctx.arc(col * cell + cell / 2, row * cell + cell / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function applyFilmGrain(ctx, width, height, seed, amount) {
  const tile = 160;
  const noise = document.createElement('canvas');
  noise.width = tile;
  noise.height = tile;
  const noiseCtx = noise.getContext('2d');
  const imageData = noiseCtx.createImageData(tile, tile);
  const rng = seededRandom(seed);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const value = Math.floor(rng() * 255);
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = 255;
  }
  noiseCtx.putImageData(imageData, 0, 0);
  const pattern = ctx.createPattern(noise, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function applyVignette(ctx, width, height) {
  const radius = Math.hypot(width, height) / 2;
  const shade = ctx.createRadialGradient(
    width / 2,
    height / 2,
    radius * 0.45,
    width / 2,
    height / 2,
    radius,
  );
  shade.addColorStop(0, 'rgba(10, 2, 20, 0)');
  shade.addColorStop(1, 'rgba(10, 2, 20, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

function applyGradeTint(ctx, width, height, grade) {
  const tint = ctx.createLinearGradient(0, 0, 0, height);
  tint.addColorStop(0, grade.tintTop);
  tint.addColorStop(1, grade.tintBottom);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Caption: huge Anton lettering with a gradient fill and hard edge.  */
/* ------------------------------------------------------------------ */

function drawCoverCaption(ctx, width, height, caption, subtitle, styleId) {
  const text = (caption || '').trim().toUpperCase();
  if (!text) return;
  const style = VICE_CAPTION_STYLES[styleId] || VICE_CAPTION_STYLES.sunset;

  // Soft dark band so the lettering reads over any photo.
  const band = ctx.createLinearGradient(0, height * 0.68, 0, height);
  band.addColorStop(0, 'rgba(18, 4, 31, 0)');
  band.addColorStop(1, 'rgba(18, 4, 31, 0.6)');
  ctx.fillStyle = band;
  ctx.fillRect(0, height * 0.68, width, height * 0.32);

  ctx.save();
  ctx.translate(width / 2, height * 0.9);
  ctx.rotate(-0.03);
  ctx.translate(-width / 2, -height * 0.9);

  let fontPx = Math.round(width * 0.13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (px) => {
    ctx.font = `${px}px Anton, 'Arial Black', sans-serif`;
  };
  setFont(fontPx);
  while (ctx.measureText(text).width > width * 0.94 && fontPx > 24) {
    fontPx -= 4;
    setFont(fontPx);
  }
  const baselineY = height * 0.92;
  const fill = ctx.createLinearGradient(0, baselineY - fontPx, 0, baselineY + fontPx * 0.12);
  for (const stop of style.stops) fill.addColorStop(stop[0], stop[1]);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#14041f';
  ctx.lineWidth = Math.max(4, fontPx * 0.09);
  ctx.strokeText(text, width / 2, baselineY);
  ctx.fillStyle = fill;
  ctx.fillText(text, width / 2, baselineY);
  // Thin hot highlight along the top of the letters.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(1, fontPx * 0.012);
  ctx.strokeText(text, width / 2, baselineY - fontPx * 0.02);

  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subPx = Math.max(14, Math.round(width * 0.026));
    ctx.font = `700 ${subPx}px 'Arial Narrow', Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(subPx * 0.35)}px`;
    } catch (err) {
      /* letterSpacing is optional; plain text still reads fine. */
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(20, 4, 31, 0.85)';
    ctx.lineWidth = Math.max(2, subPx * 0.14);
    ctx.strokeText(sub, width / 2, height * 0.965);
    ctx.fillText(sub, width / 2, height * 0.965);
    try {
      ctx.letterSpacing = '0px';
    } catch (err) {
      /* ignore */
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Main entry: render a whole cover onto a canvas of the given size.  */
/* ------------------------------------------------------------------ */

function renderViceCover(canvas, state) {
  const width = state.width;
  const height = state.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const layout = VICE_LAYOUTS[state.layout] || VICE_LAYOUTS['vice-grid'];
  const grade = VICE_GRADES[state.grade] || VICE_GRADES.sunset;
  const seed = typeof state.seed === 'number' ? state.seed : 7;

  drawViceBackdrop(ctx, width, height);
  layout.panels.forEach((panel, index) => {
    const photoIndex =
      state.panelPhotos && index < state.panelPhotos.length ? state.panelPhotos[index] : -1;
    const image =
      photoIndex >= 0 && state.photos && state.photos[photoIndex]
        ? state.photos[photoIndex].image
        : null;
    const transform =
      state.panelTransforms && state.panelTransforms[index]
        ? state.panelTransforms[index]
        : { zoom: 1, ox: 0, oy: 0 };
    drawCoverPanel(ctx, panel, index, image, transform, grade, width, height);
  });

  applyGradeTint(ctx, width, height, grade);
  if (state.halftone) applyHalftoneDots(ctx, width, height, 1);
  if (state.grain) applyFilmGrain(ctx, width, height, seed, 0.5);
  if (state.vignette) applyVignette(ctx, width, height);
  drawCoverCaption(ctx, width, height, state.caption, state.subtitle, state.captionStyle);
  return canvas;
}

/** Hit-test a point (in canvas pixels) against the layout's panels. */
function pickCoverPanel(layoutId, x, y, width, height) {
  const layout = VICE_LAYOUTS[layoutId] || VICE_LAYOUTS['vice-grid'];
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const panel = layout.panels[i];
    const unitX = x / width;
    const unitY = y / height;
    if (pointInPolygon(unitX, unitY, panel)) return i;
  }
  return -1;
}

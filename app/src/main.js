/* Vice Cover Studio — editor wiring.
 *
 * Owns the editor state, the photo tray, panel picking and dragging,
 * the control panel, PNG export and the demo / shot / self-test modes
 * the maker uses for screenshots. The cover itself is drawn by cover.js.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

const MAX_PANELS = 5;

const editorState = {
  layout: 'vice-grid',
  grade: 'sunset',
  captionStyle: 'sunset',
  caption: 'VICE HEAT',
  subtitle: 'NEON NIGHTS · SUNSET DRIVE',
  exportSize: 'square',
  halftone: true,
  grain: true,
  vignette: true,
  seed: 7,
  photos: [], // { image, name }
  panelPhotos: [-1, -1, -1, -1, -1],
  panelTransforms: [
    { zoom: 1, ox: 0, oy: 0 },
    { zoom: 1, ox: 0, oy: 0 },
    { zoom: 1, ox: 0, oy: 0 },
    { zoom: 1, ox: 0, oy: 0 },
    { zoom: 1, ox: 0, oy: 0 },
  ],
  selectedPanel: 0,
};

const DEMO_PHOTOS = [
  { src: 'samples/boulevard.jpg', name: 'Boulevard (sample)' },
  { src: 'samples/pier.jpg', name: 'Pier (sample)' },
];

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Preview rendering                                                  */
/* ------------------------------------------------------------------ */

let previewQueued = false;

function currentExportSize() {
  return VICE_EXPORT_SIZES[editorState.exportSize] || VICE_EXPORT_SIZES.square;
}

function renderPreview() {
  const canvas = $('previewCanvas');
  const size = currentExportSize();
  const state = Object.assign({}, editorState, {
    width: size.width,
    height: size.height,
  });
  renderViceCover(canvas, state);
  updateSelectedPanelLabel();
}

function queuePreviewRender() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(() => {
    previewQueued = false;
    renderPreview();
  });
}

function updateSelectedPanelLabel() {
  const label = $('selectedPanelLabel');
  const zoom = $('zoomSlider');
  const transform = editorState.panelTransforms[editorState.selectedPanel];
  if (label) {
    label.textContent = `Panel ${editorState.selectedPanel + 1} selected — drag it to reposition the photo.`;
  }
  if (zoom && transform) {
    zoom.value = String(Math.round(transform.zoom * 100));
    $('zoomValue').textContent = `${Math.round(transform.zoom * 100)}%`;
  }
}

/* ------------------------------------------------------------------ */
/* Photos: upload, tray, demo samples, assigning to panels.           */
/* ------------------------------------------------------------------ */

function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

async function addPhotoFromUrl(src, name) {
  const image = await loadImageFromUrl(src);
  editorState.photos.push({ image, name });
  return editorState.photos.length - 1;
}

function refreshPhotoTray() {
  const tray = $('photoTray');
  tray.innerHTML = '';
  editorState.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tray-photo';
    button.title = `${photo.name} — click to place in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.image.src;
    thumb.alt = photo.name;
    button.appendChild(thumb);
    const caption = document.createElement('span');
    caption.textContent = photo.name;
    button.appendChild(caption);
    button.addEventListener('click', () => {
      assignPhotoToSelectedPanel(index);
    });
    tray.appendChild(button);
  });
  const empty = $('trayEmpty');
  if (empty) empty.style.display = editorState.photos.length ? 'none' : 'block';
}

function assignPhotoToSelectedPanel(photoIndex) {
  editorState.panelPhotos[editorState.selectedPanel] = photoIndex;
  queuePreviewRender();
}

function fillAllPanelsWithPhoto(photoIndex) {
  const count = panelCount();
  for (let i = 0; i < count; i++) editorState.panelPhotos[i] = photoIndex;
  queuePreviewRender();
}

function panelCount() {
  const layout = VICE_LAYOUTS[editorState.layout] || VICE_LAYOUTS['vice-grid'];
  return layout.panels.length;
}

async function loadDemoPhotos() {
  const note = $('demoNote');
  if (note) note.textContent = 'Loading sample photos…';
  try {
    for (const demo of DEMO_PHOTOS) {
      const already = editorState.photos.findIndex((p) => p.name === demo.name);
      if (already < 0) await addPhotoFromUrl(demo.src, demo.name);
    }
    const boulevard = editorState.photos.findIndex((p) => p.name === DEMO_PHOTOS[0].name);
    const pier = editorState.photos.findIndex((p) => p.name === DEMO_PHOTOS[1].name);
    const pattern = [boulevard, pier, boulevard, pier, boulevard];
    for (let i = 0; i < MAX_PANELS; i++) editorState.panelPhotos[i] = pattern[i];
    // Nudge the pier photo down in the short right-hand panels so the
    // fisherman's face, not just his torso, lands inside the crop.
    const demoTransforms = [
      { zoom: 1, oy: 0 },
      { zoom: 1.2, oy: 0.35 },
      { zoom: 1.05, oy: 0 },
      { zoom: 1.2, oy: 0.25 },
      { zoom: 1.05, oy: 0 },
    ];
    demoTransforms.forEach((t, i) => {
      editorState.panelTransforms[i] = { zoom: t.zoom, ox: 0, oy: t.oy };
    });
    refreshPhotoTray();
    queuePreviewRender();
    if (note) note.textContent = 'Sample photos loaded — click a photo, then a panel, to move it.';
  } catch (err) {
    if (note) note.textContent = `Sample photos failed to load: ${err.message}`;
  }
}

function wirePhotoUpload() {
  const input = $('photoInput');
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ dataUrl: reader.result, name: file.name });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }),
    );
    Promise.all(readers).then(async (loaded) => {
      for (const item of loaded) {
        if (!item) continue;
        try {
          await addPhotoFromUrl(item.dataUrl, item.name);
        } catch (err) {
          /* A bad file is skipped; the rest still load. */
        }
      }
      refreshPhotoTray();
      // First upload fills every empty panel so the cover is alive at once.
      const first = editorState.photos.length - files.length;
      for (let i = 0; i < panelCount(); i++) {
        if (editorState.panelPhotos[i] < 0 && first >= 0) {
          editorState.panelPhotos[i] = first;
        }
      }
      queuePreviewRender();
      input.value = '';
    });
  });
  $('fillAllButton').addEventListener('click', () => {
    if (editorState.photos.length) fillAllPanelsWithPhoto(0);
  });
  $('demoButton').addEventListener('click', loadDemoPhotos);
}

/* ------------------------------------------------------------------ */
/* Control panel: layout, grade, effects, caption, export size.       */
/* ------------------------------------------------------------------ */

function buildChoiceButtons(containerId, ids, labels, current, onPick) {
  const container = $(containerId);
  container.innerHTML = '';
  ids.forEach((id, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button' + (id === current ? ' active' : '');
    button.textContent = labels[index];
    button.addEventListener('click', () => {
      onPick(id);
      container.querySelectorAll('.choice-button').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
    });
    container.appendChild(button);
  });
}

function wireControlPanel() {
  buildChoiceButtons(
    'layoutChoices',
    VICE_LAYOUT_IDS,
    VICE_LAYOUT_IDS.map((id) => VICE_LAYOUTS[id].label),
    editorState.layout,
    (id) => {
      editorState.layout = id;
      if (editorState.selectedPanel >= panelCount()) editorState.selectedPanel = 0;
      queuePreviewRender();
    },
  );
  buildChoiceButtons(
    'gradeChoices',
    VICE_GRADE_IDS,
    VICE_GRADE_IDS.map((id) => VICE_GRADES[id].label),
    editorState.grade,
    (id) => {
      editorState.grade = id;
      queuePreviewRender();
    },
  );
  buildChoiceButtons(
    'captionStyleChoices',
    VICE_CAPTION_STYLE_IDS,
    VICE_CAPTION_STYLE_IDS.map((id) => VICE_CAPTION_STYLES[id].label),
    editorState.captionStyle,
    (id) => {
      editorState.captionStyle = id;
      queuePreviewRender();
    },
  );
  buildChoiceButtons(
    'exportSizeChoices',
    VICE_EXPORT_SIZE_IDS,
    VICE_EXPORT_SIZE_IDS.map((id) => VICE_EXPORT_SIZES[id].label),
    editorState.exportSize,
    (id) => {
      editorState.exportSize = id;
      queuePreviewRender();
    },
  );

  const captionInput = $('captionInput');
  captionInput.value = editorState.caption;
  captionInput.addEventListener('input', () => {
    editorState.caption = captionInput.value;
    queuePreviewRender();
  });
  const subtitleInput = $('subtitleInput');
  subtitleInput.value = editorState.subtitle;
  subtitleInput.addEventListener('input', () => {
    editorState.subtitle = subtitleInput.value;
    queuePreviewRender();
  });

  const bindToggle = (id, key) => {
    const box = $(id);
    box.checked = editorState[key];
    box.addEventListener('change', () => {
      editorState[key] = box.checked;
      queuePreviewRender();
    });
  };
  bindToggle('halftoneToggle', 'halftone');
  bindToggle('grainToggle', 'grain');
  bindToggle('vignetteToggle', 'vignette');

  const zoom = $('zoomSlider');
  zoom.addEventListener('input', () => {
    const transform = editorState.panelTransforms[editorState.selectedPanel];
    transform.zoom = Number(zoom.value) / 100;
    $('zoomValue').textContent = `${zoom.value}%`;
    queuePreviewRender();
  });
  $('resetPanelButton').addEventListener('click', () => {
    editorState.panelTransforms[editorState.selectedPanel] = { zoom: 1, ox: 0, oy: 0 };
    queuePreviewRender();
  });
  $('exportButton').addEventListener('click', exportCoverPng);
}

/* ------------------------------------------------------------------ */
/* Canvas interaction: pick a panel, drag to pan its photo.            */
/* ------------------------------------------------------------------ */

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function wireCanvasDragging() {
  const canvas = $('previewCanvas');
  let dragging = false;
  let last = null;

  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event, canvas);
    const picked = pickCoverPanel(editorState.layout, point.x, point.y, canvas.width, canvas.height);
    if (picked < 0) return;
    editorState.selectedPanel = picked;
    updateSelectedPanelLabel();
    dragging = true;
    last = point;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || !last) return;
    const point = canvasPoint(event, canvas);
    const transform = editorState.panelTransforms[editorState.selectedPanel];
    transform.ox += (point.x - last.x) / canvas.width;
    transform.oy += (point.y - last.y) / canvas.height;
    transform.ox = Math.max(-1, Math.min(1, transform.ox));
    transform.oy = Math.max(-1, Math.min(1, transform.oy));
    last = point;
    queuePreviewRender();
  });
  const stopDragging = () => {
    dragging = false;
    last = null;
  };
  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
}

/* ------------------------------------------------------------------ */
/* Export: render at full size and download the PNG.                   */
/* ------------------------------------------------------------------ */

function exportCoverPng() {
  const size = currentExportSize();
  const offscreen = document.createElement('canvas');
  const state = Object.assign({}, editorState, { width: size.width, height: size.height });
  renderViceCover(offscreen, state);
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      const note = $('exportNote');
      if (!blob) {
        if (note) note.textContent = 'Export failed in this browser.';
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vice-cover-${size.width}x${size.height}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const message = `Exported PNG ${size.width} × ${size.height} (${Math.round(blob.size / 1024)} KiB).`;
      if (note) note.textContent = message;
      document.body.dataset.exportOk = '1';
      document.body.dataset.exportBytes = String(blob.size);
      resolve(blob);
    }, 'image/png');
  });
}

/* ------------------------------------------------------------------ */
/* Modes: demo, full-frame shot, and a headless self-test.             */
/* ------------------------------------------------------------------ */

function readQueryParams() {
  return new URLSearchParams(window.location.search);
}

async function runShotMode(params) {
  const sizeId = params.get('size') || 'wide';
  const size = VICE_EXPORT_SIZES[sizeId] || VICE_EXPORT_SIZES.wide;
  editorState.exportSize = sizeId in VICE_EXPORT_SIZES ? sizeId : 'wide';
  document.body.classList.add('shot-mode');
  await loadDemoPhotos();
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch (err) {
    /* Anton may fall back to a system bold face; the cover still draws. */
  }
  const canvas = $('previewCanvas');
  const state = Object.assign({}, editorState, { width: size.width, height: size.height });
  renderViceCover(canvas, state);
  document.body.dataset.shotReady = '1';
}

async function runExportSelfTest() {
  const blob = await exportCoverPng();
  const result = $('selfTestResult');
  if (result) {
    result.textContent = blob
      ? `export-ok bytes=${blob.size}`
      : 'export-failed';
  }
  document.title = blob ? 'export-ok' : 'export-failed';
}

async function startViceStudio() {
  const params = readQueryParams();
  wireControlPanel();
  wirePhotoUpload();
  wireCanvasDragging();
  refreshPhotoTray();

  if (params.get('shot') === 'cover') {
    await runShotMode(params);
    if (params.get('selftest') === '1') await runExportSelfTest();
    return;
  }
  if (params.get('demo') === '1') {
    await loadDemoPhotos();
  }
  try {
    await document.fonts.ready;
  } catch (err) {
    /* ignore */
  }
  renderPreview();
  if (params.get('selftest') === '1') await runExportSelfTest();
}

document.addEventListener('DOMContentLoaded', startViceStudio);

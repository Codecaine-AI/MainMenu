const DEFAULT_CONFIG_URL = '/modules/components/main-menu-system/menu-config.json';
const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 1080;
const STYLE_PATHS = [
  '/modules/components/menu-items/menu-items.css',
  '/modules/components/menu-shield/menu-shield.css',
  '/modules/components/side-menu/side-menu.css',
];

const DEFAULT_THEMES = {
  blue: {
    name: 'blue',
    border: '#3158e8',
    borderSoft: '#617bff',
    sidePanel: '#07515b',
    sideEdge: '#167783',
    sideFrame: '#b8bbc2',
    sideText: '#dce0ee',
    railText: '#aaaeb6',
  },
  red: {
    name: 'red',
    border: '#c24334',
    borderSoft: '#e47b65',
    sidePanel: '#5a2d1f',
    sideEdge: '#b85a2c',
    sideFrame: '#d1a184',
    sideText: '#ffe0d1',
    railText: '#dca78d',
  },
  yellow: {
    name: 'yellow',
    border: '#b4a64b',
    borderSoft: '#e2cf62',
    sidePanel: '#4a431c',
    sideEdge: '#c18c2f',
    sideFrame: '#d5b967',
    sideText: '#fff1bc',
    railText: '#d7bd6a',
  },
  green: {
    name: 'green',
    border: '#45a86b',
    borderSoft: '#7ee29b',
    sidePanel: '#194f46',
    sideEdge: '#2db38d',
    sideFrame: '#93cfba',
    sideText: '#d9fff2',
    railText: '#98d7c2',
  },
  purple: {
    name: 'purple',
    border: '#7c32c8',
    borderSoft: '#b06aff',
    sidePanel: '#2f3267',
    sideEdge: '#5b62c9',
    sideFrame: '#a8aee4',
    sideText: '#e3e7ff',
    railText: '#aeb5e5',
  },
};

const DEFAULT_MENU_THEMING = {
  rowHot: '#fbba2d',
  rowPanel: '#050505',
  rowSelectedText: '#050505',
  rowText: '#fbba2d',
  rowTextAlign: 'center',
  titleTextColor: '#ededed',
  titleTextOpacity: 1,
  titleTextGlowSize: 0,
  titleTextGlowOpacity: 0,
  captionTextColor: '#e4e7ff',
  sideTextColor: '#dce0ee',
  railTextColor: '#aaaeb6',
  rowEdgeOpacity: 0.84,
  rowEdgeFeather: 0.7,
  rowEdgeGlowSize: 7,
  rowEdgeGlowOpacity: 0.45,
  rowSelectedEdgeOpacity: 0.96,
  rowSelectedEdgeFeather: 0.5,
  rowSelectedEdgeGlowSize: 12,
  rowSelectedEdgeGlowOpacity: 0.62,
  markerPulseColor: '#dce0cd',
  markerContractSpeed: 2,
  markerCooldown: 0,
  markerSingleCooldown: 1.4,
  markerDoubleCooldown: 1.4,
  markerDoubleGap: 0.15,
  markerPulseRadius: 2.7,
  markerPulseTargetRadius: 0,
  markerPulseOpacity: 0.15,
  markerPulseThickness: 1,
  markerPulseFeatherWidth: 4,
  markerPulseEdgeOpacity: 0.21,
  markerRingGlowSize: 0.7,
  markerRingGlowOpacity: 0.07,
  markerInnerPulseColor: '#fff38a',
  markerInnerPulseRadius: 30,
  markerInnerPulseOpacity: 0.8,
  markerInnerPulseGlowSize: 24,
  markerInnerPulseSpeed: 4.2,
};

const DEFAULT_LAYOUTS = {
  'left-stack-5': {
    label: 'Five Stack',
    itemCount: 5,
    yStart: 274,
    spacing: 119,
    rowX: [326, 210, 98, 154, 116],
    rowWidth: 760,
    itemProps: {
      'x-offset': -50,
      'y-offset': -10,
      'width-scale': 0.84,
      'font-scale': 0.96,
      'text-max-font-size': 64,
    },
  },
  'left-stack-4': {
    label: 'Four Stack',
    itemCount: 4,
    yStart: 276,
    spacing: 128,
    rowX: [320, 215, 100, 170],
    rowWidth: 760,
    itemProps: {
      'x-offset': -54,
      'y-offset': 10,
      'width-scale': 0.86,
      'text-max-font-size': 64,
    },
  },
  'left-stack-3': {
    label: 'Three Stack',
    itemCount: 3,
    yStart: 306,
    spacing: 184,
    rowX: [328, 120, 112],
    rowWidth: 760,
    itemProps: {
      'x-offset': -70,
      'y-offset': 38,
      'width-scale': 0.88,
      'font-scale': 0.94,
      'text-max-font-size': 60,
    },
  },
};

const configCache = new Map();
const moduleCache = new Map();

async function loadModule(path) {
  const url = new URL(path, window.location.origin).href;
  if (moduleCache.has(url)) return moduleCache.get(url);
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
      return res.text();
    })
    .then((code) => {
      const blob = new Blob([code], { type: 'application/javascript' });
      const objectUrl = URL.createObjectURL(blob);
      return import(objectUrl);
    })
    .catch((err) => {
      moduleCache.delete(url);
      throw err;
    });
  moduleCache.set(url, promise);
  return promise;
}

async function loadParts() {
  const [items, shield, side] = await Promise.all([
    loadModule('/modules/components/menu-items/menu-items.js'),
    loadModule('/modules/components/menu-shield/menu-shield.js'),
    loadModule('/modules/components/side-menu/side-menu.js'),
  ]);
  return {
    renderMenuItems: items.default,
    renderMenuShield: shield.default,
    renderSideMenu: side.default,
  };
}

function ensureStylesheet(path) {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[data-main-menu-system-style="${path}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = path;
  link.dataset.mainMenuSystemStyle = path;
  document.head.appendChild(link);
}

function numberProp(properties, key, fallback) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  if (typeof properties[key] === 'boolean') return properties[key];
  if (properties[key] === 'true') return true;
  if (properties[key] === 'false') return false;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function soundBinding(properties, volumeKey) {
  const masterVolume = numberProp(properties, 'sound-volume', 1);
  const cueVolume = volumeKey ? numberProp(properties, volumeKey, 1) : 1;
  return {
    properties: {
      volume: clamp(masterVolume * cueVolume, 0, 1),
    },
  };
}

function soundTarget(properties, key, fallback) {
  const target = stringProp(properties, key, fallback);
  return target.trim();
}

function resolveAudioPlayer(runtime) {
  if (typeof runtime?.playAudio === 'function') return runtime.playAudio.bind(runtime);
  if (typeof window !== 'undefined' && typeof window.MELEE_playAudio === 'function') return window.MELEE_playAudio.bind(window);
  return null;
}

function resolveNavigator(runtime) {
  if (typeof runtime?.navigate === 'function') return runtime.navigate.bind(runtime);
  if (typeof window !== 'undefined' && typeof window.MELEE_navigate === 'function') return window.MELEE_navigate.bind(window);
  return null;
}

async function loadConfig(url) {
  if (configCache.has(url)) return configCache.get(url);
  const promise = fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      configCache.delete(url);
      throw err;
    });
  configCache.set(url, promise);
  return promise;
}

function inlineConfig(properties) {
  const value = properties?.['menu-config'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!value.menus || typeof value.menus !== 'object' || Array.isArray(value.menus)) return null;
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numericArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    : [];
}

function fixedRowWidth(layout) {
  const configured = Number(layout?.rowWidth);
  if (Number.isFinite(configured) && configured > 0) return configured;

  const widths = numericArray(layout?.rowWidth).filter((width) => width > 0);
  return widths.length ? Math.max(...widths) : null;
}

function layoutItemProps(layout) {
  const props = isPlainObject(layout?.itemProps) ? { ...layout.itemProps } : {};
  const itemCount = Number(layout?.itemCount);
  if (Number.isFinite(itemCount)) props['item-count'] = Math.round(itemCount);

  const yStart = Number(layout?.yStart);
  if (Number.isFinite(yStart)) props['row-y-start'] = yStart;

  const spacing = Number(layout?.spacing);
  if (Number.isFinite(spacing)) props['row-spacing'] = spacing;

  numericArray(layout?.rowX).forEach((x, index) => {
    props[`row-${index + 1}-x`] = x;
  });

  const rowCount = Math.max(
    Number.isFinite(itemCount) ? Math.round(itemCount) : 0,
    numericArray(layout?.rowX).length,
    numericArray(layout?.rowWidth).length,
  );
  const width = fixedRowWidth(layout);
  if (width !== null) {
    for (let index = 0; index < rowCount; index += 1) {
      props[`row-${index + 1}-width`] = width;
    }
  }

  return props;
}

function normalizeRowWidths(props) {
  const rowWidthEntries = Object.entries(props)
    .map(([key, value]) => {
      const match = key.match(/^row-(\d+)-width$/);
      const width = Number(value);
      return match && Number.isFinite(width) && width > 0 ? [Number(match[1]), width] : null;
    })
    .filter(Boolean);
  if (!rowWidthEntries.length) return props;

  const fixedWidth = Math.max(...rowWidthEntries.map(([, width]) => width));
  const itemCount = Number(props['item-count']);
  const rowCount = Math.max(
    Number.isFinite(itemCount) ? Math.round(itemCount) : 0,
    ...rowWidthEntries.map(([index]) => index),
  );
  const normalized = { ...props };
  for (let index = 1; index <= rowCount; index += 1) {
    normalized[`row-${index}-width`] = fixedWidth;
  }
  return normalized;
}

function mergeLayout(defaultLayout, configuredLayout) {
  if (!isPlainObject(configuredLayout)) {
    return {
      ...defaultLayout,
      itemProps: normalizeRowWidths(layoutItemProps(defaultLayout)),
    };
  }

  return {
    ...defaultLayout,
    ...configuredLayout,
    itemProps: normalizeRowWidths({
      ...layoutItemProps(defaultLayout),
      ...layoutItemProps(configuredLayout),
    }),
  };
}

async function resolveConfig(properties) {
  const inline = inlineConfig(properties);
  if (inline) return inline;
  return loadConfig(stringProp(properties, 'config', DEFAULT_CONFIG_URL));
}

function themeFromConfig(config, name) {
  const themeName = typeof name === 'string' && name ? name : 'blue';
  const base = DEFAULT_THEMES[themeName] ?? DEFAULT_THEMES.blue;
  const configured = config?.themes?.[themeName];
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    return { ...base, name: themeName };
  }
  return { ...base, ...configured, name: themeName };
}

function menuThemingFromConfig(config) {
  const configured = config?.menuTheming;
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    return DEFAULT_MENU_THEMING;
  }
  return { ...DEFAULT_MENU_THEMING, ...configured };
}

function menuById(config, id) {
  return config?.menus?.[id] ?? config?.menus?.[config.initial] ?? null;
}

function itemTheme(config, menu, item) {
  return themeFromConfig(config, item?.theme ?? menu?.theme);
}

function itemDescription(menu, item) {
  return item?.description ?? menu?.description ?? '';
}

function itemCaption(menu, item) {
  return item?.caption ?? itemDescription(menu, item);
}

function itemPreview(menu, item) {
  return item?.preview ?? menu?.preview ?? { type: 'rows', rows: [] };
}

function resolvedPreview(preview) {
  if (!isPlainObject(preview)) return { type: 'empty' };
  if (isPlainObject(preview.detail)) return preview.detail;
  if (isPlainObject(preview.sidePanel)) return preview.sidePanel;
  return preview;
}

function sidePanelPreview(preview) {
  const content = resolvedPreview(preview);
  const railText = content.railText ?? preview?.railText;
  const railTextColor = content.railTextColor ?? content.railColor ?? preview?.railTextColor ?? preview?.railColor;
  const railTextOpacity = content.railTextOpacity ?? content.railOpacity ?? preview?.railTextOpacity ?? preview?.railOpacity;
  const railProps = { railText, railTextColor, railTextOpacity };
  if (content.type === 'rows' || Array.isArray(content.rows)) return { ...content, ...railProps };
  if (content.type === 'image') return { ...content, ...railProps };
  return { type: 'empty', ...railProps };
}

function detailPreview(preview) {
  const content = resolvedPreview(preview);
  return ['controller', 'display-settings', 'records-grid', 'contribution-grid', 'toggles'].includes(content.type) ? content : null;
}

function selectedItem(menu, selectedIndex) {
  const items = Array.isArray(menu?.items) ? menu.items : [];
  return items[clamp(selectedIndex, 0, Math.max(0, items.length - 1))] ?? null;
}

function selectedIndexFor(menu, index) {
  const count = Array.isArray(menu?.items) ? menu.items.length : 0;
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function layoutFor(config, menu) {
  const layoutId = typeof menu?.layout === 'string' ? menu.layout : '';
  const defaultLayout = DEFAULT_LAYOUTS[layoutId];
  return mergeLayout(defaultLayout, config?.layouts?.[layoutId]);
}

function applyTheme(root, theme) {
  root.dataset.theme = theme.name;
  root.style.setProperty('--main-menu-system-theme', theme.border);
  root.style.setProperty('--main-menu-system-theme-soft', theme.borderSoft);
}

function motionEasing(properties) {
  const easing = stringProp(properties, 'menu-motion-easing', 'cubic-bezier(0.16, 1, 0.3, 1)').trim();
  return easing || 'cubic-bezier(0.16, 1, 0.3, 1)';
}

function borderColorTransitionMs(properties) {
  return clamp(numberProp(properties, 'theme-transition-ms', 220), 0, 2000);
}

function targetFadeMs(properties) {
  return clamp(numberProp(properties, 'selection-target-fade-ms', 140), 0, 2000);
}

function menuItemColorTransitionMs(properties) {
  return clamp(numberProp(properties, 'menu-item-color-transition-ms', targetFadeMs(properties)), 0, 2000);
}

function selectionTransitionMs(properties) {
  return Math.max(borderColorTransitionMs(properties), targetFadeMs(properties), menuItemColorTransitionMs(properties));
}

function captionTransitionMs(properties) {
  return clamp(numberProp(properties, 'caption-transition-ms', 220), 0, 2000);
}

function titlePrismTransitionMs(properties) {
  return clamp(numberProp(properties, 'title-prism-ms', 340), 0, 2000);
}

function labelsFor(menu) {
  return (Array.isArray(menu?.items) ? menu.items : []).map((item) => item.label);
}

function menuItemProps(config, menu, state, properties, menuTheming) {
  const labels = labelsFor(menu);
  const layout = layoutFor(config, menu);
  const targetFade = targetFadeMs(properties);
  const props = {
    ...layout.itemProps,
    items: labels.join('|'),
    'item-count': labels.length,
    'selected-index': state.selectedIndex + 1,
    'marker-visible': true,
    'marker-opacity': 1,
    'hot-gold-color': menuTheming.rowHot ?? '#fbba2d',
    'panel-color': menuTheming.rowPanel ?? '#050505',
    'gold-color': menuTheming.rowHot ?? '#fbba2d',
    'selected-text-color': menuTheming.rowSelectedText ?? '#050505',
    'unselected-text-color': menuTheming.rowText ?? '#fbba2d',
    'text-align': menuTheming.rowTextAlign ?? 'center',
    'edge-opacity': numberProp(menuTheming, 'rowEdgeOpacity', 0.84),
    'edge-feather-blur': numberProp(menuTheming, 'rowEdgeFeather', 0.7),
    'edge-glow-size': numberProp(menuTheming, 'rowEdgeGlowSize', 7),
    'edge-glow-opacity': numberProp(menuTheming, 'rowEdgeGlowOpacity', 0.45),
    'edge-glow-color': menuTheming.rowHot ?? '#fbba2d',
    'selected-edge-opacity': numberProp(menuTheming, 'rowSelectedEdgeOpacity', 0.96),
    'selected-edge-feather-blur': numberProp(menuTheming, 'rowSelectedEdgeFeather', 0.5),
    'selected-edge-glow-size': numberProp(menuTheming, 'rowSelectedEdgeGlowSize', 12),
    'selected-edge-glow-opacity': numberProp(menuTheming, 'rowSelectedEdgeGlowOpacity', 0.62),
    'selected-edge-glow-color': menuTheming.rowHot ?? '#fbba2d',
    'text-auto-fit': true,
    'text-min-font-size': 36,
    'text-fit-padding': 18,
    'marker-pulse-contract-speed': numberProp(menuTheming, 'markerContractSpeed', 2),
    'marker-pulse-cooldown': numberProp(menuTheming, 'markerCooldown', 0),
    'marker-pulse-single-cooldown': numberProp(menuTheming, 'markerSingleCooldown', 1.4),
    'marker-pulse-double-cooldown': numberProp(menuTheming, 'markerDoubleCooldown', 1.4),
    'marker-pulse-double-gap': numberProp(menuTheming, 'markerDoubleGap', 0.15),
    'marker-pulse-radius': numberProp(menuTheming, 'markerPulseRadius', 2.7),
    'marker-pulse-target-radius': numberProp(menuTheming, 'markerPulseTargetRadius', 0),
    'marker-pulse-opacity': numberProp(menuTheming, 'markerPulseOpacity', 0.15),
    'marker-pulse-thickness': numberProp(menuTheming, 'markerPulseThickness', 1),
    'marker-pulse-feather-width': numberProp(menuTheming, 'markerPulseFeatherWidth', 4),
    'marker-pulse-edge-opacity': numberProp(menuTheming, 'markerPulseEdgeOpacity', 0.21),
    'marker-pulse-color': menuTheming.markerPulseColor ?? '#dce0cd',
    'marker-ring-glow-size': numberProp(menuTheming, 'markerRingGlowSize', 0.7),
    'marker-ring-glow-opacity': numberProp(menuTheming, 'markerRingGlowOpacity', 0.07),
    'marker-inner-pulse-color': menuTheming.markerInnerPulseColor ?? '#fff38a',
    'marker-inner-pulse-radius': numberProp(menuTheming, 'markerInnerPulseRadius', 30),
    'marker-inner-pulse-opacity': numberProp(menuTheming, 'markerInnerPulseOpacity', 0.8),
    'marker-inner-pulse-glow-size': numberProp(menuTheming, 'markerInnerPulseGlowSize', 24),
    'marker-inner-pulse-speed': numberProp(menuTheming, 'markerInnerPulseSpeed', 4.2),
    'selection-target-fade-ms': targetFade,
    'menu-item-color-transition-ms': menuItemColorTransitionMs(properties),
    'selection-easing': motionEasing(properties),
  };
  props['x-offset'] = numberProp(properties, 'menu-x-offset', 0) + numberProp(props, 'x-offset', 0);
  props['y-offset'] = numberProp(properties, 'menu-y-offset', 0) + numberProp(props, 'y-offset', 0);
  props.scale = numberProp(properties, 'menu-scale', 1) * numberProp(props, 'scale', 1);
  props['width-scale'] = numberProp(properties, 'menu-width-scale', 1) * numberProp(props, 'width-scale', 1);
  props['font-scale'] = numberProp(properties, 'menu-font-scale', 1) * numberProp(props, 'font-scale', 1);
  labels.slice(0, 5).forEach((label, index) => {
    props[`item-${index + 1}`] = label;
  });
  return props;
}

function shieldProps(menu, item, theme, properties, menuTheming) {
  const caption = itemCaption(menu, item);
  const titleBoxHeight = numberProp(properties, 'title-box-height', 76);
  const titleTextColor = menuTheming.titleTextColor ?? '#ededed';
  return {
    'top-text': menu?.title ?? 'Main Menu',
    'bottom-text': caption,
    'border-color': theme.border,
    'border-opacity': 1,
    'fill-opacity': 0.15,
    'top-text-color': titleTextColor,
    'top-text-opacity': numberProp(menuTheming, 'titleTextOpacity', 1),
    'top-text-glow-color': titleTextColor,
    'top-text-glow-size': numberProp(menuTheming, 'titleTextGlowSize', 0),
    'top-text-glow-opacity': numberProp(menuTheming, 'titleTextGlowOpacity', 0),
    'bottom-text-color': menuTheming.captionTextColor ?? '#e4e7ff',
    'button-border-color': '#eef1ff',
    'button-fill-color': '#03040a',
    'top-x': numberProp(properties, 'title-x', 179),
    'top-y': numberProp(properties, 'title-y', 120),
    'top-font-size': numberProp(properties, 'title-font-size', menu?.title?.length > 18 ? 39 : 47),
    'top-box-x': numberProp(properties, 'title-box-x', numberProp(properties, 'title-x', 176)),
    'top-box-y': numberProp(properties, 'title-box-y', numberProp(properties, 'title-y', 120) - titleBoxHeight / 2),
    'top-box-width': numberProp(properties, 'title-box-width', 445),
    'top-box-height': titleBoxHeight,
    'top-fit-padding-x': numberProp(properties, 'title-fit-padding-x', 16),
    'top-fit-padding-y': numberProp(properties, 'title-fit-padding-y', 8),
    'bottom-x': numberProp(properties, 'caption-x', 730),
    'bottom-y': numberProp(properties, 'caption-y', 950),
    'bottom-font-size': numberProp(properties, 'caption-font-size', caption.length > 52 ? 28 : caption.length > 42 ? 34 : 56),
    'button-x': numberProp(properties, 'caption-box-x', 344),
    'button-y': numberProp(properties, 'caption-box-y', 902),
    'button-width': numberProp(properties, 'caption-box-width', 762),
    'button-height': numberProp(properties, 'caption-box-height', 85),
    'button-radius': 11,
    'button-border-width': 7,
    'bottom-center-in-box': booleanProp(properties, 'caption-center-in-box', true),
    'debug-text-boxes': booleanProp(properties, 'shield-text-debug', false),
  };
}

function previewRows(preview) {
  if (Array.isArray(preview)) return preview;
  if (Array.isArray(preview?.rows)) return preview.rows;
  return [];
}

function railTextFor(menu, item, preview) {
  const configured = preview?.railText ?? item?.railText ?? menu?.railText;
  if (typeof configured === 'string') return configured;
  return item?.label ?? 'START PAUSE';
}

function railTextColorFor(menu, item, theme, preview, menuTheming) {
  return menuTheming.railTextColor
    ?? preview?.railTextColor
    ?? preview?.railColor
    ?? item?.railTextColor
    ?? item?.railColor
    ?? menu?.railTextColor
    ?? menu?.railColor
    ?? theme.railText;
}

function railTextOpacityFor(menu, item, preview) {
  const value = Number(preview?.railTextOpacity ?? preview?.railOpacity ?? item?.railTextOpacity ?? item?.railOpacity ?? menu?.railTextOpacity ?? menu?.railOpacity);
  return clamp(Number.isFinite(value) ? value : 1, 0, 1);
}

function sideMenuProps(menu, item, theme, properties, menuTheming, panelPreview = sidePanelPreview(itemPreview(menu, item))) {
  const preview = isPlainObject(panelPreview) ? panelPreview : { type: 'empty' };
  const rows = preview.type === 'rows' ? previewRows(preview) : [];
  const contentType = preview.type === 'image' ? 'image' : 'rows';
  const contentVisible = contentType === 'image' || rows.length > 0;
  const defaultContentY = rows.length > 3 ? 404 : 452;
  const defaultLineHeight = rows.length > 4 ? 54 : 70;
  const defaultFontSize = rows.length > 4 ? 34 : 43;
  const props = {
    'item-count': rows.length,
    items: rows.join('|'),
    'rail-text': railTextFor(menu, item, preview),
    'rail-text-color': railTextColorFor(menu, item, theme, preview, menuTheming),
    'rail-text-opacity': railTextOpacityFor(menu, item, preview),
    'content-type': contentType,
    'content-visible': contentVisible,
    'image-src': preview.src ?? preview.image ?? preview.asset ?? '',
    'image-x': preview.x ?? preview.imageX ?? 990,
    'image-y': preview.y ?? preview.imageY ?? 360,
    'image-width': preview.width ?? preview.imageWidth ?? 278,
    'image-height': preview.height ?? preview.imageHeight ?? 238,
    'image-opacity': preview.opacity ?? preview.imageOpacity ?? 0.92,
    'global-x': numberProp(properties, 'side-x', 67),
    'global-y': numberProp(properties, 'side-y', 0),
    scale: numberProp(properties, 'side-scale', 1),
    perspective: numberProp(properties, 'side-perspective', 1700),
    'frame-visible': booleanProp(properties, 'side-frame-visible', true),
    'rain-density': numberProp(properties, 'side-rain-density', 36),
    'rain-speed': numberProp(properties, 'side-rain-speed', 0.9),
    'rain-color-offset': numberProp(properties, 'side-rain-color-offset', 0.36),
    'rain-x-scale': numberProp(properties, 'side-rain-x-scale', 1),
    'rain-y-scale': numberProp(properties, 'side-rain-y-scale', 1),
    'panel-depth': -42,
    'frame-depth': 8,
    'panel-rotate-x': 0,
    'panel-rotate-y': -5,
    'panel-rotate-z': 0,
    'frame-rotate-x': 0,
    'frame-rotate-y': -2,
    'frame-rotate-z': 0,
    'panel-origin-x': 1130,
    'panel-origin-y': 525,
    'frame-origin-x': 942,
    'frame-origin-y': 586,
    'content-x': numberProp(properties, 'side-content-x', 1027),
    'content-y': numberProp(properties, 'side-content-y', defaultContentY),
    'content-width': numberProp(properties, 'side-content-width', 250),
    'content-line-height': numberProp(properties, 'side-line-height', defaultLineHeight),
    'content-font-size': defaultFontSize * numberProp(properties, 'side-font-scale', 1),
    'text-auto-fit': true,
    'text-min-font-size': 25,
    'text-max-font-size': 54,
    'rail-visible': booleanProp(properties, 'side-rail-visible', true),
    'rail-x': numberProp(properties, 'side-rail-x', 919),
    'rail-y': numberProp(properties, 'side-rail-y', 565),
    'rail-rotation': numberProp(properties, 'side-rail-rotation', -90),
    'rail-font-size': numberProp(properties, 'side-rail-font-size', 36),
    'panel-color': theme.sidePanel,
    'panel-edge-color': theme.sideEdge,
    'panel-opacity': numberProp(properties, 'side-panel-opacity', 0.53),
    'panel-edge-opacity': 0.82,
    'frame-color': theme.sideFrame,
    'frame-inner-color': '#32384e',
    'frame-opacity': 0.55,
    'frame-inner-opacity': 0.53,
    'text-color': menuTheming.sideTextColor ?? theme.sideText,
    'text-opacity': numberProp(properties, 'side-text-opacity', 1),
  };
  rows.slice(0, 6).forEach((row, index) => {
    props[`item-${index + 1}`] = row;
  });
  return props;
}

function detailNode(className) {
  const node = document.createElement('div');
  node.className = `main-menu-system__detail ${className}`;
  return node;
}

function addLabel(parent, className, text) {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function renderControllerPreview() {
  const node = detailNode('main-menu-system__detail--controller');
  addLabel(node, 'main-menu-system__detail-title', 'Character Select');
  const pad = document.createElement('div');
  pad.className = 'main-menu-system__controller-pad';
  ['stick', 'a', 'b', 'x', 'z'].forEach((part) => {
    const el = document.createElement('span');
    el.className = `main-menu-system__controller-part main-menu-system__controller-part--${part}`;
    pad.appendChild(el);
  });
  node.appendChild(pad);
  return node;
}

function renderDisplayPreview() {
  const node = detailNode('main-menu-system__detail--display');
  const sample = document.createElement('div');
  sample.className = 'main-menu-system__display-sample';
  addLabel(sample, 'main-menu-system__display-label', 'SAMPLE');
  const image = document.createElement('div');
  image.className = 'main-menu-system__display-image';
  sample.appendChild(image);
  node.appendChild(sample);

  const controls = document.createElement('div');
  controls.className = 'main-menu-system__display-controls';
  for (let i = 0; i < 7; i += 1) {
    const segment = document.createElement('span');
    segment.className = `main-menu-system__display-segment main-menu-system__display-segment--${i + 1}`;
    controls.appendChild(segment);
  }
  node.appendChild(controls);
  return node;
}

function renderRecordsPreview() {
  const node = document.createElement('div');
  node.className = 'main-menu-system__records-detail';
  const grid = document.createElement('div');
  grid.className = 'main-menu-system__records-grid';
  for (let i = 0; i < 56; i += 1) {
    const cell = document.createElement('span');
    cell.className = i % 8 === 0 ? 'is-axis' : '';
    grid.appendChild(cell);
  }
  node.appendChild(grid);
  return node;
}

function contributionLevel(index) {
  const week = Math.floor(index / 7);
  const day = index % 7;
  if ((week + day * 3) % 17 === 0) return 0;
  const score = (week * 11 + day * 7 + week * day * 3) % 23;
  if (score > 19) return 4;
  if (score > 14) return 3;
  if (score > 8) return 2;
  return 1;
}

function renderContributionGridPreview(preview) {
  const weeks = clamp(Math.round(Number(preview?.weeks ?? 14)), 8, 20);
  const node = document.createElement('div');
  node.className = 'main-menu-system__records-detail main-menu-system__contribution-detail';

  const shell = document.createElement('div');
  shell.className = 'main-menu-system__contribution-shell';

  const grid = document.createElement('div');
  grid.className = 'main-menu-system__contribution-grid';
  grid.style.setProperty('--main-menu-system-contribution-weeks', String(weeks));
  for (let i = 0; i < weeks * 7; i += 1) {
    const cell = document.createElement('span');
    cell.className = `is-level-${contributionLevel(i)}`;
    grid.appendChild(cell);
  }
  shell.appendChild(grid);

  node.appendChild(shell);
  return node;
}

function renderTogglePreview(preview) {
  const node = detailNode('main-menu-system__detail--toggle');
  addLabel(node, 'main-menu-system__detail-title', preview.label ?? 'Option');
  const switchWrap = document.createElement('div');
  switchWrap.className = 'main-menu-system__toggle-wrap';
  const switchBody = document.createElement('div');
  switchBody.className = 'main-menu-system__toggle-body';
  const switchKnob = document.createElement('span');
  switchBody.appendChild(switchKnob);
  const switchText = document.createElement('strong');
  switchText.textContent = preview.value ?? 'ON';
  switchWrap.append(switchBody, switchText);
  node.appendChild(switchWrap);
  return node;
}

function renderDetailPreview(preview) {
  if (!preview) return null;
  if (preview.type === 'controller') return renderControllerPreview();
  if (preview.type === 'display-settings') return renderDisplayPreview();
  if (preview.type === 'records-grid') return renderRecordsPreview();
  if (preview.type === 'contribution-grid') return renderContributionGridPreview(preview);
  if (preview.type === 'toggles') return renderTogglePreview(preview);
  return null;
}

async function renderPreview(menu, item, theme, parts, properties, menuTheming) {
  const preview = itemPreview(menu, item);
  const node = document.createElement('div');
  node.className = 'main-menu-system__preview-stack';
  node.appendChild(await parts.renderSideMenu({
    properties: sideMenuProps(menu, item, theme, properties, menuTheming, sidePanelPreview(preview)),
    layerId: 'main-menu-system-side-menu',
  }));

  const detail = renderDetailPreview(detailPreview(preview));
  if (detail) node.appendChild(detail);
  return node;
}

function renderMotionLayer(name) {
  const node = document.createElement('div');
  node.className = `main-menu-system__motion-layer main-menu-system__motion-layer--${name}`;
  return node;
}

const SELECTION_COLOR_HANDOFFS = [
  {
    selector: '.menu-shield',
    properties: ['--menu-shield-border'],
  },
  {
    selector: '.side-menu',
    properties: [
      '--side-menu-panel',
      '--side-menu-panel-edge',
      '--side-menu-rain-color',
      '--side-menu-frame',
      '--side-menu-text',
      '--side-menu-text-opacity',
      '--side-menu-rail-text',
      '--side-menu-rail-text-opacity',
    ],
  },
];

function prepareSelectionColorHandoff(currentView, nextView) {
  const updates = [];
  SELECTION_COLOR_HANDOFFS.forEach(({ selector, properties }) => {
    const currentNode = currentView.querySelector(selector);
    const nextNode = nextView.querySelector(selector);
    if (!currentNode || !nextNode) return;
    properties.forEach((property) => {
      const currentValue = currentNode.style.getPropertyValue(property).trim();
      const nextValue = nextNode.style.getPropertyValue(property).trim();
      if (!currentValue || !nextValue || currentValue === nextValue) return;
      nextNode.style.setProperty(property, currentValue);
      updates.push([nextNode, property, nextValue]);
    });
  });

  return () => {
    updates.forEach(([node, property, value]) => {
      node.style.setProperty(property, value);
    });
  };
}

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  });
  return node;
}

function renderOrbitGuide(properties, orbitRadius) {
  if (!booleanProp(properties, 'menu-orbit-debug', false)) return null;
  const centerX = clamp(numberProp(properties, 'menu-orbit-center-x', STAGE_WIDTH / 2), -STAGE_WIDTH, STAGE_WIDTH * 2);
  const centerY = clamp(numberProp(properties, 'menu-orbit-center-y', STAGE_HEIGHT / 2), -STAGE_HEIGHT, STAGE_HEIGHT * 2);
  const radius = orbitRadius;
  const opacity = clamp(numberProp(properties, 'menu-orbit-debug-opacity', 0.86), 0, 1);
  const leftX = centerX - radius;
  const rightX = centerX + radius;
  const topY = centerY - radius;
  const bottomY = centerY + radius;

  const guide = document.createElement('div');
  guide.className = 'main-menu-system__orbit-guide';
  guide.style.setProperty('--main-menu-system-orbit-debug-opacity', String(opacity));

  const svg = svgNode('svg', {
    class: 'main-menu-system__orbit-guide-svg',
    viewBox: `0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.appendChild(svgNode('circle', { class: 'main-menu-system__orbit-guide-circle', cx: centerX, cy: centerY, r: radius }));
  svg.appendChild(svgNode('line', { class: 'main-menu-system__orbit-guide-crosshair', x1: leftX, y1: centerY, x2: rightX, y2: centerY }));
  svg.appendChild(svgNode('line', { class: 'main-menu-system__orbit-guide-crosshair', x1: centerX, y1: topY, x2: centerX, y2: bottomY }));
  svg.appendChild(svgNode('line', { class: 'main-menu-system__orbit-guide-radius', x1: centerX, y1: centerY, x2: centerX, y2: bottomY }));
  [
    [leftX, centerY],
    [rightX, centerY],
    [centerX, topY],
    [centerX, bottomY],
  ].forEach(([cx, cy]) => {
    svg.appendChild(svgNode('circle', { class: 'main-menu-system__orbit-guide-point', cx, cy, r: 8 }));
  });
  svg.appendChild(svgNode('circle', { class: 'main-menu-system__orbit-guide-center', cx: centerX, cy: centerY, r: 11 }));
  guide.appendChild(svg);
  return guide;
}

function renderBackButton(menu, controller) {
  const button = document.createElement('button');
  button.className = 'main-menu-system__back-button';
  button.type = 'button';
  button.setAttribute('aria-label', `Back from ${menu?.title ?? 'submenu'}`);
  button.title = 'Back';

  const icon = document.createElement('span');
  icon.className = 'main-menu-system__back-icon';
  button.appendChild(icon);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    controller.back();
  });

  return button;
}

function installPointerBindings(view, controller) {
  view.querySelectorAll('.menu-items__row').forEach((row) => {
    const index = Number(row.dataset.menuIndex) - 1;
    if (!Number.isFinite(index)) return;
    row.addEventListener('mouseenter', () => controller.select(index));
    row.addEventListener('focusin', () => controller.select(index));
    row.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      controller.select(index, { enter: true });
    });
  });
}

function startGamepadLoop(root, controller) {
  let lastInput = '';
  let lastInputAt = 0;
  const repeatMs = 190;

  const fire = (name, fn) => {
    const now = performance.now();
    if (lastInput === name && now - lastInputAt < repeatMs) return;
    lastInput = name;
    lastInputAt = now;
    fn();
  };

  const loop = () => {
    if (!root.isConnected) return;
    const pads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
      ? navigator.getGamepads()
      : [];
    const pad = Array.from(pads).find(Boolean);
    if (pad) {
      const axisX = pad.axes?.[0] ?? 0;
      const axisY = pad.axes?.[1] ?? 0;
      if (pad.buttons?.[0]?.pressed) fire('enter-button', () => controller.enter());
      else if (pad.buttons?.[1]?.pressed) fire('back-button', () => controller.back());
      else if (axisY > 0.55 || pad.buttons?.[13]?.pressed) fire('down', () => controller.move(1));
      else if (axisY < -0.55 || pad.buttons?.[12]?.pressed) fire('up', () => controller.move(-1));
      else if (axisX > 0.55 || pad.buttons?.[15]?.pressed) fire('right', () => controller.enter());
      else if (axisX < -0.55 || pad.buttons?.[14]?.pressed) fire('left', () => controller.back());
      else lastInput = '';
    }
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

function createController(root, config, properties, parts, runtime) {
  const transitionMs = clamp(numberProp(properties, 'transition-ms', 300), 0, 2000);
  const selectionMs = selectionTransitionMs(properties);
  const captionMs = captionTransitionMs(properties);
  const titlePrismMs = titlePrismTransitionMs(properties);
  const initial = stringProp(properties, 'initial-menu', config.initial ?? 'main');
  const playAudio = resolveAudioPlayer(runtime);
  const navigate = resolveNavigator(runtime);
  const rootBackTarget = soundTarget(properties, 'back-target', 'title');
  let renderSerial = 0;
  const state = {
    activeMenu: menuById(config, initial) ? initial : config.initial,
    selectedIndex: 0,
    stack: [],
    direction: 'idle',
    busy: false,
  };
  state.stack = [state.activeMenu];

  const getMenu = () => menuById(config, state.activeMenu);
  state.selectedIndex = selectedIndexFor(getMenu(), Math.round(numberProp(properties, 'initial-selected-index', 1)) - 1);

  const playSound = (key, fallback, volumeKey) => {
    const target = soundTarget(properties, key, fallback);
    if (!target || !playAudio) return;
    Promise.resolve(playAudio(target, soundBinding(properties, volumeKey))).catch((err) => {
      console.warn(`[main-menu-system] Failed to play '${target}'`, err);
    });
  };

  const controller = {
    move(delta) {
      if (state.busy) return;
      const menu = getMenu();
      const nextIndex = selectedIndexFor(menu, state.selectedIndex + delta);
      if (nextIndex === state.selectedIndex) return;
      state.selectedIndex = nextIndex;
      state.direction = delta > 0 ? 'down' : 'up';
      controller.render({ animate: selectionMs > 0, mode: 'selection' });
      playSound('ui-navigation-sound', 'ui-navigation', 'ui-navigation-volume');
    },
    select(index, options = {}) {
      if (state.busy) return;
      const menu = getMenu();
      const nextIndex = selectedIndexFor(menu, index);
      const changed = nextIndex !== state.selectedIndex;
      state.selectedIndex = nextIndex;
      if (options.enter) {
        controller.render({ animate: false }).then(() => controller.enter());
      } else if (changed) {
        controller.render({ animate: selectionMs > 0, mode: 'selection' });
        playSound('ui-navigation-sound', 'ui-navigation', 'ui-navigation-volume');
      }
    },
    enter() {
      const menu = getMenu();
      const item = selectedItem(menu, state.selectedIndex);
      if (!item?.enter || !menuById(config, item.enter)) return;
      if (state.busy) return;
      playSound('ui-forward-sound', 'ui-forward', 'ui-forward-volume');
      state.stack.push(item.enter);
      state.activeMenu = item.enter;
      state.selectedIndex = 0;
      state.direction = 'forward';
      controller.render({ animate: true, mode: 'forward' });
    },
    back() {
      if (state.busy) return;
      if (state.stack.length > 1) {
        playSound('ui-back-sound', 'ui-back', 'ui-back-volume');
        state.stack.pop();
        state.activeMenu = state.stack[state.stack.length - 1];
        state.selectedIndex = 0;
        state.direction = 'back';
        controller.render({ animate: true, mode: 'back' });
        return;
      }
      if (!rootBackTarget || !navigate) return;
      playSound('ui-back-sound', 'ui-back', 'ui-back-volume');
      Promise.resolve(navigate(rootBackTarget)).catch((err) => {
        console.warn(`[main-menu-system] Failed to navigate back to '${rootBackTarget}'`, err);
      });
    },
    canBack() {
      return state.stack.length > 1 || Boolean(rootBackTarget && navigate);
    },
    canExit() {
      return state.stack.length <= 1 && Boolean(rootBackTarget && navigate);
    },
    async render({ animate, mode } = {}) {
      const renderId = ++renderSerial;
      const menu = getMenu();
      if (!menu) return;
      const item = selectedItem(menu, state.selectedIndex);
      const theme = itemTheme(config, menu, item);
      const menuTheming = menuThemingFromConfig(config);
      root.dataset.theme = theme.name;
      root.dataset.activeMenu = state.activeMenu;
      root.dataset.selectedIndex = String(state.selectedIndex);

      const nextView = document.createElement('div');
      nextView.className = 'main-menu-system__view';
      nextView.dataset.direction = state.direction;
      applyTheme(nextView, theme);
      const underlay = renderMotionLayer('underlay');
      underlay.appendChild(await renderPreview(menu, item, theme, parts, properties, menuTheming));
      nextView.appendChild(underlay);
      nextView.appendChild(await parts.renderMenuShield({
        properties: shieldProps(menu, item, theme, properties, menuTheming),
        layerId: 'main-menu-system-shield',
      }));
      const menuItems = await parts.renderMenuItems({ properties: menuItemProps(config, menu, state, properties, menuTheming), layerId: 'main-menu-system-items' });
      const foreground = renderMotionLayer('foreground');
      foreground.appendChild(menuItems);
      nextView.appendChild(foreground);
      if (renderId !== renderSerial) return;
      nextView.appendChild(renderBackButton(menu, controller));

      installPointerBindings(nextView, controller);

      const existingViews = [...root.querySelectorAll('.main-menu-system__view')];
      const currentView = existingViews[existingViews.length - 1];
      const directionClass = mode === 'selection' ? 'selection' : state.direction === 'back' ? 'back' : 'forward';
      const durationMs = directionClass === 'selection' ? selectionMs : transitionMs;
      const cleanupMs = directionClass === 'selection' ? Math.max(durationMs, captionMs) : Math.max(durationMs, titlePrismMs, captionMs);
      nextView.style.setProperty('--main-menu-system-active-transition-ms', `${durationMs}ms`);
      nextView.style.setProperty('--main-menu-system-border-color-transition-ms', `${borderColorTransitionMs(properties)}ms`);
      if (currentView) currentView.style.setProperty('--main-menu-system-active-transition-ms', `${durationMs}ms`);
      if (currentView) currentView.style.setProperty('--main-menu-system-border-color-transition-ms', `${borderColorTransitionMs(properties)}ms`);
      if (!animate || !currentView || durationMs === 0) {
        existingViews.forEach((view) => view.remove());
        root.appendChild(nextView);
        return;
      }

      if (directionClass !== 'selection') state.busy = true;
      existingViews.slice(0, -1).forEach((view) => view.remove());
      const currentMenuItems = currentView.querySelector('.menu-items');
      const applySelectionColorHandoff = directionClass === 'selection'
        ? prepareSelectionColorHandoff(currentView, nextView)
        : null;
      if (directionClass === 'selection') {
        currentView.querySelector('.main-menu-system__motion-layer--underlay')?.remove();
        currentView.querySelector('.menu-shield')?.remove();
        currentView.querySelector('.main-menu-system__back-button')?.remove();
        menuItems.classList.add('is-selection-target-entering');
        currentMenuItems?.classList.add('is-selection-target-exiting');
      }
      nextView.classList.add(`is-entering-${directionClass}`);
      currentView.classList.add(`is-exiting-${directionClass}`);
      root.appendChild(nextView);
      requestAnimationFrame(() => {
        nextView.classList.add('is-active');
        currentView.classList.add('is-active');
        if (directionClass === 'selection') {
          applySelectionColorHandoff?.();
          menuItems.classList.add('is-selection-target-visible');
          currentMenuItems?.classList.add('is-selection-target-hidden');
        }
      });
      window.setTimeout(() => {
        currentView.remove();
        nextView.classList.remove(`is-entering-${directionClass}`, 'is-active');
        if (directionClass === 'selection') {
          menuItems.classList.remove('is-selection-target-entering', 'is-selection-target-visible');
        }
        if (directionClass !== 'selection') state.busy = false;
      }, cleanupMs);
    },
  };

  return controller;
}

export default async function ({ properties = {}, layerId, runtime } = {}) {
  STYLE_PATHS.forEach(ensureStylesheet);

  const [config, parts] = await Promise.all([resolveConfig(properties), loadParts()]);
  const root = document.createElement('div');
  root.className = 'main-menu-system';
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Main menu');
  root.style.setProperty('--main-menu-system-transition-ms', `${clamp(numberProp(properties, 'transition-ms', 300), 0, 2000)}ms`);
  root.style.setProperty('--main-menu-system-selection-transition-ms', `${selectionTransitionMs(properties)}ms`);
  root.style.setProperty('--main-menu-system-border-color-transition-ms', `${borderColorTransitionMs(properties)}ms`);
  root.style.setProperty('--main-menu-system-caption-transition-ms', `${captionTransitionMs(properties)}ms`);
  root.style.setProperty('--main-menu-system-transition-easing', motionEasing(properties));
  const orbitRadius = clamp(numberProp(properties, 'menu-orbit-radius', 360), 120, 1800);
  const orbitCenterX = clamp(numberProp(properties, 'menu-orbit-center-x', STAGE_WIDTH / 2), -STAGE_WIDTH, STAGE_WIDTH * 2);
  const orbitCenterY = clamp(numberProp(properties, 'menu-orbit-center-y', STAGE_HEIGHT / 2), -STAGE_HEIGHT, STAGE_HEIGHT * 2);
  const orbitAngle = clamp(numberProp(properties, 'menu-orbit-angle', 18), 0, 180);
  root.style.setProperty('--main-menu-system-orbit-radius', `${orbitRadius}px`);
  root.style.setProperty('--main-menu-system-orbit-center-x', `${orbitCenterX}px`);
  root.style.setProperty('--main-menu-system-orbit-center-y', `${orbitCenterY}px`);
  root.style.setProperty('--main-menu-system-orbit-angle', `${orbitAngle}deg`);
  const titlePrismMs = titlePrismTransitionMs(properties);
  const titlePrismDepth = clamp(numberProp(properties, 'title-prism-depth', 66), 0, 220);
  const titlePrismLift = clamp(numberProp(properties, 'title-prism-lift', 24), 0, 160);
  const titlePrismAngle = clamp(numberProp(properties, 'title-prism-angle', 120), 60, 150);
  root.style.setProperty('--main-menu-system-title-prism-ms', `${titlePrismMs}ms`);
  root.style.setProperty('--main-menu-system-title-prism-depth', `${titlePrismDepth}px`);
  root.style.setProperty('--main-menu-system-title-prism-lift', `${titlePrismLift}px`);
  root.style.setProperty('--main-menu-system-title-prism-perspective', `${clamp(numberProp(properties, 'title-prism-perspective', 620), 220, 1600)}px`);
  root.style.setProperty('--main-menu-system-title-prism-angle', `${titlePrismAngle}deg`);
  root.style.setProperty('--main-menu-system-title-prism-depth-soft', `${titlePrismDepth * 0.55}px`);
  root.style.setProperty('--main-menu-system-title-prism-depth-mid', `${titlePrismDepth * 1.05}px`);
  root.style.setProperty('--main-menu-system-title-prism-depth-far', `${titlePrismDepth * 1.75}px`);
  root.style.setProperty('--main-menu-system-title-prism-lift-soft', `${titlePrismLift * 0.25}px`);
  root.style.setProperty('--main-menu-system-title-prism-lift-mid', `${titlePrismLift * 0.75}px`);
  root.style.setProperty('--main-menu-system-title-prism-lift-far', `${titlePrismLift * 1.3}px`);
  root.style.setProperty('--main-menu-system-title-prism-angle-soft', `${titlePrismAngle * 0.35}deg`);
  root.style.setProperty('--main-menu-system-title-prism-angle-mid', `${titlePrismAngle * 0.68}deg`);
  root.style.setProperty('--main-menu-system-stage-width', `${STAGE_WIDTH}px`);
  root.style.setProperty('--main-menu-system-stage-height', `${STAGE_HEIGHT}px`);
  root.style.setProperty('--main-menu-system-back-x', `${numberProp(properties, 'back-button-x', 150)}px`);
  root.style.setProperty('--main-menu-system-back-y', `${numberProp(properties, 'back-button-y', 112)}px`);
  root.style.setProperty('--main-menu-system-detail-x', `${numberProp(properties, 'detail-x', 910)}px`);
  root.style.setProperty('--main-menu-system-detail-y', `${numberProp(properties, 'detail-y', 318)}px`);
  root.style.setProperty('--main-menu-system-detail-width', `${numberProp(properties, 'detail-width', 388)}px`);
  root.style.setProperty('--main-menu-system-detail-wide-x', `${numberProp(properties, 'detail-wide-x', 730)}px`);
  root.style.setProperty('--main-menu-system-detail-wide-y', `${numberProp(properties, 'detail-wide-y', 238)}px`);
  root.style.setProperty('--main-menu-system-detail-wide-width', `${numberProp(properties, 'detail-wide-width', 574)}px`);
  if (layerId) root.dataset.layerId = layerId;
  const orbitGuide = renderOrbitGuide(properties, orbitRadius);
  if (orbitGuide) root.appendChild(orbitGuide);

  const controller = createController(root, config, properties, parts, runtime);
  root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));
  if (booleanProp(properties, 'enable-keyboard', true)) {
    const handleKeyDown = (event) => {
      if (!root.isConnected) {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
        return;
      }
      if (event.mainMenuSystemHandled) return;
      const tagName = event.target?.tagName?.toLowerCase?.();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
      const markHandled = () => {
        event.mainMenuSystemHandled = true;
        event.preventDefault();
        event.stopPropagation();
      };
      if (event.key === 'ArrowDown') {
        markHandled();
        controller.move(1);
      } else if (event.key === 'ArrowUp') {
        markHandled();
        controller.move(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        markHandled();
        controller.enter();
      } else if (event.key === 'ArrowLeft' || event.key === 'Backspace' || (event.key === 'Escape' && (controller.canBack() || controller.canExit()))) {
        markHandled();
        controller.back();
      }
    };
    root.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown, { capture: true });
  }
  if (booleanProp(properties, 'enable-gamepad', true)) {
    startGamepadLoop(root, controller);
  }

  await controller.render({ animate: false });
  return root;
}

export const properties = {
  sections: [
    {
      id: 'main-menu-system-data',
      label: 'Authoring Preview',
      description: 'Choose which menu state the editor should mount by default. Menu content is edited in Menu Data and falls back to the config URL only when no inline graph is present.',
      properties: {
        config: {
          type: 'string',
          label: 'Fallback URL',
          description: 'Public JSON file used only when this component has no inline menu-config graph.',
        },
        'initial-menu': {
          type: 'select',
          label: 'Menu',
          description: 'Menu ID to show when the component mounts. Use this to inspect submenus in the editor.',
          options: [
            { value: 'main', label: 'Main Menu' },
            { value: 'solo', label: '1-P Mode' },
            { value: 'vs', label: 'VS. Mode' },
            { value: 'options', label: 'Options' },
            { value: 'screen-display', label: 'Options / Screen Display' },
            { value: 'data', label: 'Data' },
          ],
        },
        'initial-selected-index': {
          type: 'number',
          label: 'Selected',
          description: 'Initial selected row, using 1-based indexing.',
          min: 1,
          max: 5,
          step: 1,
        },
      },
    },
    {
      id: 'main-menu-system-menu-layout',
      label: 'Menu Stack',
      description: 'Global offsets applied to the dynamic row stack after each menu layout preset is chosen.',
      properties: {
        'menu-x-offset': { type: 'number', label: 'X Offset', description: 'Horizontal offset added to all rows.', min: -300, max: 300, step: 1 },
        'menu-y-offset': { type: 'number', label: 'Y Offset', description: 'Vertical offset added to all rows.', min: -300, max: 300, step: 1 },
        'menu-scale': { type: 'number', label: 'Scale', description: 'Uniform multiplier for row geometry and text.', min: 0.5, max: 1.5, step: 0.01 },
        'menu-width-scale': { type: 'number', label: 'Width', description: 'Additional row width multiplier.', min: 0.6, max: 1.4, step: 0.01 },
        'menu-font-scale': { type: 'number', label: 'Font', description: 'Additional row label size multiplier.', min: 0.6, max: 1.4, step: 0.01 },
      },
    },
    {
      id: 'main-menu-system-shield-layout',
      label: 'Shield Text',
      description: 'Placement for the title and bottom caption box drawn by the shield part.',
      sections: [
        {
          id: 'main-menu-system-shield-title',
          label: 'Title',
          properties: {
            'title-x': { type: 'number', label: 'Box X', description: 'Left edge of the right-aligned title fit box.', min: 0, max: 1440, step: 1 },
            'title-y': { type: 'number', label: 'Center Y', description: 'Vertical center of the title fit box.', min: 0, max: 1080, step: 1 },
            'title-box-width': { type: 'number', label: 'Box Width', description: 'Width used to right-align and auto-fit the title text.', min: 80, max: 900, step: 1 },
            'title-box-height': { type: 'number', label: 'Box Height', description: 'Height used to auto-fit the title text.', min: 24, max: 220, step: 1 },
            'title-fit-padding-x': { type: 'number', label: 'Pad X', description: 'Horizontal inset inside the title fit box.', min: 0, max: 120, step: 1 },
            'title-fit-padding-y': { type: 'number', label: 'Pad Y', description: 'Vertical inset inside the title fit box.', min: 0, max: 80, step: 1 },
            'title-font-size': { type: 'number', label: 'Size', description: 'Title font size in viewBox pixels.', min: 24, max: 120, step: 1 },
          },
        },
        {
          id: 'main-menu-system-shield-caption',
          label: 'Caption',
          properties: {
            'caption-center-in-box': { type: 'boolean', label: 'Center Text', description: 'Center the bottom caption text inside the selected-item box.' },
            'caption-x': { type: 'number', label: 'Text X', description: 'Bottom caption text X in stage pixels. Used when centering is off.', min: 0, max: 1440, step: 1 },
            'caption-y': { type: 'number', label: 'Text Y', description: 'Bottom caption text Y in stage pixels. Used when centering is off.', min: 0, max: 1080, step: 1 },
            'caption-font-size': { type: 'number', label: 'Text Size', description: 'Bottom caption font size.', min: 18, max: 90, step: 1 },
            'caption-box-x': { type: 'number', label: 'Box X', description: 'Bottom caption box X.', min: 0, max: 1440, step: 1 },
            'caption-box-y': { type: 'number', label: 'Box Y', description: 'Bottom caption box Y.', min: 0, max: 1080, step: 1 },
            'caption-box-width': { type: 'number', label: 'Box Width', description: 'Bottom caption box width.', min: 200, max: 1200, step: 1 },
            'caption-box-height': { type: 'number', label: 'Box Height', description: 'Bottom caption box height.', min: 40, max: 180, step: 1 },
          },
        },
        {
          id: 'main-menu-system-shield-debug',
          label: 'Debug',
          properties: {
            'shield-text-debug': { type: 'boolean', label: 'Show Text Boxes', description: 'Draw debug rectangles around the title and caption text fit boxes.' },
          },
        },
      ],
    },
    {
      id: 'main-menu-system-side-layout',
      label: 'Side Preview',
      description: 'Placement for row-list previews on the projected side panel.',
      sections: [
        {
          id: 'main-menu-system-side-panel',
          label: 'Panel',
          properties: {
            'side-x': { type: 'number', label: 'Panel X', description: 'Horizontal side-panel offset.', min: -300, max: 400, step: 1 },
            'side-y': { type: 'number', label: 'Panel Y', description: 'Vertical side-panel offset.', min: -300, max: 400, step: 1 },
            'side-scale': { type: 'number', label: 'Scale', description: 'Side-panel scale.', min: 0.5, max: 1.5, step: 0.01 },
            'side-perspective': { type: 'number', label: 'Perspective', description: 'Side-panel CSS perspective.', min: 500, max: 3000, step: 10 },
            'side-panel-opacity': { type: 'number', label: 'Panel Opacity', description: 'Opacity for the side-panel fill.', min: 0, max: 1, step: 0.01 },
            'side-frame-visible': { type: 'boolean', label: 'Gray Border', description: 'Draws the projected gray border around the side panel.' },
          },
        },
        {
          id: 'main-menu-system-side-rain',
          label: 'Rain',
          properties: {
            'side-rain-density': { type: 'number', label: 'Density', description: 'Number of falling pixel streaks clipped inside the side panel. Set to 0 to hide the rain.', min: 0, max: 160, step: 1 },
            'side-rain-speed': { type: 'number', label: 'Speed', description: 'Multiplier for the downward side-panel pixel rain.', min: 0.05, max: 5, step: 0.05 },
            'side-rain-color-offset': { type: 'number', label: 'White Offset', description: 'How far the rain color is mixed from the side-panel color toward white.', min: 0, max: 1, step: 0.01 },
            'side-rain-x-scale': { type: 'number', label: 'X Scale', description: 'Width multiplier for each falling side-panel rain pixel or rectangle.', min: 0.1, max: 8, step: 0.05 },
            'side-rain-y-scale': { type: 'number', label: 'Y Scale', description: 'Height multiplier for each falling side-panel rain pixel or rectangle.', min: 0.1, max: 8, step: 0.05 },
          },
        },
        {
          id: 'main-menu-system-side-text',
          label: 'Text',
          properties: {
            'side-content-x': { type: 'number', label: 'Text X', description: 'Preview row text X.', min: 0, max: 1440, step: 1 },
            'side-content-y': { type: 'number', label: 'Text Y', description: 'Preview row text Y.', min: 0, max: 1080, step: 1 },
            'side-content-width': { type: 'number', label: 'Text Width', description: 'Auto-fit width for preview rows.', min: 80, max: 600, step: 1 },
            'side-line-height': { type: 'number', label: 'Line Height', description: 'Row spacing for preview text.', min: 24, max: 120, step: 1 },
            'side-font-scale': { type: 'number', label: 'Font', description: 'Preview text size multiplier.', min: 0.6, max: 1.4, step: 0.01 },
            'side-text-opacity': { type: 'number', label: 'Text Opacity', description: 'Opacity for the side-panel preview row text.', min: 0, max: 1, step: 0.01 },
          },
        },
        {
          id: 'main-menu-system-side-rail',
          label: 'Left Rail',
          properties: {
            'side-rail-visible': { type: 'boolean', label: 'Visible', description: 'Show the rotated left rail label.' },
            'side-rail-x': { type: 'number', label: 'Rail X', description: 'Horizontal anchor position for the rotated rail label.', min: 0, max: 1440, step: 1 },
            'side-rail-y': { type: 'number', label: 'Rail Y', description: 'Vertical anchor position for the rotated rail label.', min: 0, max: 1080, step: 1 },
            'side-rail-rotation': { type: 'number', label: 'Rail Rotation', description: 'Rotation angle for the left rail label.', min: -180, max: 180, step: 1 },
            'side-rail-font-size': { type: 'number', label: 'Rail Font', description: 'Font size for the left rail label.', min: 12, max: 80, step: 1 },
          },
        },
      ],
    },
    {
      id: 'main-menu-system-detail-layout',
      label: 'Detail Preview',
      description: 'Placement for custom preview drawings such as controller, records, toggle, and screen display panels.',
      properties: {
        'detail-x': { type: 'number', label: 'Detail X', description: 'Default detail panel X.', min: 0, max: 1440, step: 1 },
        'detail-y': { type: 'number', label: 'Detail Y', description: 'Default detail panel Y.', min: 0, max: 1080, step: 1 },
        'detail-width': { type: 'number', label: 'Detail W', description: 'Default detail panel width.', min: 160, max: 900, step: 1 },
        'detail-wide-x': { type: 'number', label: 'Wide X', description: 'Wide display-detail panel X.', min: 0, max: 1440, step: 1 },
        'detail-wide-y': { type: 'number', label: 'Wide Y', description: 'Wide display-detail panel Y.', min: 0, max: 1080, step: 1 },
        'detail-wide-width': { type: 'number', label: 'Wide W', description: 'Wide display-detail panel width.', min: 240, max: 1000, step: 1 },
      },
    },
    {
      id: 'main-menu-system-back-layout',
      label: 'Back Button',
      description: 'Placement for the clickable back arrow shown on submenus and root menus with a back target.',
      properties: {
        'back-button-x': { type: 'number', label: 'Back X', description: 'Back arrow X.', min: 0, max: 1440, step: 1 },
        'back-button-y': { type: 'number', label: 'Back Y', description: 'Back arrow Y.', min: 0, max: 1080, step: 1 },
      },
    },
    {
      id: 'main-menu-system-motion',
      label: 'Motion',
      description: 'Global timing controls for submenu transitions, color crossfades, and target selection fades.',
      sections: [
        {
          id: 'main-menu-system-motion-selection',
          label: 'Selection',
          properties: {
            'theme-transition-ms': {
              type: 'number',
              label: 'Border Color',
              description: 'Transition duration for border and side-panel color changes when selection moves.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'selection-target-fade-ms': {
              type: 'number',
              label: 'Target Fade',
              description: 'Fade-in and fade-out duration for the selected row target marker and active row highlight.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'menu-item-color-transition-ms': {
              type: 'number',
              label: 'Menu Item Color',
              description: 'Transition duration for selected row fill and label color changes.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'caption-transition-ms': {
              type: 'number',
              label: 'Description Fade',
              description: 'Fade duration for the bottom description text when selection or menu state changes.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'menu-motion-easing': {
              type: 'string',
              label: 'Easing',
              description: 'CSS easing used by selection and menu transitions.',
            },
          },
        },
        {
          id: 'main-menu-system-motion-layering',
          label: 'Layer Changes',
          properties: {
            'transition-ms': {
              type: 'number',
              label: 'Forward/Back',
              description: 'Forward/back menu transition length in milliseconds.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'menu-orbit-radius': {
              type: 'number',
              label: 'Orbit Radius',
              description: 'Vertical circular path distance for forward/back menu item transitions.',
              min: 120,
              max: 1800,
              step: 5,
            },
            'menu-orbit-angle': {
              type: 'number',
              label: 'Orbit Angle',
              description: 'Rotation angle used as menu items travel around the configured orbit center.',
              min: 0,
              max: 180,
              step: 1,
            },
            'menu-orbit-debug': {
              type: 'boolean',
              label: 'Show Orbit Guide',
              description: 'Draws the orbit circle, center point, radius, and edge points over the menu for motion tuning.',
            },
            'menu-orbit-center-x': {
              type: 'number',
              label: 'Guide Center X',
              description: 'Debug orbit guide center X in stage coordinates.',
              min: -1440,
              max: 2880,
              step: 1,
            },
            'menu-orbit-center-y': {
              type: 'number',
              label: 'Guide Center Y',
              description: 'Debug orbit guide center Y in stage coordinates.',
              min: -1080,
              max: 2160,
              step: 1,
            },
            'menu-orbit-debug-opacity': {
              type: 'number',
              label: 'Guide Opacity',
              description: 'Opacity for the debug orbit guide overlay.',
              min: 0,
              max: 1,
              step: 0.01,
            },
          },
        },
        {
          id: 'main-menu-system-motion-title-prism',
          label: 'Title Prism',
          properties: {
            'title-prism-ms': {
              type: 'number',
              label: 'Duration',
              description: '3D title face rotation duration for forward/back menu changes.',
              min: 0,
              max: 2000,
              step: 10,
            },
            'title-prism-depth': {
              type: 'number',
              label: 'Depth',
              description: 'Horizontal 3D travel distance for the rotating title face.',
              min: 0,
              max: 220,
              step: 1,
            },
            'title-prism-lift': {
              type: 'number',
              label: 'Back Lift',
              description: 'Vertical lift used when backing out to a parent menu.',
              min: 0,
              max: 160,
              step: 1,
            },
            'title-prism-perspective': {
              type: 'number',
              label: 'Perspective',
              description: 'CSS 3D perspective for the title prism turn.',
              min: 220,
              max: 1600,
              step: 10,
            },
            'title-prism-angle': {
              type: 'number',
              label: 'Face Angle',
              description: 'Rotation angle between title prism faces.',
              min: 60,
              max: 150,
              step: 1,
            },
          },
        },
      ],
    },
    {
      id: 'main-menu-system-input',
      label: 'Input',
      description: 'Keyboard and gamepad behavior for preview/runtime navigation.',
      properties: {
        'enable-keyboard': {
          type: 'boolean',
          label: 'Keyboard',
          description: 'Arrow keys move, Enter selects, Escape goes back.',
        },
        'enable-gamepad': {
          type: 'boolean',
          label: 'Gamepad',
          description: 'D-pad or left stick moves; A enters; B backs out.',
        },
      },
    },
    {
      id: 'main-menu-system-audio',
      label: 'Audio',
      description: 'Sound asset IDs used by this menu shell for selection changes, entering submenus, and backing out.',
      sections: [
        {
          id: 'main-menu-system-audio-assets',
          label: 'Sound Assets',
          properties: {
            'ui-navigation-sound': {
              type: 'string',
              label: 'Navigation',
              description: 'Audio asset played when the selected row changes.',
            },
            'ui-forward-sound': {
              type: 'string',
              label: 'Forward',
              description: 'Audio asset played when entering a submenu.',
            },
            'ui-back-sound': {
              type: 'string',
              label: 'Back',
              description: 'Audio asset played when backing out of a submenu or leaving the root menu.',
            },
            'ui-navigation-volume': {
              type: 'number',
              label: 'Navigation Level',
              description: 'Navigation cue volume multiplier.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'ui-forward-volume': {
              type: 'number',
              label: 'Forward Level',
              description: 'Forward cue volume multiplier.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'ui-back-volume': {
              type: 'number',
              label: 'Back Level',
              description: 'Back cue volume multiplier.',
              min: 0,
              max: 1,
              step: 0.01,
            },
          },
        },
        {
          id: 'main-menu-system-audio-back',
          label: 'Back Behavior',
          properties: {
            'back-target': {
              type: 'string',
              label: 'Root Back',
              description: 'Scene ID to navigate to when backing out from the root menu. Leave empty to disable root back navigation.',
            },
          },
        },
      ],
    },
  ],
};

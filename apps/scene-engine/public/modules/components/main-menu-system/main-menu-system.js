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
    wash: 'rgba(39, 76, 222, 0.14)',
  },
  red: {
    name: 'red',
    border: '#c24334',
    borderSoft: '#e47b65',
    sidePanel: '#563244',
    sideEdge: '#9b4b55',
    sideFrame: '#b7adb2',
    sideText: '#f1d7d6',
    railText: '#c8aeb1',
    wash: 'rgba(188, 54, 42, 0.18)',
  },
  yellow: {
    name: 'yellow',
    border: '#b4a64b',
    borderSoft: '#e2cf62',
    sidePanel: '#4d4a35',
    sideEdge: '#9a8740',
    sideFrame: '#c2bda6',
    sideText: '#f4efd3',
    railText: '#c8c0a2',
    wash: 'rgba(188, 160, 42, 0.14)',
  },
  green: {
    name: 'green',
    border: '#45a86b',
    borderSoft: '#7ee29b',
    sidePanel: '#254f3a',
    sideEdge: '#4c9d65',
    sideFrame: '#b8c9bc',
    sideText: '#e3f7e7',
    railText: '#b4cfba',
    wash: 'rgba(50, 152, 88, 0.16)',
  },
  purple: {
    name: 'purple',
    border: '#7c32c8',
    borderSoft: '#b06aff',
    sidePanel: '#392c5d',
    sideEdge: '#7b48a6',
    sideFrame: '#bcb3ca',
    sideText: '#eadfff',
    railText: '#bdb0d2',
    wash: 'rgba(111, 41, 186, 0.18)',
  },
};

const DEFAULT_MENU_THEMING = {
  rowHot: '#fbba2d',
  rowPanel: '#050505',
  rowSelectedText: '#050505',
  rowText: '#fbba2d',
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

const LAYOUTS = {
  'main-stack': {
    itemProps: {
      'x-offset': -78,
      'y-offset': -18,
      'width-scale': 0.825,
      'text-max-font-size': 60,
    },
  },
  'left-stack-4': {
    itemProps: {
      'item-count': 4,
      'x-offset': -54,
      'y-offset': 10,
      'width-scale': 0.86,
      'text-max-font-size': 64,
      'row-1-x': 320,
      'row-1-y': 276,
      'row-1-width': 760,
      'row-2-x': 215,
      'row-2-y': 407,
      'row-2-width': 760,
      'row-3-x': 100,
      'row-3-y': 535,
      'row-3-width': 720,
      'row-4-x': 170,
      'row-4-y': 660,
      'row-4-width': 760,
    },
  },
  'left-stack-5': {
    itemProps: {
      'x-offset': -50,
      'y-offset': -10,
      'width-scale': 0.84,
      'font-scale': 0.96,
      'text-max-font-size': 64,
    },
  },
  'options-stack': {
    itemProps: {
      'x-offset': -50,
      'y-offset': 18,
      'width-scale': 0.82,
      'font-scale': 0.9,
      'text-max-font-size': 58,
      'row-3-x': 72,
      'row-3-width': 842,
      'row-3-font-size': 66,
    },
  },
  'data-stack': {
    itemProps: {
      'item-count': 3,
      'x-offset': -70,
      'y-offset': 38,
      'width-scale': 0.88,
      'font-scale': 0.94,
      'text-max-font-size': 60,
      'row-1-x': 328,
      'row-1-y': 306,
      'row-1-width': 820,
      'row-2-x': 120,
      'row-2-y': 502,
      'row-2-width': 800,
      'row-3-x': 112,
      'row-3-y': 674,
      'row-3-width': 812,
    },
  },
  'detail-only': {
    itemProps: {
      'item-count': 1,
      'x-offset': -32,
      'y-offset': 20,
      'width-scale': 0.72,
      'text-max-font-size': 58,
      'row-1-x': 145,
      'row-1-y': 302,
      'row-1-width': 530,
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

function selectedItem(menu, selectedIndex) {
  const items = Array.isArray(menu?.items) ? menu.items : [];
  return items[clamp(selectedIndex, 0, Math.max(0, items.length - 1))] ?? null;
}

function selectedIndexFor(menu, index) {
  const count = Array.isArray(menu?.items) ? menu.items.length : 0;
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function layoutFor(menu) {
  return LAYOUTS[menu?.layout] ?? LAYOUTS['main-stack'];
}

function applyTheme(root, theme) {
  root.dataset.theme = theme.name;
  root.style.setProperty('--main-menu-system-theme', theme.border);
  root.style.setProperty('--main-menu-system-theme-soft', theme.borderSoft);
  root.style.setProperty('--main-menu-system-wash', theme.wash);
}

function labelsFor(menu) {
  return (Array.isArray(menu?.items) ? menu.items : []).map((item) => item.label);
}

function menuItemProps(menu, state, properties, menuTheming) {
  const labels = labelsFor(menu);
  const layout = layoutFor(menu);
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

function shieldProps(menu, item, theme, properties) {
  const caption = itemCaption(menu, item);
  return {
    'top-text': menu?.title ?? 'Main Menu',
    'bottom-text': caption,
    'border-color': theme.border,
    'border-opacity': 1,
    'fill-opacity': 0.15,
    'top-text-color': '#ededed',
    'bottom-text-color': '#e4e7ff',
    'button-border-color': '#eef1ff',
    'button-fill-color': '#03040a',
    'top-x': numberProp(properties, 'title-x', 179),
    'top-y': numberProp(properties, 'title-y', 120),
    'top-font-size': numberProp(properties, 'title-font-size', menu?.title?.length > 18 ? 39 : 47),
    'bottom-x': numberProp(properties, 'caption-x', 730),
    'bottom-y': numberProp(properties, 'caption-y', 950),
    'bottom-font-size': numberProp(properties, 'caption-font-size', caption.length > 52 ? 28 : caption.length > 42 ? 34 : 56),
    'button-x': numberProp(properties, 'caption-box-x', 344),
    'button-y': numberProp(properties, 'caption-box-y', 902),
    'button-width': numberProp(properties, 'caption-box-width', 762),
    'button-height': numberProp(properties, 'caption-box-height', 85),
    'button-radius': 11,
    'button-border-width': 7,
  };
}

function previewRows(preview) {
  if (Array.isArray(preview)) return preview;
  if (Array.isArray(preview?.rows)) return preview.rows;
  return [];
}

function sideMenuProps(menu, item, theme, properties) {
  const preview = itemPreview(menu, item);
  const rows = previewRows(preview);
  const defaultContentY = rows.length > 3 ? 404 : 452;
  const defaultLineHeight = rows.length > 4 ? 54 : 70;
  const defaultFontSize = rows.length > 4 ? 34 : 43;
  const props = {
    'item-count': Math.max(1, rows.length),
    items: rows.join('|'),
    'rail-text': preview.railText ?? 'START PAUSE',
    'global-x': numberProp(properties, 'side-x', 67),
    'global-y': numberProp(properties, 'side-y', 0),
    scale: numberProp(properties, 'side-scale', 1),
    perspective: numberProp(properties, 'side-perspective', 1700),
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
    'rail-x': 919,
    'rail-y': 565,
    'rail-rotation': -90,
    'rail-font-size': 36,
    'panel-color': theme.sidePanel,
    'panel-edge-color': theme.sideEdge,
    'panel-opacity': 0.53,
    'panel-edge-opacity': 0.82,
    'frame-color': theme.sideFrame,
    'frame-inner-color': '#32384e',
    'frame-opacity': 0.55,
    'frame-inner-opacity': 0.53,
    'text-color': theme.sideText,
    'rail-text-color': theme.railText,
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
  const node = detailNode('main-menu-system__detail--records');
  addLabel(node, 'main-menu-system__detail-title', 'Records');
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

async function renderPreview(menu, item, theme, parts, properties) {
  const preview = itemPreview(menu, item);
  if (preview?.type === 'controller') return renderControllerPreview();
  if (preview?.type === 'display-settings') return renderDisplayPreview();
  if (preview?.type === 'records-grid') return renderRecordsPreview();
  if (preview?.type === 'toggles') return renderTogglePreview(preview);
  return parts.renderSideMenu({ properties: sideMenuProps(menu, item, theme, properties), layerId: 'main-menu-system-side-menu' });
}

function renderWash() {
  const node = document.createElement('div');
  node.className = 'main-menu-system__wash';
  return node;
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

function createController(root, config, properties, parts) {
  const transitionMs = clamp(numberProp(properties, 'transition-ms', 300), 0, 1000);
  const initial = stringProp(properties, 'initial-menu', config.initial ?? 'main');
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

  const controller = {
    move(delta) {
      if (state.busy) return;
      const menu = getMenu();
      state.selectedIndex = selectedIndexFor(menu, state.selectedIndex + delta);
      state.direction = delta > 0 ? 'down' : 'up';
      controller.render({ animate: false });
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
        controller.render({ animate: false });
      }
    },
    enter() {
      const menu = getMenu();
      const item = selectedItem(menu, state.selectedIndex);
      if (!item?.enter || !menuById(config, item.enter)) return;
      if (state.busy) return;
      state.stack.push(item.enter);
      state.activeMenu = item.enter;
      state.selectedIndex = 0;
      state.direction = 'forward';
      controller.render({ animate: true });
    },
    back() {
      if (state.stack.length <= 1 || state.busy) return;
      state.stack.pop();
      state.activeMenu = state.stack[state.stack.length - 1];
      state.selectedIndex = 0;
      state.direction = 'back';
      controller.render({ animate: true });
    },
    canBack() {
      return state.stack.length > 1;
    },
    async render({ animate } = {}) {
      const menu = getMenu();
      if (!menu) return;
      const item = selectedItem(menu, state.selectedIndex);
      const theme = itemTheme(config, menu, item);
      const menuTheming = menuThemingFromConfig(config);
      applyTheme(root, theme);
      root.dataset.activeMenu = state.activeMenu;
      root.dataset.selectedIndex = String(state.selectedIndex);

      const nextView = document.createElement('div');
      nextView.className = 'main-menu-system__view';
      nextView.dataset.direction = state.direction;
      nextView.appendChild(renderWash());
      nextView.appendChild(await renderPreview(menu, item, theme, parts, properties));
      nextView.appendChild(await parts.renderMenuShield({ properties: shieldProps(menu, item, theme, properties), layerId: 'main-menu-system-shield' }));
      nextView.appendChild(await parts.renderMenuItems({ properties: menuItemProps(menu, state, properties, menuTheming), layerId: 'main-menu-system-items' }));
      if (controller.canBack()) {
        nextView.appendChild(renderBackButton(menu, controller));
      }

      installPointerBindings(nextView, controller);

      const existingViews = [...root.querySelectorAll('.main-menu-system__view')];
      const currentView = existingViews[existingViews.length - 1];
      if (!animate || !currentView || transitionMs === 0) {
        existingViews.forEach((view) => view.remove());
        root.appendChild(nextView);
        return;
      }

      state.busy = true;
      existingViews.slice(0, -1).forEach((view) => view.remove());
      const directionClass = state.direction === 'back' ? 'back' : 'forward';
      nextView.classList.add(`is-entering-${directionClass}`);
      currentView.classList.add(`is-exiting-${directionClass}`);
      root.appendChild(nextView);
      requestAnimationFrame(() => {
        nextView.classList.add('is-active');
        currentView.classList.add('is-active');
      });
      window.setTimeout(() => {
        currentView.remove();
        nextView.classList.remove(`is-entering-${directionClass}`, 'is-active');
        state.busy = false;
      }, transitionMs);
    },
  };

  return controller;
}

export default async function ({ properties = {}, layerId } = {}) {
  STYLE_PATHS.forEach(ensureStylesheet);

  const [config, parts] = await Promise.all([resolveConfig(properties), loadParts()]);
  const root = document.createElement('div');
  root.className = 'main-menu-system';
  root.tabIndex = 0;
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Main menu');
  root.style.setProperty('--main-menu-system-transition-ms', `${clamp(numberProp(properties, 'transition-ms', 300), 0, 1000)}ms`);
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

  const controller = createController(root, config, properties, parts);
  root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));
  if (booleanProp(properties, 'enable-keyboard', true)) {
    const handleKeyDown = (event) => {
      if (!root.isConnected) {
        window.removeEventListener('keydown', handleKeyDown);
        return;
      }
      if (event.mainMenuSystemHandled) return;
      const tagName = event.target?.tagName?.toLowerCase?.();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
      if (event.key === 'ArrowDown') {
        event.mainMenuSystemHandled = true;
        event.preventDefault();
        controller.move(1);
      } else if (event.key === 'ArrowUp') {
        event.mainMenuSystemHandled = true;
        event.preventDefault();
        controller.move(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.mainMenuSystemHandled = true;
        event.preventDefault();
        controller.enter();
      } else if (event.key === 'ArrowLeft' || event.key === 'Backspace' || (event.key === 'Escape' && controller.canBack())) {
        event.mainMenuSystemHandled = true;
        event.preventDefault();
        controller.back();
      }
    };
    root.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);
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
      properties: {
        'title-x': { type: 'number', label: 'Title X', description: 'Title text X in stage pixels.', min: 0, max: 1440, step: 1 },
        'title-y': { type: 'number', label: 'Title Y', description: 'Title text Y in stage pixels.', min: 0, max: 1080, step: 1 },
        'title-font-size': { type: 'number', label: 'Title Size', description: 'Title font size in viewBox pixels.', min: 24, max: 120, step: 1 },
        'caption-x': { type: 'number', label: 'Caption X', description: 'Bottom caption text X in stage pixels.', min: 0, max: 1440, step: 1 },
        'caption-y': { type: 'number', label: 'Caption Y', description: 'Bottom caption text Y in stage pixels.', min: 0, max: 1080, step: 1 },
        'caption-font-size': { type: 'number', label: 'Caption Size', description: 'Bottom caption font size.', min: 18, max: 90, step: 1 },
        'caption-box-x': { type: 'number', label: 'Box X', description: 'Bottom caption box X.', min: 0, max: 1440, step: 1 },
        'caption-box-y': { type: 'number', label: 'Box Y', description: 'Bottom caption box Y.', min: 0, max: 1080, step: 1 },
        'caption-box-width': { type: 'number', label: 'Box Width', description: 'Bottom caption box width.', min: 200, max: 1200, step: 1 },
        'caption-box-height': { type: 'number', label: 'Box Height', description: 'Bottom caption box height.', min: 40, max: 180, step: 1 },
      },
    },
    {
      id: 'main-menu-system-side-layout',
      label: 'Side Preview',
      description: 'Placement for row-list previews on the projected side panel.',
      properties: {
        'side-x': { type: 'number', label: 'Panel X', description: 'Horizontal side-panel offset.', min: -300, max: 400, step: 1 },
        'side-y': { type: 'number', label: 'Panel Y', description: 'Vertical side-panel offset.', min: -300, max: 400, step: 1 },
        'side-scale': { type: 'number', label: 'Scale', description: 'Side-panel scale.', min: 0.5, max: 1.5, step: 0.01 },
        'side-perspective': { type: 'number', label: 'Perspective', description: 'Side-panel CSS perspective.', min: 500, max: 3000, step: 10 },
        'side-content-x': { type: 'number', label: 'Text X', description: 'Preview row text X.', min: 0, max: 1440, step: 1 },
        'side-content-y': { type: 'number', label: 'Text Y', description: 'Preview row text Y.', min: 0, max: 1080, step: 1 },
        'side-content-width': { type: 'number', label: 'Text Width', description: 'Auto-fit width for preview rows.', min: 80, max: 600, step: 1 },
        'side-line-height': { type: 'number', label: 'Line Height', description: 'Row spacing for preview text.', min: 24, max: 120, step: 1 },
        'side-font-scale': { type: 'number', label: 'Font', description: 'Preview text size multiplier.', min: 0.6, max: 1.4, step: 0.01 },
      },
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
      description: 'Placement for the clickable back arrow shown on submenus.',
      properties: {
        'back-button-x': { type: 'number', label: 'Back X', description: 'Back arrow X.', min: 0, max: 1440, step: 1 },
        'back-button-y': { type: 'number', label: 'Back Y', description: 'Back arrow Y.', min: 0, max: 1080, step: 1 },
      },
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
        'transition-ms': {
          type: 'number',
          label: 'Transition',
          description: 'Forward/back menu transition length in milliseconds.',
          min: 0,
          max: 1000,
          step: 10,
        },
      },
    },
  ],
};

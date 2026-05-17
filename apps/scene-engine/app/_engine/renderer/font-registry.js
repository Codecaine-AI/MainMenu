import { resolveRuntimeUrl } from './runtime-url.js';

const loadedFonts = new Set();
const failedFonts = new Set();

function fontFormat(file) {
  if (file.endsWith('.otf')) return 'opentype';
  if (file.endsWith('.ttf')) return 'truetype';
  if (file.endsWith('.woff')) return 'woff';
  if (file.endsWith('.woff2')) return 'woff2';
  return undefined;
}

function familyFromId(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function fontFamilyForEntry(id, entry) {
  return entry?.family || familyFromId(id);
}

export function fontEntriesFromRegistry(registry) {
  if (!registry) return [];
  return Object.entries(registry)
    .filter(([, entry]) => entry?.type === 'font' && typeof entry.file === 'string')
    .map(([id, entry]) => ({
      id,
      family: fontFamilyForEntry(id, entry),
      file: resolveRuntimeUrl(entry.file),
      weight: entry.weight ?? 400,
      style: entry.style || 'normal',
    }));
}

export async function loadFontAssets(registry) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const fonts = fontEntriesFromRegistry(registry);
  await Promise.all(fonts.map(async (font) => {
    const key = `${font.family}:${font.weight}:${font.style}:${font.file}`;
    if (loadedFonts.has(key)) return;
    if (failedFonts.has(key)) return;
    const format = fontFormat(font.file);
    const source = format ? `url("${font.file}") format("${format}")` : `url("${font.file}")`;
    const face = new FontFace(font.family, source, {
      weight: String(font.weight),
      style: font.style,
      display: 'swap',
    });
    try {
      await face.load();
      document.fonts.add(face);
      loadedFonts.add(key);
    } catch (err) {
      failedFonts.add(key);
      console.warn(`[font-registry] failed to load font ${font.family} from ${font.file}`, err);
    }
  }));
}

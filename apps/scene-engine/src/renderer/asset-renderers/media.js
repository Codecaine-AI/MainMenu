export function renderMedia(layer, entry) {
  const video = document.createElement('video');
  video.src = entry.path;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = layer.properties?.fit ?? 'cover';
  video.style.mixBlendMode = layer.properties?.blend ?? 'normal';
  video.style.opacity = layer.properties?.opacity ?? 1;
  return video;
}

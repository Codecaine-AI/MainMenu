export function renderMedia(layer, entry) {
  const video = document.createElement('video');
  video.src = entry.file;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.style.width = '100%';
  video.style.height = '100%';
  return video;
}

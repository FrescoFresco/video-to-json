const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|mpeg|mpg|ogv)$/i;

export function isVideoFilename(name: string) {
  return VIDEO_EXT.test(name);
}

export function isVideoFile(file: { name: string; type: string }) {
  if (file.type.startsWith("audio/")) return false;
  if (file.type.startsWith("video/")) return true;
  return isVideoFilename(file.name);
}

export function isUrlListFile(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".csv");
}

export function isVideoZip(name: string) {
  return name.toLowerCase().endsWith(".zip");
}

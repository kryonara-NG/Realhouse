import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNativeReelhouse = () => Boolean(window.Capacitor?.isNativePlatform?.());
const KEY = "rh:native-downloads:v1";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 100))); } catch {} };
const safeName = (s) => String(s || "reelhouse-video").normalize("NFKD").replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "reelhouse-video";
const extFor = (url, type) => {
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "mp4";
  if (clean.endsWith(".m4v")) return "m4v";
  if (clean.endsWith(".webm")) return "webm";
  return type === "mp4" ? "mp4" : null;
};

export function getNativeDownloads() { return read(); }
export function canDownloadNativeSource(source) {
  return isNativeReelhouse() && Boolean(source?.url) && source?.type === "mp4" && Boolean(extFor(source.url, source.type));
}

export async function downloadNativeMovie({ source, title, season, episode, onProgress }) {
  if (!isNativeReelhouse()) throw new Error("Downloads are available in the Reelhouse app only.");
  if (!canDownloadNativeSource(source)) throw new Error("This stream is HLS or otherwise not a direct downloadable video file.");
  const ext = extFor(source.url, source.type);
  const suffix = season != null ? "-S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0") : "";
  const path = "downloads/" + safeName((title || "movie") + suffix) + "-" + Date.now() + "." + ext;
  onProgress?.({ phase: "starting", percent: 0 });

  const response = await fetch(source.url, { headers: source.headers || {}, credentials: "omit" });
  if (!response.ok || !response.body) throw new Error("Download request failed (" + response.status + ").");
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    received += part.value.byteLength;
    onProgress?.({ phase: "downloading", percent: total ? Math.min(99, Math.round(received / total * 100)) : null, received, total });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  const saved = await Filesystem.writeFile({ path, data: btoa(binary), directory: Directory.Data, recursive: true });
  const item = { id: path, path, uri: saved.uri || "", title: title || "Untitled", season: season ?? null, episode: episode ?? null, type: "downloaded", size: bytes.length, at: Date.now() };
  write([item, ...read().filter(x => x.id !== item.id)]);
  onProgress?.({ phase: "complete", percent: 100, item });
  return item;
}

export async function shareNativeDownload(item) {
  if (!isNativeReelhouse()) throw new Error("Sharing downloaded files is available in the Reelhouse app.");
  const uri = item?.uri || (await Filesystem.getUri({ directory: Directory.Data, path: item.path })).uri;
  return Share.share({ title: "Share " + (item.title || "Reelhouse movie"), text: "Shared from Reelhouse", url: uri, dialogTitle: "Share movie" });
}

export async function deleteNativeDownload(item) {
  await Filesystem.deleteFile({ directory: Directory.Data, path: item.path });
  write(read().filter(x => x.id !== item.id));
}

export async function openNativeDownload(item) {
  return item?.uri || (await Filesystem.getUri({ directory: Directory.Data, path: item.path })).uri;
}

export function makeCalendarEvent({ title, releaseDate, overview = "", url = location.href }) {
  const start = new Date(String(releaseDate) + "T09:00:00");
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Reelhouse//Release Reminder//EN","BEGIN:VEVENT",
    "UID:reelhouse-" + safeName(title) + "-" + releaseDate + "@reelhouse",
    "DTSTAMP:" + fmt(new Date()),"DTSTART:" + fmt(start),"DTEND:" + fmt(end),
    "SUMMARY:Reelhouse release: " + String(title || "").replace(/[\\r\\n]/g, " "),
    "DESCRIPTION:" + String(overview || "A Reelhouse title is scheduled for release.").replace(/[\\r\\n]/g, " ") + "\\n" + url,
    "BEGIN:VALARM","TRIGGER:-PT15M","ACTION:DISPLAY","DESCRIPTION:" + String(title || "Reelhouse release").replace(/[\\r\\n]/g, " "),
    "END:VALARM","END:VEVENT","END:VCALENDAR"
  ].join("\\r\\n");
}

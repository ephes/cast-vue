import { fetchJson } from "../helpers/fetchJson";
import { parseClock } from "../helpers/time";

// Episode data for the audio player, read from django-cast's Podlove-format
// audio endpoint (the URLs in a post's `podlove_players` field).

export interface AudioSource {
  url: string;
  mimeType: string;
  size: number;
  title: string;
}

export interface Chapter {
  start: number;
  title: string;
}

export interface Cue {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

export interface EpisodeMeta {
  title: string;
  subtitle: string;
  showTitle: string;
  poster: string;
  link: string;
  duration: number;
  sources: AudioSource[];
  chapters: Chapter[];
  cues: Cue[];
}

const MAX_CHAPTERS = 500;
const MAX_CUES = 20000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Absolute http(s) URL for a value from the API, or "" when it is unusable.
export function resolveHttpUrl(value: unknown, base: string): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function absoluteApiUrl(apiUrl: string): string {
  return resolveHttpUrl(apiUrl, window.location.href);
}

export function parseEpisode(data: unknown, apiUrl: string): EpisodeMeta {
  if (!data || typeof data !== "object") throw new Error("Invalid episode response");
  const raw = data as Record<string, unknown>;
  const show = (raw.show && typeof raw.show === "object" ? raw.show : {}) as Record<string, unknown>;

  const sources: AudioSource[] = [];
  for (const entry of Array.isArray(raw.audio) ? raw.audio : []) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const url = resolveHttpUrl(item.url, apiUrl);
    if (!url) continue;
    const size = Number(item.size);
    sources.push({
      url,
      mimeType: text(item.mimeType),
      size: Number.isFinite(size) && size > 0 ? size : 0,
      title: text(item.title),
    });
  }
  if (sources.length === 0) throw new Error("Episode has no audio");

  const chapters: Chapter[] = [];
  for (const entry of (Array.isArray(raw.chapters) ? raw.chapters : []).slice(0, MAX_CHAPTERS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const start = parseClock(item.start);
    const title = text(item.title);
    if (start !== null && title) chapters.push({ start, title });
  }
  chapters.sort((a, b) => a.start - b.start);

  const cues: Cue[] = [];
  for (const entry of (Array.isArray(raw.transcripts) ? raw.transcripts : []).slice(0, MAX_CUES)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const startMs = typeof item.start_ms === "number" && Number.isFinite(item.start_ms) ? item.start_ms / 1000 : null;
    const endMs = typeof item.end_ms === "number" && Number.isFinite(item.end_ms) ? item.end_ms / 1000 : null;
    const start = startMs ?? parseClock(item.start);
    const body = text(item.text);
    if (start === null || start < 0 || !body) continue;
    const end = endMs ?? parseClock(item.end) ?? start;
    cues.push({ start, end: Math.max(end, start), speaker: text(item.speaker) || text(item.voice), text: body });
  }
  cues.sort((a, b) => a.start - b.start);

  return {
    title: text(raw.title),
    subtitle: text(raw.subtitle),
    showTitle: text(show.title),
    poster: resolveHttpUrl(show.poster, apiUrl),
    link: resolveHttpUrl(raw.link, apiUrl),
    duration: parseClock(raw.duration) ?? 0,
    sources,
    chapters,
    cues,
  };
}

// A few parsed episodes are kept so the list, the detail page and the player
// bar share one request. Failed loads are not cached.
const MAX_CACHED = 6;
const cache = new Map<string, Promise<EpisodeMeta>>();

export function loadEpisode(apiUrl: string, refresh = false): Promise<EpisodeMeta> {
  const key = absoluteApiUrl(apiUrl);
  if (!key) return Promise.reject(new Error("Invalid episode URL"));
  const cached = cache.get(key);
  if (cached && !refresh) return cached;
  const request = fetchJson(new URL(key)).then((data) => parseEpisode(data, key));
  cache.delete(key);
  cache.set(key, request);
  request.catch(() => {
    if (cache.get(key) === request) cache.delete(key);
  });
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return request;
}

export function clearEpisodeCacheForTests(): void {
  cache.clear();
}

import { reactive } from "vue";
import { absoluteApiUrl, loadEpisode, type EpisodeMeta } from "./episode";

// One audio element for the whole single-page app. Inline players (post list,
// post detail) and the player bar are views on this state, so playback
// continues while the reader moves between pages.

export interface EpisodeRef {
  apiUrl: string; // as delivered in `podlove_players`
  title?: string;
  slug?: string; // route slug of the post, when the caller knows it
}

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const STORAGE_KEY = "cast-vue:player";
const MAX_POSITIONS = 50;
const SAVE_INTERVAL_SECONDS = 5;
// Positions this close to either end restart the episode instead of resuming.
const RESUME_MARGIN_SECONDS = 10;

export const player = reactive({
  key: "", // absolute API URL of the loaded episode, "" when nothing is loaded
  ref: null as EpisodeRef | null,
  meta: null as EpisodeMeta | null,
  status: "idle" as "idle" | "loading" | "ready" | "error",
  error: "",
  playing: false,
  waiting: false,
  currentTime: 0,
  duration: 0,
  rate: 1,
  muted: false,
  // Number of full inline players of the loaded episode that are on screen;
  // the player bar hides while one is visible.
  inlineVisible: 0,
});

interface Stored {
  rate?: number;
  positions?: Record<string, number>;
}

function readStored(): Stored {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(update: (stored: Stored) => void): void {
  try {
    const stored = readStored();
    update(stored);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage may be unavailable; playback works without it.
  }
}

export function savedPosition(apiUrl: string): number {
  const value = readStored().positions?.[absoluteApiUrl(apiUrl)];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function savePosition(): void {
  if (!player.key) return;
  const key = player.key;
  const time = player.currentTime;
  const finished = player.duration > 0 && time > player.duration - RESUME_MARGIN_SECONDS;
  writeStored((stored) => {
    const positions = { ...(stored.positions || {}) };
    delete positions[key];
    if (time > RESUME_MARGIN_SECONDS && !finished) positions[key] = Math.floor(time);
    const keys = Object.keys(positions);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_POSITIONS))) delete positions[old];
    stored.positions = positions;
  });
}

let audio: HTMLAudioElement | null = null;
let generation = 0;
let pendingSeek: number | null = null;
let lastSaved = 0;

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const element = new Audio();
  element.preload = "metadata";
  const storedRate = readStored().rate;
  if (typeof storedRate === "number" && RATES.includes(storedRate)) player.rate = storedRate;
  element.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(element.duration) && element.duration > 0) player.duration = element.duration;
    if (pendingSeek !== null) {
      element.currentTime = pendingSeek;
      pendingSeek = null;
    }
    element.playbackRate = player.rate;
  });
  element.addEventListener("durationchange", () => {
    if (Number.isFinite(element.duration) && element.duration > 0) player.duration = element.duration;
  });
  element.addEventListener("timeupdate", () => {
    if (pendingSeek !== null) return;
    player.currentTime = element.currentTime;
    if (Math.abs(element.currentTime - lastSaved) >= SAVE_INTERVAL_SECONDS) {
      lastSaved = element.currentTime;
      savePosition();
    }
  });
  element.addEventListener("play", () => { player.playing = true; });
  element.addEventListener("pause", () => { player.playing = false; player.waiting = false; savePosition(); });
  element.addEventListener("waiting", () => { player.waiting = true; });
  element.addEventListener("playing", () => { player.waiting = false; });
  element.addEventListener("canplay", () => { player.waiting = false; });
  element.addEventListener("ended", () => { player.playing = false; savePosition(); });
  element.addEventListener("error", () => {
    if (!player.key) return;
    player.playing = false;
    player.waiting = false;
    player.status = "error";
    player.error = "The audio could not be played.";
  });
  audio = element;
  return element;
}

function pickSource(element: HTMLAudioElement, meta: EpisodeMeta): string {
  const playable = meta.sources.find((source) => source.mimeType && element.canPlayType?.(source.mimeType));
  return (playable ?? meta.sources[0]).url;
}

function updateMediaSession(): void {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined" || !player.meta) return;
  const meta = player.meta;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta.title || player.ref?.title || "",
    artist: meta.showTitle,
    artwork: meta.poster ? [{ src: meta.poster }] : [],
  });
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => { void resume(); }],
    ["pause", () => pause()],
    ["seekbackward", (details) => skip(-(details.seekOffset || 15))],
    ["seekforward", (details) => skip(details.seekOffset || 30)],
    ["seekto", (details) => { if (typeof details.seekTime === "number") seek(details.seekTime); }],
  ];
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // The browser does not support this action.
    }
  }
}

async function startPlayback(element: HTMLAudioElement): Promise<void> {
  try {
    await element.play();
  } catch (cause) {
    // Autoplay policy or an interrupted load: the reader can press play again.
    player.playing = false;
    if (cause instanceof DOMException && cause.name === "NotSupportedError") {
      player.status = "error";
      player.error = "The audio could not be played.";
    }
  }
}

export function isCurrent(apiUrl: string): boolean {
  return player.key !== "" && player.key === absoluteApiUrl(apiUrl);
}

// Load an episode and start playing it, optionally at `startAt` seconds.
export async function playEpisode(ref: EpisodeRef, startAt?: number): Promise<void> {
  const key = absoluteApiUrl(ref.apiUrl);
  if (!key) return;
  const element = ensureAudio();
  if (player.key === key && player.status === "ready") {
    if (startAt !== undefined) seek(startAt);
    await startPlayback(element);
    return;
  }
  const id = ++generation;
  savePosition();
  element.pause();
  player.key = key;
  player.ref = { ...ref };
  player.meta = null;
  player.status = "loading";
  player.error = "";
  player.playing = false;
  player.waiting = false;
  player.currentTime = startAt ?? savedPosition(ref.apiUrl);
  player.duration = 0;
  let meta: EpisodeMeta;
  try {
    meta = await loadEpisode(ref.apiUrl, false);
  } catch {
    if (id !== generation) return;
    player.status = "error";
    player.error = "Could not load the episode. Please retry.";
    return;
  }
  if (id !== generation) return;
  player.meta = meta;
  player.duration = meta.duration;
  player.status = "ready";
  const start = startAt ?? savedPosition(ref.apiUrl);
  pendingSeek = start > 0 ? start : null;
  lastSaved = start;
  element.src = pickSource(element, meta);
  element.playbackRate = player.rate;
  element.muted = player.muted;
  updateMediaSession();
  await startPlayback(element);
}

export async function resume(): Promise<void> {
  if (!player.ref) return;
  if (player.status === "error") {
    const ref = player.ref;
    const at = player.currentTime;
    player.key = "";
    await playEpisode(ref, at > 0 ? at : undefined);
    return;
  }
  if (audio && player.status === "ready") await startPlayback(audio);
}

export function pause(): void {
  audio?.pause();
}

export function toggle(ref: EpisodeRef): void {
  if (!isCurrent(ref.apiUrl)) {
    void playEpisode(ref);
  } else if (player.status === "loading") {
    return;
  } else if (player.playing) {
    pause();
  } else {
    void resume();
  }
}

export function seek(time: number): void {
  if (!audio || !player.key) return;
  const limit = player.duration > 0 ? player.duration : Number.MAX_SAFE_INTEGER;
  const target = Math.min(Math.max(0, time), limit);
  player.currentTime = target;
  if (audio.readyState >= 1) {
    audio.currentTime = target;
  } else {
    pendingSeek = target;
  }
}

export function skip(delta: number): void {
  seek(player.currentTime + delta);
}

export function setRate(rate: number): void {
  if (!RATES.includes(rate)) return;
  player.rate = rate;
  if (audio) audio.playbackRate = rate;
  writeStored((stored) => { stored.rate = rate; });
}

export function toggleMute(): void {
  player.muted = !player.muted;
  if (audio) audio.muted = player.muted;
}

// Stop playback and unload the episode (the player bar's close button).
export function closePlayer(): void {
  generation += 1;
  savePosition();
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  pendingSeek = null;
  player.key = "";
  player.ref = null;
  player.meta = null;
  player.status = "idle";
  player.error = "";
  player.playing = false;
  player.waiting = false;
  player.currentTime = 0;
  player.duration = 0;
  player.inlineVisible = 0;
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = null;
    } catch {
      // ignore
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", savePosition);
}

// Test hook: forget the audio element and all state.
export function resetPlayerForTests(): void {
  closePlayer();
  audio = null;
  player.rate = 1;
  player.muted = false;
}

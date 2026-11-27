// Shared test data.

// A response of django-cast's Podlove-format audio endpoint, with a few broken
// rows the player must skip.
export const podlove = () => ({
  show: { title: "Show", poster: "/media/poster.webp" },
  title: "Episode",
  subtitle: "Sub",
  duration: "0:01:36",
  link: "http://localhost:3000/show/episode/",
  audio: [
    { url: "/media/a.m4a", mimeType: "audio/mp4", size: "2097152", title: "M4A" },
    { url: "https://cdn.invalid/a.mp3", mimeType: "audio/mpeg", size: "770551", title: "MP3" },
    { url: "javascript:alert(1)", mimeType: "audio/mpeg", size: "1", title: "bad" },
  ],
  chapters: [
    { start: "00:00:40.030", title: "Second" },
    { start: "00:00:00", title: "Intro" },
    { start: "nonsense", title: "Dropped" },
    { start: "00:01:00", title: "  " },
  ],
  transcripts: [
    { start: "00:00:05.018", start_ms: 5018, end_ms: 10675, speaker: "Tom", text: "Second line" },
    { start: "00:00:00.000", end: "00:00:05.018", voice: "Mara", text: " First line " },
    { start_ms: 12000, text: "" },
    "junk",
  ],
});

// In-memory stand-in for window.localStorage.
export function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
  };
}

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearEpisodeCacheForTests, loadEpisode, parseEpisode } from "@/player/episode";

import { podlove } from "./fixtures";

const API = "http://localhost:3000/cast/api/audios/podlove/1/post/4/";
describe("parseEpisode", () => {
  test("normalizes sources, chapters and transcript cues", () => {
    const meta = parseEpisode(podlove(), API);
    expect(meta.title).toBe("Episode");
    expect(meta.showTitle).toBe("Show");
    expect(meta.duration).toBe(96);
    expect(meta.poster).toBe("http://localhost:3000/media/poster.webp");
    expect(meta.sources.map((source) => source.url)).toEqual(["http://localhost:3000/media/a.m4a", "https://cdn.invalid/a.mp3"]);
    expect(meta.sources[0].size).toBe(2097152);
    expect(meta.chapters).toEqual([{ start: 0, title: "Intro" }, { start: 40.03, title: "Second" }]);
    expect(meta.cues).toEqual([
      { start: 0, end: 5.018, speaker: "Mara", text: "First line" },
      { start: 5.018, end: 10.675, speaker: "Tom", text: "Second line" },
    ]);
  });

  test("tolerates missing optional parts and rejects episodes without audio", () => {
    const meta = parseEpisode({ audio: [{ url: "/a.mp3" }], transcripts: "nope", chapters: null }, API);
    expect(meta.chapters).toEqual([]);
    expect(meta.cues).toEqual([]);
    expect(meta.poster).toBe("");
    expect(() => parseEpisode({ audio: [{ url: "data:audio/mpeg;base64,AAAA" }] }, API)).toThrow();
    expect(() => parseEpisode(null, API)).toThrow();
  });
});

describe("loadEpisode", () => {
  beforeEach(() => clearEpisodeCacheForTests());
  afterEach(() => vi.unstubAllGlobals());

  test("shares one request per episode and does not cache failures", async () => {
    let fail = true;
    const fetchMock = vi.fn(async () => (fail ? new Response("no", { status: 500 }) : new Response(JSON.stringify(podlove()))));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadEpisode(API)).rejects.toThrow();
    fail = false;
    const [first, second] = await Promise.all([loadEpisode(API), loadEpisode(API)]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await loadEpisode(API, true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(loadEpisode("javascript:alert(1)")).rejects.toThrow();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { clearEpisodeCacheForTests } from "@/player/episode";
import { closePlayer, isCurrent, player, playEpisode, resetPlayerForTests, savedPosition, seek, setRate, skip, toggle } from "@/player/engine";
import { memoryStorage, podlove } from "./fixtures";

const A = "/cast/api/audios/podlove/1/post/4/";
const B = "/cast/api/audios/podlove/2/post/5/";
let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
let pending: Record<string, (response: Response) => void>;

function lastAudio(): HTMLAudioElement {
  return play.mock.contexts.at(-1) as HTMLAudioElement;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  clearEpisodeCacheForTests();
  pending = {};
  play = vi.fn(function (this: HTMLAudioElement) { this.dispatchEvent(new Event("play")); return Promise.resolve(); });
  pause = vi.fn(function (this: HTMLAudioElement) { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play as any);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(pause as any);
  vi.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn((url: URL) => new Promise((resolve) => { pending[url.pathname] = resolve; })));
});
afterEach(() => { resetPlayerForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const answer = (path: string, title: string) => pending[path](new Response(JSON.stringify({ ...podlove(), title })));

describe("player engine", () => {
  test("loads, plays, pauses and remembers the position", async () => {
    const started = playEpisode({ apiUrl: A, title: "A", slug: "a" });
    expect(player.status).toBe("loading");
    expect(isCurrent(A)).toBe(true);
    answer(A, "Episode A"); await started;
    expect(player.status).toBe("ready");
    expect(player.meta?.title).toBe("Episode A");
    expect(player.duration).toBe(96);
    expect(player.playing).toBe(true);
    expect(lastAudio().src).toContain("/media/a.m4a");

    const audio = lastAudio();
    Object.defineProperty(audio, "readyState", { value: 4, configurable: true });
    seek(42); expect(audio.currentTime).toBe(42);
    skip(1000); expect(player.currentTime).toBe(96);
    seek(42);
    toggle({ apiUrl: A });
    expect(pause).toHaveBeenCalled();
    expect(player.playing).toBe(false);
    expect(savedPosition(A)).toBe(42);
    toggle({ apiUrl: A }); await flushPromises();
    expect(player.playing).toBe(true);

    setRate(1.5); expect(audio.playbackRate).toBe(1.5);
    setRate(7); expect(player.rate).toBe(1.5);

    closePlayer();
    expect(player.key).toBe("");
    expect(isCurrent(A)).toBe(false);
  });

  test("the episode asked for last wins over a slower earlier one", async () => {
    const first = playEpisode({ apiUrl: A });
    const second = playEpisode({ apiUrl: B });
    answer(B, "Episode B"); await second;
    answer(A, "Episode A"); await first;
    expect(player.meta?.title).toBe("Episode B");
    expect(isCurrent(B)).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  test("a failed load is reported and can be retried", async () => {
    const started = playEpisode({ apiUrl: A });
    pending[A](new Response("gone", { status: 500 })); await started;
    expect(player.status).toBe("error");
    expect(player.error).toContain("Could not load");
    toggle({ apiUrl: A }); await flushPromises();
    answer(A, "Episode A"); await flushPromises();
    expect(player.status).toBe("ready");
    expect(player.playing).toBe(true);
  });

  test("starts at a requested time and reports audio errors", async () => {
    const started = playEpisode({ apiUrl: A }, 30);
    answer(A, "Episode A"); await started;
    expect(player.currentTime).toBe(30);
    lastAudio().dispatchEvent(new Event("error"));
    expect(player.status).toBe("error");
    expect(player.playing).toBe(false);
  });

  test("late media events of the previous episode never touch the next one's position", async () => {
    const first = playEpisode({ apiUrl: A });
    answer(A, "Episode A"); await first;
    const audio = lastAudio();
    Object.defineProperty(audio, "readyState", { value: 4, configurable: true });
    seek(40);
    window.localStorage.setItem("cast-vue:player", JSON.stringify({ positions: { ["http://localhost:3000" + B]: 70 } }));

    const second = playEpisode({ apiUrl: B });
    // The element still holds episode A while B loads.
    audio.dispatchEvent(new Event("timeupdate"));
    audio.dispatchEvent(new Event("pause"));
    audio.dispatchEvent(new Event("ended"));
    expect(savedPosition(B)).toBe(70);
    expect(savedPosition(A)).toBe(40);
    expect(player.currentTime).toBe(70);
    answer(B, "Episode B"); await second;
    expect(player.meta?.title).toBe("Episode B");
    expect(savedPosition(B)).toBe(70);
  });

  test("retry after a media error asks the API for fresh episode data", async () => {
    const started = playEpisode({ apiUrl: A });
    answer(A, "Episode A"); await started;
    expect(fetch).toHaveBeenCalledTimes(1);
    lastAudio().dispatchEvent(new Event("error"));
    expect(player.status).toBe("error");
    toggle({ apiUrl: A }); await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(2);
    answer(A, "Episode A again"); await flushPromises();
    expect(player.status).toBe("ready");
    expect(player.meta?.title).toBe("Episode A again");
  });
});

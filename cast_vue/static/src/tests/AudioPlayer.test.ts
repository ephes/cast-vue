import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AudioPlayer from "@/components/AudioPlayer.vue";
import TranscriptPanel from "@/components/TranscriptPanel.vue";
import { clearEpisodeCacheForTests } from "@/player/episode";
import { player, resetPlayerForTests } from "@/player/engine";
import { memoryStorage, podlove } from "./fixtures";

const API = "/cast/api/audios/podlove/1/post/4/";
let respond: () => Response;
let play: ReturnType<typeof vi.fn>;
const mounted: ReturnType<typeof mount>[] = [];

function render(props: Record<string, unknown> = {}) {
  const wrapper = mount(AudioPlayer, { props: { apiUrl: API, elementId: "#audio_1", title: "Episode", slug: "episode", ...props } });
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  clearEpisodeCacheForTests();
  respond = () => new Response(JSON.stringify(podlove()));
  play = vi.fn(function (this: HTMLAudioElement) { this.dispatchEvent(new Event("play")); return Promise.resolve(); });
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play as any);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLAudioElement) { this.dispatchEvent(new Event("pause")); });
  vi.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => respond()));
});
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  resetPlayerForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AudioPlayer.vue full player", () => {
  test("shows duration, chapters, transcript and download before playing", async () => {
    const wrapper = render();
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".cv-player__time--remaining").text()).toBe("-1:36");
    expect(wrapper.find('input[type="range"]').attributes("aria-valuetext")).toBe("0 seconds of 1 minute 36 seconds");
    expect(wrapper.find(".cv-player__chapter").text()).toContain("Intro");
    expect(wrapper.find("a[download]").attributes("href")).toBe("https://cdn.invalid/a.mp3");
    expect(play).not.toHaveBeenCalled();

    const chapters = wrapper.findAll(".cv-player__tab").find((tab) => tab.text().includes("Chapters"))!;
    expect(chapters.attributes("aria-expanded")).toBe("false");
    await chapters.trigger("click");
    expect(chapters.attributes("aria-expanded")).toBe("true");
    expect(wrapper.findAll(".cv-chapters__item").map((item) => item.text())).toEqual(["0:00Intro", "0:40Second"]);

    expect(wrapper.findComponent(TranscriptPanel).exists()).toBe(false);
    await wrapper.findAll(".cv-player__tab").find((tab) => tab.text().includes("Transcript"))!.trigger("click");
    expect(wrapper.findComponent(TranscriptPanel).text()).toContain("First line");
  });

  test("plays through the shared engine and jumps to a chapter", async () => {
    const wrapper = render();
    await flushPromises();
    await wrapper.find(".cv-player__play").trigger("click");
    await flushPromises();
    expect(play).toHaveBeenCalledTimes(1);
    expect(player.ref).toMatchObject({ apiUrl: API, title: "Episode", slug: "episode" });
    expect(wrapper.find(".cv-player__play").attributes("aria-label")).toBe("Pause");
    expect(fetch).toHaveBeenCalledTimes(1); // the engine reuses the player's episode data

    await wrapper.findAll(".cv-player__tab")[0].trigger("click");
    await wrapper.findAll(".cv-chapters__item")[1].trigger("click");
    await flushPromises();
    expect(player.currentTime).toBeCloseTo(40.03);
    expect(wrapper.find(".cv-chapters__item.is-active").text()).toContain("Second");

    await wrapper.find(".cv-player--full").trigger("keydown", { key: "k" });
    expect(player.playing).toBe(false);
    await wrapper.find(".cv-player--full").trigger("keydown", { key: "m" });
    expect(player.muted).toBe(true);
  });

  test("reports a failed load and retries", async () => {
    respond = () => new Response("gone", { status: 500 });
    const wrapper = render();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain("Could not load the player");
    respond = () => new Response(JSON.stringify(podlove()));
    await wrapper.find('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find(".cv-player__time--remaining").text()).toBe("-1:36");
  });

  test("a new episode URL replaces the previous episode's data", async () => {
    const wrapper = render();
    await flushPromises();
    respond = () => new Response(JSON.stringify({ ...podlove(), duration: "0:10:00", chapters: [] }));
    await wrapper.setProps({ apiUrl: "/cast/api/audios/podlove/2/post/5/" });
    await flushPromises();
    expect(wrapper.find(".cv-player__time--remaining").text()).toBe("-10:00");
    expect(wrapper.find(".cv-player__chapter").exists()).toBe(false);
  });
});

describe("AudioPlayer.vue compact player", () => {
  test("loads nothing until asked, then plays and shows the state", async () => {
    const wrapper = render({ variant: "compact" });
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();
    const button = wrapper.find("button");
    expect(button.attributes("aria-label")).toBe("Play Episode");
    expect(button.text()).toBe("Play episode");
    await button.trigger("click");
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(button.attributes("aria-label")).toBe("Pause Episode");
    expect(button.text()).toContain("Playing · 0:00 / 1:36");
    await button.trigger("click");
    expect(button.text()).toContain("Paused");
  });
});

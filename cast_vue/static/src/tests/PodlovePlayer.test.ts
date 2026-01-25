import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import PodlovePlayer from "@/components/PodlovePlayer.vue";

describe("PodlovePlayer.vue", () => {
  beforeEach(() => {
    (window as unknown as { podlovePlayer?: ReturnType<typeof vi.fn> }).podlovePlayer = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { podlovePlayer?: ReturnType<typeof vi.fn> }).podlovePlayer;
  });

  test("calls podlovePlayer with element and config URL", async () => {
    const apiUrl = "http://localhost:8000/cast/api/audios/podlove/1/post/2/";
    const playerConfig = new URL("http://localhost:8000/cast/api/audios/player_config/");

    const wrapper = mount(PodlovePlayer, {
      props: {
        elementId: "#audio_1",
        apiUrl,
        playerConfig,
      },
    });

    await nextTick();

    const podlovePlayerMock = (window as unknown as { podlovePlayer: ReturnType<typeof vi.fn> }).podlovePlayer;
    expect(podlovePlayerMock).toHaveBeenCalledTimes(1);
    const callArgs = podlovePlayerMock.mock.calls[0];
    expect(callArgs[0]).toBe(wrapper.find("div").element);
    expect(callArgs[1]).toBe(apiUrl);
    expect(callArgs[2]).toBe(playerConfig.toString());
  });

  test("clears container on unmount", async () => {
    const wrapper = mount(PodlovePlayer, {
      props: {
        elementId: "#audio_2",
        apiUrl: "http://localhost:8000/cast/api/audios/podlove/3/post/4/",
        playerConfig: new URL("http://localhost:8000/cast/api/audios/player_config/"),
      },
    });

    const container = wrapper.find("div").element as HTMLDivElement;
    container.innerHTML = "<iframe></iframe>";

    await nextTick();
    wrapper.unmount();

    expect(container.innerHTML).toBe("");
  });
});

import { afterEach, expect, test } from "vitest";
import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import PlayerBar from "@/components/PlayerBar.vue";
import { player, resetPlayerForTests } from "@/player/engine";

const Page = { template: "<div></div>" };
afterEach(() => resetPlayerForTests());

async function render(routes: { path: string; name: string; component: unknown }[]) {
  const router = createRouter({ history: createMemoryHistory(), routes: routes as never });
  await router.push("/"); await router.isReady();
  const wrapper = mount(PlayerBar, { global: { plugins: [router], stubs: { transition: false } } });
  player.key = "http://localhost:3000/api/1/";
  player.ref = { apiUrl: "/api/1/", title: "Episode", slug: "episode" };
  player.status = "ready";
  player.duration = 96;
  player.currentTime = 30;
  await wrapper.vm.$nextTick();
  return wrapper;
}

test("shows the loaded episode, links to its post and hides behind a visible inline player", async () => {
  const wrapper = await render([{ path: "/", name: "PostList", component: Page }, { path: "/:slug/", name: "PostDetail", component: Page }]);
  expect(wrapper.find("a.cv-player-bar__title").attributes("href")).toBe("/episode/");
  expect(wrapper.find(".cv-player-bar__meta").text()).toBe("0:30 / 1:36");
  expect(document.documentElement.style.getPropertyValue("--cv-bar-h")).toMatch(/px$/);
  player.inlineVisible = 1;
  await wrapper.vm.$nextTick();
  expect(wrapper.find(".cv-player-bar").exists()).toBe(false);
  wrapper.unmount();
});

test("keeps the title plain where no post route exists (styleguide)", async () => {
  const wrapper = await render([{ path: "/", name: "Styleguide", component: Page }]);
  expect(wrapper.find("a.cv-player-bar__title").exists()).toBe(false);
  expect(wrapper.find("span.cv-player-bar__title").text()).toBe("Episode");
  await wrapper.find('[aria-label="Close player"]').trigger("click");
  expect(player.key).toBe("");
  wrapper.unmount();
});

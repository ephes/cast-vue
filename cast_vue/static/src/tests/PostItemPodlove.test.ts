import { afterEach, describe, test, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/config", () => ({
  default: {
    pageType: "styleguide",
    postCommentUrl: new URL("http://localhost:8000/show/comments/post/ajax/"),
    csrfToken: "csrf-token",
    apiPodlovePlayerConfigUrl: new URL("http://localhost:8000/cast/api/audios/player_config/"),
  },
}));

import PostItem from "@/components/PostItem.vue";

const buildPost = () => ({
  id: 1,
  title: "Test Post",
  visible_date: "2026-01-25",
  html_overview: "<p>overview</p>",
  html_detail: "<div id=\"vue-article-data\" data-article-date=\"\" data-article-date-time=\"\" data-article-author=\"\"></div>",
  comments_are_enabled: false,
  comments: [],
  comments_security_data: {
    content_type: "cast.post",
    object_pk: "1",
    timestamp: "0",
    security_hash: "hash",
  },
  podlove_players: [],
  meta: {
    type: "cast.Post",
    detail_url: "/post/",
    html_url: "/post/",
    slug: "test-post",
    first_published_at: "2026-01-25",
  },
});

describe("PostItem.vue podlove stripping", () => {
  test("removes server-rendered audio blocks and podlove-player tags", () => {
    const wrapper = mount(PostItem, {
      props: {
        post: buildPost(),
        detail: true,
      },
      global: {
        stubs: {
          "router-link": {
            template: "<a><slot /></a>",
          },
        },
      },
    });

    const html = `
      <div>
        <p>keep-me</p>
        <div class="block-audio">remove-me</div>
        <podlove-player data-url="http://example.com"></podlove-player>
      </div>
    `;

    const stripped = (wrapper.vm as unknown as { stripAudioBlocks: (value: string) => string }).stripAudioBlocks(html);
    expect(stripped).toContain("keep-me");
    expect(stripped).not.toContain("block-audio");
    expect(stripped).not.toContain("podlove-player");
  });
});

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); });

function render(html: string, detail: boolean, overview = html) {
  const wrapper = mount(PostItem, {
    props: { post: { ...buildPost(), html_detail: html, html_overview: overview }, detail },
    global: { stubs: { "router-link": { template: "<a><slot /></a>" } } },
  });
  mounted.push(wrapper);
  return wrapper;
}

// Shaped like cast_vue/templates/cast/vue/post_body.html.
const body = (text: string) => `<article><script id="vue-article-data" data-article-date="Nov. 9" data-article-date-time="2026-11-09" data-article-author="Editor"></script><section class="block-audio"><p>old player</p><podlove-player></podlove-player></section><section class="block-paragraph"><p>${text}</p></section></article>`;

describe("PostItem.vue rendered rich text", () => {
  test.each([false, true])("renders its own body with article metadata and without audio blocks (detail: %s)", detail => {
    const wrapper = render(body("detail body"), detail, body("overview body"));
    expect(wrapper.text()).toContain("Editor");
    expect(wrapper.find("time").attributes("datetime")).toBe("2026-11-09");
    expect(wrapper.text()).toContain(detail ? "detail body" : "overview body");
    expect(wrapper.text()).not.toContain(detail ? "overview body" : "detail body");
    expect(wrapper.text()).not.toContain("old player");
    expect(wrapper.find(".block-audio, podlove-player").exists()).toBe(false);
  });

  test("gallery modal does not reuse the previous image's sources", async () => {
    const first = '<picture><source type="image/avif" srcset="/a.avif 300w" data-modal-src="/full-a.avif" data-modal-srcset="/full-a.avif 1200w"><img id="gallery-image-1" src="/a.jpg" data-fullsrc="/full-a.jpg" data-modal-srcset="/full-a.jpg 1200w"></picture>';
    const second = '<picture><img id="gallery-image-2" src="/b.jpg"></picture>';
    const wrapper = render(first + second, true);
    await wrapper.find("#gallery-image-1").trigger("click");
    expect(wrapper.find("#modal-image").attributes("src")).toBe("/full-a.jpg");
    expect(wrapper.find("#modal-image").attributes("srcset")).toBe("/full-a.jpg 1200w");
    expect(wrapper.find(".modal source").attributes("src")).toBe("/full-a.avif");
    expect(wrapper.find(".modal source").attributes("srcset")).toBe("/full-a.avif 1200w");
    await wrapper.find("#gallery-image-2").trigger("click");
    expect(wrapper.find("#modal-image").attributes("src")).toBeUndefined();
    expect(wrapper.find("#modal-image").attributes("srcset")).toBeUndefined();
    expect(wrapper.find(".modal source").attributes("src")).toBeUndefined();
    expect(wrapper.find(".modal source").attributes("srcset")).toBeUndefined();
  });
});

describe("PostItem.vue players, cover and image viewer", () => {
  const gallery = '<picture><img id="gallery-image-1" alt="First" src="/a.jpg" data-fullsrc="/full-a.jpg" data-next="img-2"></picture><picture><img id="gallery-image-2" alt="Second" src="/b.jpg" data-fullsrc="/full-b.jpg" data-prev="img-1"></picture>';
  const mountPost = (detail: boolean, extra: Record<string, unknown> = {}) => {
    const wrapper = mount(PostItem, {
      props: { post: { ...buildPost(), html_detail: gallery, html_overview: gallery, ...extra }, detail },
      global: { stubs: { "router-link": { template: "<a><slot /></a>" }, AudioPlayer: { name: "AudioPlayer", props: ["apiUrl", "variant", "title", "slug"], template: "<div class='player-stub'></div>" } } },
      attachTo: document.body,
    });
    mounted.push(wrapper);
    return wrapper;
  };

  test("renders a full player on the post page and none in the styleguide list", () => {
    const players = { podlove_players: [["#audio_1", "/api/audios/podlove/1/post/1/"]] };
    const detail = mountPost(true, players).findComponent({ name: "AudioPlayer" });
    expect(detail.props()).toMatchObject({ apiUrl: "/api/audios/podlove/1/post/1/", variant: undefined, title: "Test Post", slug: "test-post" });
    expect(mountPost(false, players).findComponent({ name: "AudioPlayer" }).exists()).toBe(false);
    expect(mountPost(true, { podlove_players: null }).findComponent({ name: "AudioPlayer" }).exists()).toBe(false);
  });

  test("shows only http(s) cover images", () => {
    expect(mountPost(true, { cover_image_poster_url: "/media/cover.webp", cover_alt_text: "Cover" }).find(".cv-post__cover").attributes()).toMatchObject({ src: "http://localhost:3000/media/cover.webp", alt: "Cover" });
    expect(mountPost(true, { cover_image_poster_url: "javascript:alert(1)" }).find(".cv-post__cover").exists()).toBe(false);
    expect(mountPost(true, { cover_image_poster_url: null }).find(".cv-post__cover").exists()).toBe(false);
  });

  test("the image viewer works from the keyboard and returns focus", async () => {
    const wrapper = mountPost(true);
    const thumbnail = wrapper.find("#gallery-image-1");
    expect(thumbnail.attributes()).toMatchObject({ tabindex: "0", role: "button", "aria-label": "View image: First" });
    (thumbnail.element as HTMLElement).focus();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    thumbnail.element.dispatchEvent(enter);
    await wrapper.vm.$nextTick();
    // The key must not go on to press the close button that receives the focus.
    expect(enter.defaultPrevented).toBe(true);
    const modal = wrapper.find('[role="dialog"]');
    expect(modal.attributes("aria-modal")).toBe("true");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close image viewer");
    expect(document.documentElement.style.overflow).toBe("hidden");

    await modal.find('[aria-label="Next image"]').trigger("click");
    expect(wrapper.find("#modal-image").attributes("src")).toBe("/full-b.jpg");
    expect(wrapper.find("#modal-image").attributes("alt")).toBe("Second");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find("#modal-image").attributes("src")).toBe("/full-a.jpg");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(thumbnail.element);
    expect(document.documentElement.style.overflow).toBe("");
  });
});

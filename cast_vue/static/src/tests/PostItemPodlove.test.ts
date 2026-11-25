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
    expect(wrapper.find("time").attributes("date-time")).toBe("2026-11-09");
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

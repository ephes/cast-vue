import { describe, test, expect, vi } from "vitest";
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

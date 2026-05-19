import { describe, test, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mocks = vi.hoisted(() => {
  const fetchJson = vi.fn();
  return {
    fetchJson,
    dataStore: {
      slugToPost: {},
      fetchJson,
    },
  };
});

vi.mock("@/config", () => ({
  default: {
    pageType: "cast.Episode",
    postListUrl: new URL("http://localhost:8000/api/v2/pages/?child_of=1"),
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: {
      slug: "test-episode",
    },
  }),
}));

vi.mock("@/stores/dataStore", () => ({
  useDataStore: () => mocks.dataStore,
}));

import PostDetail from "@/components/PostDetail.vue";

const apiPost = {
  id: 1,
  title: "Test Episode",
  visible_date: "2026-01-25",
  html_overview: "<p>overview</p>",
  html_detail: '<section class="episode-contributors">contributors</section>',
  comments_are_enabled: false,
  comments: [],
  comments_security_data: {
    content_type: "cast.episode",
    object_pk: "1",
    timestamp: "0",
    security_hash: "hash",
  },
  podlove_players: [],
  meta: {
    type: "cast.Episode",
    detail_url: "/episodes/test-episode/",
    html_url: "/episodes/test-episode/",
    slug: "test-episode",
    first_published_at: "2026-01-25",
  },
};

describe("PostDetail.vue", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.dataStore.slugToPost = {};
    mocks.fetchJson.mockResolvedValue({ items: [apiPost] });
  });

  test("requests detail HTML outside feed mode so contributors are included", async () => {
    mount(PostDetail, {
      global: {
        stubs: {
          "router-link": {
            template: "<a><slot /></a>",
          },
          "post-item": {
            template: "<article></article>",
            props: ["post", "detail"],
          },
        },
      },
    });

    await flushPromises();

    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    const url = mocks.fetchJson.mock.calls[0][0] as URL;
    expect(url.searchParams.get("slug")).toBe("test-episode");
    expect(url.searchParams.get("fields")).toContain("html_detail");
    expect(url.searchParams.get("render_for_feed")).toBe("false");
  });
});

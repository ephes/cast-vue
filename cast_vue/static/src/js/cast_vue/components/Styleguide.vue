<template>
  <section class="cast-styleguide">
    <header class="cast-styleguide-header">
      <div class="cast-styleguide-heading">
        <h1>Styleguide</h1>
        <p v-if="styleguideData">
          Theme: {{ styleguideData.active_label || styleguideData.active_theme }}
        </p>
      </div>
      <form v-if="styleguideData" class="cast-styleguide-theme-switcher" @submit.prevent="switchTheme">
        <label for="styleguide-theme">Theme</label>
        <select id="styleguide-theme" v-model="selectedTheme" @change="switchTheme">
          <option v-for="choice in styleguideData.theme_choices" :key="choice.slug" :value="choice.slug">
            {{ choice.name }}
          </option>
        </select>
        <button type="submit" class="btn btn-outline-secondary btn-sm">Switch</button>
      </form>
      <p v-if="styleguideData?.warning" class="cast-styleguide-warning">{{ styleguideData.warning }}</p>
    </header>

    <nav class="cast-styleguide-nav">
      <a href="#typography">Typography</a>
      <a href="#buttons">Buttons &amp; links</a>
      <a href="#forms">Forms</a>
      <a href="#post-list">Post list</a>
      <a href="#content-blocks">Content blocks</a>
      <a href="#errors">Errors</a>
    </nav>

    <div class="cast-styleguide-content">
      <section id="typography">
        <h2>Typography</h2>
        <p><strong>Lead:</strong> Sample paragraph text for layout preview.</p>
        <p>
          Body text with
          <a href="#">inline link</a>,
          <strong>emphasis</strong>,
          <em>italics</em>,
          <code>code</code>.
        </p>
        <ul>
          <li>Unordered list item</li>
          <li>Another list item</li>
        </ul>
        <ol>
          <li>Ordered list item</li>
          <li>Second ordered item</li>
        </ol>
        <blockquote>
          <p>Blockquote sample for editorial layouts.</p>
          <cite>Attribution</cite>
        </blockquote>
      </section>

      <section id="buttons">
        <h2>Buttons &amp; links</h2>
        <p>
          <a href="#">Primary link</a>
          <button type="button">Button</button>
          <button type="button" disabled>Disabled</button>
        </p>
      </section>

      <section id="forms">
        <h2>Forms</h2>
        <filter-form
          :form="form"
          :facetCounts="facetCounts"
          @submit-filter-form="handleSubmitFilterForm"
        />
      </section>

      <section id="post-list">
        <h2>Post list</h2>
        <p v-if="isListLoading">Loading data...</p>
        <div v-else>
          <pagination-buttons
            :currentPage="currentPage"
            :totalPages="totalPages"
            @change-page="changePage"
          />
          <post-list :blog="blog" :posts="postsFromApi" />
        </div>
      </section>

      <section id="content-blocks">
        <h2>Content blocks</h2>
        <p v-if="isDetailLoading">Loading post...</p>
        <post-item
          v-else
          :post="detailPost"
          :detail="true"
          @comment-posted="handleCommentPosted"
        />
      </section>

      <section id="errors">
        <h2>Error pages</h2>
        <div>
          <h3>Bad Request</h3>
          <p>Bad request! Something in your request was just not right.</p>
        </div>
        <div>
          <h3>Permission Denied</h3>
          <p>Authorization failed.</p>
        </div>
        <div>
          <h3>Page not found</h3>
          <p>This is not the page you were looking for.</p>
        </div>
        <div>
          <h3>Server Error</h3>
          <p>Ooops!!! 500 — looks like something went wrong.</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script lang="ts">
import { computed, onMounted, ref, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import config from '../config';
import FilterForm from './FilterForm.vue';
import PaginationButtons from './PaginationButtons.vue';
import PostList from './PostList.vue';
import PostItem from './PostItem.vue';
import { FacetCounts, Form, Post, PostsFromApi } from './types';
import { useDataStore } from '../stores/dataStore';
import { getUrlSearchParams, setUrlSearchParams } from '../helpers/url';

interface StyleguideThemeChoice {
  slug: string;
  name: string;
}

interface StyleguidePayload {
  styleguide_url: string;
  theme_choices: StyleguideThemeChoice[];
  active_theme: string;
  active_label: string;
  warning: string | null;
  query_params: [string, string][];
  media_post_slug: string;
}

export default {
  name: 'Styleguide',
  components: {
    FilterForm,
    PaginationButtons,
    PostList,
    PostItem,
  },
  setup() {
    const styleguideData = config.styleguideData as StyleguidePayload | null;
    const selectedTheme = ref(styleguideData?.active_theme ?? 'bootstrap4');
    const route = useRoute();
    const router = useRouter();
    const dataStore = useDataStore();

    const isListLoading = ref(true);
    const isDetailLoading = ref(true);

    const blog = ref({});
    const postsFromApi = ref({} as PostsFromApi);
    const detailPost = ref({} as Post);
    const facetCounts = ref({
      date_facets: [],
      category_facets: [],
      tag_facets: [],
    } as FacetCounts);

    const allowedQueryKeys = new Set([
      'search',
      'date_after',
      'date_before',
      'date_facets',
      'category_facets',
      'tag_facets',
      'order',
      'page',
    ]);
    const sanitizeQuery = (query: Record<string, any>) => {
      const params = getUrlSearchParams(query);
      Object.keys(params).forEach((key) => {
        if (!allowedQueryKeys.has(key)) {
          delete params[key];
        }
      });
      return params;
    };
    const form = ref(sanitizeQuery(route.query)) as unknown as Ref<Form>;
    const currentPage = ref(isNaN(Number(form.value.page)) ? 1 : Number(form.value.page));
    const itemsPerPage = config.paginationPageSize;
    const templateBaseDir = styleguideData?.active_theme ?? null;

    const styleguideUrl = styleguideData?.styleguide_url || config.styleguideUrl || window.location.pathname;

    const updateSearchParams = (url: URL, data: Form) => {
      const { page: _, ...params } = data;
      setUrlSearchParams(url, params);
    };

    const calculateFirstOffset = (data: Form) => {
      const { page: _, ...rest } = data;
      const params: Record<string, string> = { ...rest, offset: '0' } as Record<string, string>;
      if (data.page) {
        params.offset = ((Number(data.page) - 1) * itemsPerPage).toString();
      }
      return params;
    };

    const wagtailApiUrl = new URL(config.postListUrl.toString());
    wagtailApiUrl.searchParams.set('type', 'cast.Post');
    wagtailApiUrl.searchParams.set('fields', 'html_overview,html_detail,visible_date,podlove_players');
    wagtailApiUrl.searchParams.set('offset', '0');
    wagtailApiUrl.searchParams.set('limit', itemsPerPage.toString());
    wagtailApiUrl.searchParams.set('order', '-visible_date');
    wagtailApiUrl.searchParams.set('use_post_filter', 'true');
    wagtailApiUrl.searchParams.set('render_for_feed', 'false');
    if (templateBaseDir) {
      wagtailApiUrl.searchParams.set('template_base_dir', templateBaseDir);
    }
    updateSearchParams(wagtailApiUrl, calculateFirstOffset(form.value));

    const facetCountsApiUrl = new URL(config.apiFacetCountsUrl.toString());
    updateSearchParams(facetCountsApiUrl, calculateFirstOffset(form.value));

    const fetchListData = async () => {
      try {
        blog.value = await dataStore.fetchJson(config.blogDetailUrl);
        const facetResult = await dataStore.fetchJson(facetCountsApiUrl);
        facetCounts.value = facetResult.facet_counts as FacetCounts;
        const posts = await dataStore.fetchJson(wagtailApiUrl) as unknown as PostsFromApi;
        dataStore.setSlugToId(posts);
        postsFromApi.value = posts;
      } catch (error) {
        console.error('Error fetching styleguide list data: ', error);
      } finally {
        isListLoading.value = false;
      }
    };

    const fetchDetailPost = async (invalidateCache = false) => {
      if (!styleguideData?.media_post_slug) {
        isDetailLoading.value = false;
        return;
      }
      const postDetailUrl = new URL(config.postListUrl.toString());
      postDetailUrl.searchParams.set('type', 'cast.Post');
      postDetailUrl.searchParams.set('slug', styleguideData.media_post_slug);
      postDetailUrl.searchParams.set(
        'fields',
        'html_detail,visible_date,comments,comments_security_data,comments_are_enabled,podlove_players'
      );
      postDetailUrl.searchParams.set('render_for_feed', 'false');
      if (templateBaseDir) {
        postDetailUrl.searchParams.set('template_base_dir', templateBaseDir);
      }
      try {
        const posts = await dataStore.fetchJson(postDetailUrl, invalidateCache) as unknown as PostsFromApi;
        detailPost.value = posts.items[0];
      } catch (error) {
        console.error('Error fetching styleguide detail post: ', error);
      } finally {
        isDetailLoading.value = false;
      }
    };

    const handleSubmitFilterForm = async (data: Form) => {
      currentPage.value = 1;
      updateSearchParams(wagtailApiUrl, data);
      updateSearchParams(facetCountsApiUrl, data);
      await fetchListData();
      const theme = route.query.theme ? { theme: route.query.theme } : {};
      router.push({ query: { ...theme, ...(data as unknown as Record<string, string>) } });
    };

    const changePage = async (delta: number) => {
      currentPage.value += delta;
      wagtailApiUrl.searchParams.set('offset', ((currentPage.value - 1) * itemsPerPage).toString());
      const theme = route.query.theme ? { theme: route.query.theme } : {};
      router.push({ query: { ...theme, ...route.query, page: currentPage.value } });
      await fetchListData();
    };

    const totalPages = computed(() => {
      if (!postsFromApi.value.meta?.total_count) {
        return 1;
      }
      return Math.ceil(postsFromApi.value.meta.total_count / itemsPerPage);
    });

    const switchTheme = () => {
      if (!styleguideData) {
        return;
      }
      const url = new URL(styleguideUrl, window.location.origin);
      for (const [key, value] of styleguideData.query_params || []) {
        url.searchParams.append(key, value);
      }
      url.searchParams.set('theme', selectedTheme.value);
      window.location.assign(url.toString());
    };

    const handleCommentPosted = async () => {
      await fetchDetailPost(true);
    };

    onMounted(async () => {
      await Promise.all([fetchListData(), fetchDetailPost()]);
    });

    return {
      styleguideData,
      selectedTheme,
      switchTheme,
      isListLoading,
      isDetailLoading,
      blog,
      postsFromApi,
      detailPost,
      facetCounts,
      form,
      currentPage,
      totalPages,
      handleSubmitFilterForm,
      changePage,
      handleCommentPosted,
    };
  },
};
</script>

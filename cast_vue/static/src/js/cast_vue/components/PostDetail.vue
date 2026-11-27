<template>
  <div class="cv-detail">
    <div v-if="isLoading" class="cv-skeleton" role="status">
      <span class="cv-sr-only">Loading data...</span>
      <div class="cv-skeleton__item" aria-hidden="true">
        <div class="cv-skeleton__line cv-skeleton__line--short"></div>
        <div class="cv-skeleton__line cv-skeleton__line--title"></div>
        <div class="cv-skeleton__line"></div>
        <div class="cv-skeleton__line cv-skeleton__line--medium"></div>
        <div class="cv-skeleton__line"></div>
      </div>
    </div>
    <div v-else>
      <div v-if="error" class="cv-alert" role="alert">
        <p>{{ error }}</p><button type="button" class="cv-button" @click="fetchPostFromAPI(true)">Retry</button>
      </div>
      <router-link class="cv-back" to="/"><cv-icon name="arrowLeft" /> {{ blogTitle || 'Back to Blog' }}</router-link>
      <div v-if="!post && !error" class="cv-empty">
        <strong>Post not found.</strong>
        <span>It may have been moved or unpublished.</span>
      </div>
      <post-item v-if="post" :post="post" :detail="true" @comment-posted="handleCommentPosted"></post-item>
    </div>
  </div>
</template>

<script lang="ts">
import config from '../config';
import { useRoute } from 'vue-router';
import PostItem from './PostItem.vue';
import CvIcon from './CvIcon.vue';
import { blogTitle, setPageTitle } from '../helpers/site';
import { useDataStore } from '../stores/dataStore';
import { Post, PostsFromApi } from './types';
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { contentReadyToken, notifyContentReady } from '../helpers/viewTransitions';

export default {
  name: "PostDetail",
  components: {
    PostItem,
    CvIcon,
  },
  methods: {
    async handleCommentPosted(postId?: number) {
      if (postId !== undefined && postId !== this.post?.id) return;
      await this.fetchPostFromAPI(true);
    }
  },
  setup() {
    const route = useRoute();
    const dataStore = useDataStore();
    const wagtailApiUrl = new URL(config.postListUrl.toString()); // make a copy to not modify the original url

    const isLoading = ref(true);
    const post = ref<Post | null>(null);
    const visibleDateStr = ref("");

    const error = ref('');
    let requestId = 0;
    let requestOwner: AbortController | undefined;
    onBeforeUnmount(() => { requestId += 1; requestOwner?.abort(); });
    let currentSlug: string | undefined;
    const fetchPostFromAPI = async (invalidateCache: boolean = false) => {
      const id = ++requestId;
      requestOwner?.abort();
      const owner = new AbortController();
      requestOwner = owner;
      const readyToken = contentReadyToken();
      const postSlug = route.params.slug as string;
      isLoading.value = currentSlug !== postSlug || !post.value?.id;
      currentSlug = postSlug;
      error.value = '';
      if (isLoading.value) post.value = null;
      // FIXME maybe use clean detail url? But then we need to have
      // the page id instead of the slug and and either modify the API
      // to accept slugs or do a second request to get the page id. :/
      const postDetailUrl = new URL(wagtailApiUrl.href);
      // Without a known page type (a session started on the list) ask for posts,
      // which includes episodes.
      let pageType = config.pageType || "cast.Post";
      if (postSlug in dataStore.slugToPost) {
        // FIXME we could also just use the post detail url?
        pageType = dataStore.slugToPost[postSlug].meta.type;
      }
      postDetailUrl.searchParams.set("type", pageType);
      postDetailUrl.searchParams.set("slug", postSlug);
      postDetailUrl.searchParams.set("fields", "html_detail,visible_date,comments,comments_security_data,comments_are_enabled,podlove_players,cover_image_poster_url,cover_alt_text");
      postDetailUrl.searchParams.set("render_for_feed", "false");

      try {
        const posts = await dataStore.fetchJson(postDetailUrl, invalidateCache, owner.signal) as unknown as PostsFromApi;
        if (id !== requestId) return;
        if (!Array.isArray(posts.items)) throw new Error('Invalid detail response');
        const item = posts.items[0];
        if (item && (typeof item.id !== 'number' || typeof item.title !== 'string' || !item.meta)) {
          throw new Error('Invalid post');
        }
        post.value = item || null;
        if (item) setPageTitle(item.title);
      } catch (cause) {
        if (id === requestId) {
          console.error('Could not load post:', cause);
          error.value = 'Could not load post. Please retry.';
        }
      } finally {
        owner.abort();
        if (id === requestId) {
          isLoading.value = false;
          await nextTick();
          if (id === requestId) notifyContentReady(readyToken);
        }
      }
    }

    watch(() => route.params.slug, () => { void fetchPostFromAPI(); }, { immediate: true });
    return { dataStore, isLoading, error, post, visibleDate: visibleDateStr, fetchPostFromAPI, blogTitle };
  },
}
</script>

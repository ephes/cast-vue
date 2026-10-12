<template>
  <div>
    <p v-if="isLoading">Loading data...</p>
    <div v-else>
      <div v-if="error" role="alert">
        <p>{{ error }}</p><button @click="fetchPostFromAPI(true)">Retry</button>
      </div>
      <p v-if="!post && !error">Post not found.</p>
      <router-link to="/">Back to Blog</router-link>
      <post-item v-if="post" :post="post" :detail="true" @comment-posted="handleCommentPosted"></post-item>
    </div>
  </div>
</template>

<script lang="ts">
import config from '../config';
import { useRoute } from 'vue-router';
import PostItem from './PostItem.vue';
import { useDataStore } from '../stores/dataStore';
import { Post, PostsFromApi } from './types';
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { contentReadyToken, notifyContentReady } from '../helpers/viewTransitions';

export default {
  name: "PostDetail",
  components: {
    PostItem,
  },
  methods: {
    async handleCommentPosted() {
      console.log("handleCommentPosted in PostDetail");
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
    onBeforeUnmount(() => { requestId += 1; });
    let currentSlug: string | undefined;
    const fetchPostFromAPI = async (invalidateCache: boolean = false) => {
      const id = ++requestId;
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
      let pageType = config.pageType;
      if (postSlug in dataStore.slugToPost) {
        // FIXME we could also just use the post detail url?
        pageType = dataStore.slugToPost[postSlug].meta.type;
      }
      postDetailUrl.searchParams.set("type", pageType);
      postDetailUrl.searchParams.set("slug", postSlug);
      postDetailUrl.searchParams.set("fields", "html_detail,comments,comments_security_data,comments_are_enabled,podlove_players");
      postDetailUrl.searchParams.set("render_for_feed", "false");

      try {
        const posts = await dataStore.fetchJson(postDetailUrl, invalidateCache) as unknown as PostsFromApi;
        if (id !== requestId) return;
        if (!Array.isArray(posts.items)) throw new Error('Invalid detail response');
        const item = posts.items[0];
        if (item && (typeof item.id !== 'number' || typeof item.title !== 'string' || !item.meta)) {
          throw new Error('Invalid post');
        }
        post.value = item || null;
      } catch (cause) {
        if (id === requestId) {
          console.error('Could not load post:', cause);
          error.value = 'Could not load post. Please retry.';
        }
      } finally {
        if (id === requestId) {
          isLoading.value = false;
          await nextTick();
          if (id === requestId) notifyContentReady(readyToken);
        }
      }
    }

    watch(() => route.params.slug, () => { void fetchPostFromAPI(); }, { immediate: true });
    return { dataStore, isLoading, error, post, visibleDate: visibleDateStr, fetchPostFromAPI };
  },
}
</script>

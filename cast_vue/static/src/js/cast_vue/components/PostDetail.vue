<template>
  <div>
    <p v-if="isLoading">Loading data...</p>
    <div v-else>
      <post-item :post="posts.items[0]"></post-item>
    </div>
  </div>
</template>

  <script lang="ts">
  import { useRoute } from 'vue-router';
  import PostItem from './PostItem.vue';
  import { useDataStore } from '../stores/dataStore';
  import { Post, PostsFromApi } from './types';
  import { ref, onMounted } from 'vue';
  import { getWagtailApiBaseUrl } from './domHelpers';

  export default {
    name: "PostDetail",
    components: {
      PostItem,
    },
    setup() {
        const route = useRoute();
        const dataStore = useDataStore();
        const wagtailApiUrl = getWagtailApiBaseUrl();

        const isLoading = ref(true);
        const posts = ref({} as PostsFromApi);

        const fetchPostFromAPI = async () => {
          const postSlug = route.params.slug as string;
          const postDetailUrl = new URL(wagtailApiUrl.href);
          postDetailUrl.searchParams.set("type", "cast.Post");
          postDetailUrl.searchParams.set("slug", postSlug);
          postDetailUrl.searchParams.set("fields", "html_overview,html_detail");

          try {
            posts.value = await dataStore.fetchJson(postDetailUrl);
          } catch(error) {
            console.error('Error fetching data from API: ', error);
          } finally {
                isLoading.value = false;
          }
        }

        onMounted(fetchPostFromAPI);
        return { dataStore, isLoading, posts };
    },
  }
  </script>

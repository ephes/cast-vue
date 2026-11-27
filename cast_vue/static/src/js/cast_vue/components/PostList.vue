<template>
  <ol v-if="posts.items && posts.items.length > 0" class="cv-post-list">
    <li v-for="post in posts.items" :key="post.id">
      <post-item :post="post" :detail="false"></post-item>
    </li>
  </ol>
</template>

<script lang="ts">
import { useDataStore } from '../stores/dataStore';
import PostItem from './PostItem.vue';
import { PostsFromApi } from './types';

export default {
  name: "PostList",
  components: {
    PostItem,
  },
  props: {
    posts: {
      type: Object as () => PostsFromApi,
      default: () => ({}),
    },
    blog: {
      type: Object,
      default: () => ({}),
    }
  },
  setup() {
    const dataStore = useDataStore();
    return {
      dataStore,
    };
  }
}
</script>

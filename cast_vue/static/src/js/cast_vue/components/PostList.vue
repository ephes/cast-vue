<template>
  <div>
    <h1>{{ blog.title }}</h1>
    <div v-html="descriptionHtml"></div>
    <div v-for="post in posts.items" :key="post.id">
      <post-item :post="post" :detail="false"></post-item>
    </div>
  </div>
</template>

<script lang="ts">
import { useDataStore } from '../stores/dataStore';
import PostItem from './PostItem.vue';
import { PostsFromApi } from './types';
import { sanitizeRichText } from '../helpers/sanitizeRichText';

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
  computed: {
    descriptionHtml(): string {
      return sanitizeRichText(this.blog.description);
    },
  },
  setup() {
    const dataStore = useDataStore();
    return {
      dataStore,
    };
  }
}
</script>

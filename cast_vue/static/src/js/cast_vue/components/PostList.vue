<template>
  <div>
    <h1>{{ blog.title }}</h1>
    <p>Description is still missing 😁.</p>
    <div v-for="post in posts.items" :key="post.id">
      <h2>{{ post.title }}</h2>
      <router-link :to="{ name: 'PostDetail', params: {slug: post.meta.slug}}">
        {{ post.visible_date }}
      </router-link>
      <post-item :post="post"></post-item>
    </div>
  </div>
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
    },
    apiBaseUrl: {
      type: URL,
      required: true,
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

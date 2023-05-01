<template>
  <div>
    <h1>{{ blog.title }}</h1>
    <div v-for="post in posts.items" :key="post.id">
      <post-item :post="post"></post-item>
    </div>
  </div>
</template>

<script lang="ts">
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
  }
}
</script>

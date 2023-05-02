<template>
    <div class="post-item">
      <h2>{{ post.title }}</h2>
      <div v-html="post.html_overview"></div>
    </div>
  </template>

  <script lang="ts">
  import { Post } from './types';

  export default {
    name: "PostItem",
    props: {
      post: {
        type: Object as () => Post,
        required: true,
      },
    },
  };
  </script>

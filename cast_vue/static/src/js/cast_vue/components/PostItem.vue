<template>
    <div class="post-item">
      <h2>{{ post.title }}</h2>
      <p>{{ post.meta }}</p>
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

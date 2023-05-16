<template>
    <div class="post-item">
      <h2>{{ post.title }}</h2>
      <div v-if="detail">
        <p>{{ visibleDate }}</p>
      </div>
      <div v-else>
        visible date detail
        <p>
          <router-link :to="{ name: 'PostDetail', params: {slug: post.meta.slug}}">
            {{ visibleDate }}
          </router-link>
        </p>
      </div>
      <div v-html="post.html_overview"></div>
    </div>
  </template>

  <script lang="ts">
  import { getTexContentFromElement } from './domHelpers';
  import { Post } from './types';


  export default {
    name: "PostItem",
    props: {
      post: {
        type: Object as () => Post,
        required: true,
      },
      detail: {
        type: Boolean,
        default: false,
      },
    },
    computed: {
      visibleDate(): string {
        const visibleDateStr = getTexContentFromElement("vue-article-date", this.post.html_detail);
        console.log("visibleDateStr: ", visibleDateStr);
        return visibleDateStr;
      },
    },
  };
  </script>

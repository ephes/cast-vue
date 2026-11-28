<template>
  <nav v-if="links.length" class="cv-follow" aria-label="Follow">
    <span class="cv-follow__label">Follow</span>
    <ul class="cv-follow__links" role="list">
      <li v-for="link in links" :key="link.url">
        <a :href="link.url" :rel="link.rel">{{ link.label }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
// Where to follow the show (Mastodon, LinkedIn, ...): a quiet line below the podcast apps.
import config from '../config';

const links = config?.subscribe?.followLinks ?? [];
</script>

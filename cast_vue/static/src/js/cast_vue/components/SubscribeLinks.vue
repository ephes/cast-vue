<template>
  <div v-if="subscribe && (!episode || subscribe.isPodcast)" class="cv-subscribe" :class="{ 'cv-subscribe--episode': episode }">
    <template v-if="subscribe.isPodcast">
      <p v-if="episode" class="cv-subscribe__label">Subscribe to {{ blogTitle || 'the podcast' }}</p>
      <p v-else class="cv-subscribe__label">Listen for free in your favourite podcast app</p>
      <div class="cv-subscribe__links">
        <a v-for="link in platformLinks" :key="link.label" class="cv-button cv-button--small" :href="link.url">
          <cv-icon :name="link.icon" /> {{ link.label }}
        </a>
        <a class="cv-button cv-button--small cv-subscribe__more" :href="subscribe.feedPageUrl">
          <cv-icon name="rss" />
          <template v-if="platformLinks.length > 3">
            <span class="cv-subscribe__rss">RSS</span>
            <span class="cv-subscribe__all">More options</span>
          </template>
          <template v-else>RSS</template>
        </a>
      </div>
    </template>
    <a v-else class="cv-button cv-button--small" :href="subscribe.feedPageUrl">
      <cv-icon name="rss" /> RSS feed
    </a>
  </div>
</template>

<script setup lang="ts">
import config from '../config';
import CvIcon from './CvIcon.vue';

defineProps<{ episode?: boolean; blogTitle?: string }>();

const subscribe = config?.subscribe;
const platformLinks = subscribe?.platformLinks.filter(link => link.id !== 'castro') ?? [];
</script>

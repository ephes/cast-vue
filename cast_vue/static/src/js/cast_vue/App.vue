<template>
  <div class="cv-app">
    <a class="cv-skip" href="#cv-main" @click.prevent="focusMain">Skip to content</a>
    <header class="cv-header">
      <div class="cv-container cv-header__inner">
        <router-link class="cv-brand" to="/">
          <span class="cv-brand__mark" aria-hidden="true"></span>
          <span class="cv-brand__name">{{ blogTitle || 'Home' }}</span>
        </router-link>
        <color-scheme-button />
      </div>
    </header>
    <main id="cv-main" ref="main" class="cv-main" tabindex="-1">
      <div class="cv-container">
        <router-view></router-view>
      </div>
    </main>
    <footer class="cv-footer">
      <div class="cv-container cv-footer__inner">
        <span v-if="blogTitle" class="cv-footer__title">{{ blogTitle }}</span>
        <select-theme v-if="showThemeSelect"></select-theme>
      </div>
    </footer>
    <player-bar></player-bar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import config from './config';
import ColorSchemeButton from './components/ColorSchemeButton.vue';
import PlayerBar from './components/PlayerBar.vue';
import SelectTheme from './components/SelectTheme.vue';
import { useDataStore } from './stores/dataStore';
import { blogTitle, setBlogTitle } from './helpers/site';

const router = useRouter();
const main = ref<HTMLElement | null>(null);
const showThemeSelect = config.pageType !== 'styleguide';

function getQueryParameters() {
  const searchParams = new URLSearchParams(window.location.search);
  const params: Record<string, any> = {};
  searchParams.forEach((value, key) => {
    if (params.hasOwnProperty(key)) {
      if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  });
  return params;
}

if (config.vueRouteName == "PostDetail") {
  router.push({ name: config.vueRouteName, params: { slug: config.postSlug } })
} else {
  // get query params from URL and push them to router
  const params: Record<string, any> = getQueryParameters();
  router.push({ name: config.vueRouteName, query: params });
}

function focusMain() {
  main.value?.focus();
  main.value?.scrollIntoView();
}

// The post list reports the blog itself; other pages ask for it here.
onMounted(async () => {
  if (config.vueRouteName === 'PostList') return;
  try {
    const blog = await useDataStore().fetchJson(config.blogDetailUrl);
    setBlogTitle(blog.title);
  } catch {
    // The header simply stays without the blog title.
  }
});
</script>

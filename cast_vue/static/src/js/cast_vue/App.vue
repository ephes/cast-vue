<template>
  <header>
    <h1>Cast Vue Theme!</h1>
    The header...<br />
  </header>
  <nav>
    <router-link to="/">Blog</router-link> |
    <router-link to="/counter">Counter</router-link> |
    The navigation
  </nav>
  <main>
    <router-view></router-view>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { getTexContentFromElement } from './components/domHelpers';

const router = useRouter();
const vueRouteName = getTexContentFromElement("vue-route-name");
console.log('vueRouteName: ', vueRouteName);

if (vueRouteName == "PostDetail") {
  const slug = getTexContentFromElement("slug");
  router.push({name: vueRouteName, params: {slug: slug}})
} else {
  router.push({name: vueRouteName})
}
</script>

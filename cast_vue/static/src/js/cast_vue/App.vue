<template>
  <div>
    <router-view></router-view>
  </div>
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

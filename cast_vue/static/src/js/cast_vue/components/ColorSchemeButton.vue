<template>
  <button
    type="button"
    class="cv-icon-button"
    :aria-label="`Colour scheme: ${colorScheme}. Switch to ${nextScheme}.`"
    :title="`Colour scheme: ${colorScheme}`"
    @click="setColorScheme(nextScheme)"
  >
    <cv-icon :name="icons[colorScheme]" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CvIcon from './CvIcon.vue';
import { colorScheme, nextColorScheme, setColorScheme } from '../helpers/colorScheme';

const icons = { system: 'system', light: 'sun', dark: 'moon' } as const;
const nextScheme = computed(() => nextColorScheme(colorScheme.value));
</script>

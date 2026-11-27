<template>
  <svg
    class="cv-icon"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="d in paths" :key="d" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Small inline icon set (24px grid, stroke icons unless listed as filled).
const ICONS: Record<string, string[]> = {
  play: ['M8 5.5v13a.5.5 0 0 0 .77.42l10-6.5a.5.5 0 0 0 0-.84l-10-6.5A.5.5 0 0 0 8 5.5z'],
  pause: ['M7 5h3.5v14H7z', 'M13.5 5H17v14h-3.5z'],
  back: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  forward: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  volume: ['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  muted: ['M11 5 6 9H3v6h3l5 4z', 'm16 9 5 6', 'm21 9-5 6'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'm20 20-3.5-3.5'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  arrowLeft: ['M19 12H5', 'm11 6-6 6 6 6'],
  arrowRight: ['M5 12h14', 'm13 6 6 6-6 6'],
  down: ['m6 9 6 6 6-6'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  transcript: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7', 'M9 17h5'],
  download: ['M12 4v11', 'm7 11 5 5 5-5', 'M5 20h14'],
  keyboard: ['M3 7h18v10H3z', 'M7 11h.01', 'M11 11h.01', 'M15 11h.01', 'M8 14h8'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M2 12h2', 'M20 12h2', 'm4.9 19.1 1.4-1.4', 'm17.7 6.3 1.4-1.4'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z'],
  system: ['M3 5h18v11H3z', 'M8 20h8', 'M12 16v4'],
  reply: ['M9 14 4 9l5-5', 'M4 9h9a7 7 0 0 1 7 7v3'],
};
const FILLED = new Set(['play', 'pause']);

const props = defineProps<{ name: string }>();
const paths = computed(() => ICONS[props.name] ?? []);
const filled = computed(() => FILLED.has(props.name));
</script>

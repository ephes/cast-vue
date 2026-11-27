<template>
  <transition name="cv-bar">
    <aside v-if="visible" ref="bar" class="cv-player-bar" aria-label="Now playing">
      <div class="cv-player-bar__seek" :style="{ '--cv-progress': progress + '%' }">
        <input
          type="range"
          min="0"
          :max="Math.max(1, Math.floor(player.duration))"
          step="1"
          :value="Math.floor(shownTime)"
          :disabled="player.duration <= 0"
          aria-label="Seek"
          :aria-valuetext="`${spoken(shownTime)} of ${spoken(player.duration)}`"
          @input="scrubTime = Number(($event.target as HTMLInputElement).value)"
          @change="commit"
        />
      </div>
      <div class="cv-container cv-player-bar__inner">
        <img v-if="player.meta?.poster" class="cv-player-bar__cover" :src="player.meta.poster" alt="" width="44" height="44" />
        <div class="cv-player-bar__info">
          <component
            :is="titleLink ? 'router-link' : 'span'"
            class="cv-player-bar__title"
            v-bind="titleLink ? { to: titleLink } : {}"
          >{{ title }}</component>
          <span v-if="player.status === 'error'" class="cv-player-bar__meta cv-player-bar__meta--error" role="alert">{{ player.error }}</span>
          <span v-else class="cv-player-bar__meta">{{ format(shownTime) }}<template v-if="player.duration > 0"> / {{ format(player.duration) }}</template><template v-if="chapter"> · {{ chapter }}</template></span>
        </div>
        <div class="cv-player-bar__controls">
          <button type="button" class="cv-icon-button cv-player__skip" aria-label="Back 15 seconds" @click="skip(-15)">
            <cv-icon name="back" /><span aria-hidden="true">15</span>
          </button>
          <button type="button" class="cv-player__play" :aria-label="player.playing ? 'Pause' : 'Play'" @click="onToggle">
            <span v-if="busy" class="cv-spinner"></span>
            <cv-icon v-else :name="player.playing ? 'pause' : 'play'" />
          </button>
          <button type="button" class="cv-icon-button cv-player__skip cv-player-bar__wide" aria-label="Forward 30 seconds" @click="skip(30)">
            <cv-icon name="forward" /><span aria-hidden="true">30</span>
          </button>
          <label class="cv-player__rate cv-player-bar__wide">
            <span class="cv-sr-only">Playback speed</span>
            <select :value="player.rate" @change="setRate(Number(($event.target as HTMLSelectElement).value))">
              <option v-for="rate in rates" :key="rate" :value="rate">{{ rate }}×</option>
            </select>
          </label>
          <button type="button" class="cv-icon-button" aria-label="Close player" @click="closePlayer">
            <cv-icon name="close" />
          </button>
        </div>
      </div>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CvIcon from './CvIcon.vue';
import { RATES, closePlayer, player, resume, pause, seek, setRate, skip } from '../player/engine';
import { formatTime, spokenTime } from '../helpers/time';

// The bar at the bottom of the window that keeps the loaded episode at hand
// while the reader browses. It hides while the episode's own full player is on
// screen.

const rates = RATES;
const format = formatTime;
const spoken = spokenTime;

const bar = ref<HTMLElement | null>(null);
const scrubTime = ref<number | null>(null);

const visible = computed(() => player.key !== '' && player.inlineVisible === 0);
const shownTime = computed(() => scrubTime.value ?? player.currentTime);
const progress = computed(() => (player.duration > 0 ? Math.min(100, (shownTime.value / player.duration) * 100) : 0));
const busy = computed(() => player.status === 'loading' || player.waiting);
const title = computed(() => player.meta?.title || player.ref?.title || 'Episode');
// The styleguide has no post route: the title stays plain text there.
const router = useRouter();
const titleLink = computed(() => (player.ref?.slug && router.hasRoute('PostDetail') ? { name: 'PostDetail', params: { slug: player.ref.slug } } : null));
const chapter = computed(() => {
  let found = '';
  for (const candidate of player.meta?.chapters ?? []) {
    if (candidate.start <= shownTime.value) found = candidate.title;
  }
  return found;
});

function commit(event: Event) {
  scrubTime.value = null;
  seek(Number((event.target as HTMLInputElement).value));
}

function onToggle() {
  if (player.status === 'loading') return;
  if (player.playing) pause();
  else void resume();
}

// Content must not hide behind the bar: publish its height as --cv-bar-h.
function publishHeight() {
  const height = visible.value && bar.value ? bar.value.offsetHeight : 0;
  document.documentElement.style.setProperty('--cv-bar-h', `${height}px`);
}

watch(visible, async () => {
  await nextTick();
  publishHeight();
}, { immediate: true });

if (typeof window !== 'undefined') window.addEventListener('resize', publishHeight);
onBeforeUnmount(() => {
  window.removeEventListener('resize', publishHeight);
  document.documentElement.style.removeProperty('--cv-bar-h');
});
</script>

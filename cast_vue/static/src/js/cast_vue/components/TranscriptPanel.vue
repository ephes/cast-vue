<template>
  <div class="cv-transcript">
    <div class="cv-transcript__toolbar">
      <label class="cv-search">
        <span class="cv-sr-only">Search the transcript</span>
        <cv-icon name="search" />
        <input
          v-model.trim="query"
          class="cv-input"
          type="search"
          placeholder="Search the transcript"
          autocomplete="off"
          @keydown.stop
        />
      </label>
      <p class="cv-transcript__count" role="status" aria-live="polite">
        <template v-if="query">{{ matchCount }} {{ matchCount === 1 ? 'match' : 'matches' }}</template>
      </p>
    </div>
    <p v-if="query && visibleRuns.length === 0" class="cv-transcript__empty">
      Nothing in the transcript matches “{{ query }}”.
    </p>
    <ol
      v-else
      ref="scroller"
      class="cv-transcript__runs"
      tabindex="0"
      aria-label="Transcript"
      @wheel.passive="userScrolled"
      @touchmove.passive="userScrolled"
      @keydown="userScrolled"
    >
      <li
        v-for="run in visibleRuns"
        :key="run.index"
        class="cv-transcript__run"
        :class="{ 'is-active': run.index === activeRun }"
        :data-run="run.index"
      >
        <div class="cv-transcript__head">
          <span v-if="run.speaker" class="cv-avatar" aria-hidden="true">{{ run.speaker.charAt(0) }}</span>
          <span v-if="run.speaker" class="cv-transcript__speaker">{{ run.speaker }}</span>
          <button
            type="button"
            class="cv-transcript__time"
            :aria-label="`Play from ${spoken(run.start)}${run.speaker ? ', ' + run.speaker : ''}`"
            @click="$emit('seek', run.start)"
          >{{ format(run.start) }}</button>
        </div>
        <p class="cv-transcript__text">
          <template v-for="cue in run.cues" :key="cue.index">
            <span
              class="cv-transcript__cue"
              :class="{ 'is-active': cue.index === activeCue }"
              @click="$emit('seek', cue.start)"
            ><template v-for="(part, i) in cue.parts" :key="i"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>{{ ' ' }}
          </template>
        </p>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import CvIcon from './CvIcon.vue';
import type { Cue } from '../player/episode';
import { formatTime, spokenTime } from '../helpers/time';

// Readable transcript: consecutive cues of one speaker form a paragraph with a
// single heading row. Clicking text (or the time button, for keyboards) plays
// from there. While the episode plays, the current paragraph is kept in view
// unless the reader scrolled the panel themselves a moment ago.

const props = defineProps<{ cues: Cue[]; currentTime: number; active: boolean }>();
defineEmits<{ (event: 'seek', time: number): void }>();

const MAX_RUN_CUES = 8; // paragraph length for transcripts without speaker changes
const FOLLOW_PAUSE_MS = 5000;

interface Part { text: string; hit: boolean }
interface RunCue { index: number; start: number; parts: Part[]; hit: boolean }
interface Run { index: number; speaker: string; start: number; cues: RunCue[] }

const query = ref('');
const scroller = ref<HTMLElement | null>(null);
let lastUserScroll = 0;

const format = formatTime;
const spoken = spokenTime;

function split(text: string, needle: string): Part[] {
  if (!needle) return [{ text, hit: false }];
  const parts: Part[] = [];
  const haystack = text.toLowerCase();
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), hit: false });
    parts.push({ text: text.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), hit: false });
  return parts;
}

const runs = computed<Run[]>(() => {
  const needle = query.value.toLowerCase();
  const result: Run[] = [];
  props.cues.forEach((cue, index) => {
    const last = result[result.length - 1];
    const parts = split(cue.text, needle);
    const entry = { index, start: cue.start, parts, hit: parts.some((part) => part.hit) };
    if (last && last.speaker === cue.speaker && last.cues.length < MAX_RUN_CUES) {
      last.cues.push(entry);
    } else {
      result.push({ index: result.length, speaker: cue.speaker, start: cue.start, cues: [entry] });
    }
  });
  return result;
});

const visibleRuns = computed(() => (query.value ? runs.value.filter((run) => run.cues.some((cue) => cue.hit)) : runs.value));
const matchCount = computed(() => runs.value.reduce((count, run) => count + run.cues.filter((cue) => cue.hit).length, 0));

// Index of the cue being spoken, -1 when this episode is not the loaded one.
const activeCue = computed(() => {
  if (!props.active) return -1;
  let low = 0;
  let high = props.cues.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (props.cues[middle].start <= props.currentTime) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
});

const activeRun = computed(() => {
  const cue = activeCue.value;
  if (cue < 0) return -1;
  const run = runs.value.find((candidate) => candidate.cues[0].index <= cue && cue <= candidate.cues[candidate.cues.length - 1].index);
  return run ? run.index : -1;
});

function userScrolled() {
  lastUserScroll = Date.now();
}

watch(activeRun, async (index) => {
  if (index < 0 || query.value || Date.now() - lastUserScroll < FOLLOW_PAUSE_MS) return;
  await nextTick();
  const container = scroller.value;
  const element = container?.querySelector<HTMLElement>(`[data-run="${index}"]`);
  if (!container || !element || typeof container.scrollTo !== 'function') return;
  const top = element.offsetTop - container.offsetTop - container.clientHeight / 4;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
});
</script>

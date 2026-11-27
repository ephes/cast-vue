<template>
  <!-- compact: one button per post in the list; playback controls live in the player bar -->
  <div v-if="variant === 'compact'" class="cv-player cv-player--compact" :class="{ 'is-current': current }">
    <button
      type="button"
      class="cv-player__compact-button"
      :aria-label="`${playing ? 'Pause' : 'Play'} ${title || 'episode'}`"
      @pointerenter="prefetch"
      @focus="prefetch"
      @click="onToggle"
    >
      <span class="cv-player__play" aria-hidden="true">
        <span v-if="busy" class="cv-spinner"></span>
        <cv-icon v-else :name="playing ? 'pause' : 'play'" />
      </span>
      <span class="cv-player__compact-label">{{ compactLabel }}</span>
    </button>
    <span v-if="progress > 0" class="cv-player__progress" aria-hidden="true">
      <span :style="{ width: progress + '%' }"></span>
    </span>
    <p v-if="error" class="cv-player__error" role="alert">{{ error }}</p>
  </div>

  <!-- full: transport, chapters and transcript on the post page -->
  <section
    v-else
    ref="root"
    class="cv-player cv-player--full"
    :class="{ 'is-current': current }"
    :aria-label="`Audio player${title ? ': ' + title : ''}`"
    @keydown="onKeydown"
  >
    <div class="cv-player__transport">
      <button
        type="button"
        class="cv-player__play"
        :aria-label="playing ? 'Pause' : 'Play'"
        :aria-keyshortcuts="'K'"
        @click="onToggle"
      >
        <span v-if="busy" class="cv-spinner"></span>
        <cv-icon v-else :name="playing ? 'pause' : 'play'" />
      </button>
      <div class="cv-player__skips">
        <button type="button" class="cv-icon-button cv-player__skip" aria-label="Back 15 seconds" @click="skipBy(-15)">
          <cv-icon name="back" /><span aria-hidden="true">15</span>
        </button>
        <button type="button" class="cv-icon-button cv-player__skip" aria-label="Forward 30 seconds" @click="skipBy(30)">
          <cv-icon name="forward" /><span aria-hidden="true">30</span>
        </button>
      </div>
      <div class="cv-player__timeline">
        <span class="cv-player__time">{{ format(shownTime) }}</span>
        <div class="cv-player__seek" :style="{ '--cv-progress': progress + '%' }">
          <input
            type="range"
            min="0"
            :max="Math.max(1, Math.floor(duration))"
            step="1"
            :value="Math.floor(shownTime)"
            :disabled="duration <= 0"
            aria-label="Seek"
            :aria-valuetext="`${spoken(shownTime)} of ${spoken(duration)}`"
            @input="onScrub"
            @change="onScrubCommit"
          />
          <span
            v-for="chapter in chapterTicks"
            :key="chapter.start"
            class="cv-player__tick"
            :style="{ left: (chapter.start / duration) * 100 + '%' }"
            aria-hidden="true"
          ></span>
        </div>
        <span class="cv-player__time cv-player__time--remaining">{{ duration > 0 ? '-' + format(duration - shownTime) : '–:––' }}</span>
      </div>
      <div class="cv-player__options">
        <label class="cv-player__rate">
          <span class="cv-sr-only">Playback speed</span>
          <select :value="player.rate" @change="onRate">
            <option v-for="rate in rates" :key="rate" :value="rate">{{ rate }}×</option>
          </select>
        </label>
        <button
          type="button"
          class="cv-icon-button"
          :aria-label="player.muted ? 'Unmute' : 'Mute'"
          :aria-pressed="player.muted"
          aria-keyshortcuts="M"
          @click="toggleMute"
        >
          <cv-icon :name="player.muted ? 'muted' : 'volume'" />
        </button>
      </div>
    </div>

    <p v-if="currentChapter" class="cv-player__chapter">
      <span class="cv-eyebrow">Chapter {{ currentChapter.number }}/{{ chapters.length }}</span>
      {{ currentChapter.title }}
    </p>

    <div class="cv-player__status" role="status" aria-live="polite">
      <span v-if="metaLoading && !meta" class="cv-sr-only">Loading player...</span>
    </div>
    <p v-if="error" class="cv-player__error" role="alert">
      {{ error }} <button type="button" class="cv-button cv-button--small" @click="retry">Retry</button>
    </p>

    <div v-if="meta" class="cv-player__tabs">
      <button
        v-if="chapters.length > 0"
        type="button"
        class="cv-player__tab"
        :aria-expanded="panel === 'chapters'"
        :aria-controls="ids.chapters"
        @click="togglePanel('chapters')"
      >
        <cv-icon name="list" /> Chapters <span class="cv-player__tab-count">{{ chapters.length }}</span>
      </button>
      <button
        v-if="meta.cues.length > 0"
        type="button"
        class="cv-player__tab"
        :aria-expanded="panel === 'transcript'"
        :aria-controls="ids.transcript"
        @click="togglePanel('transcript')"
      >
        <cv-icon name="transcript" /> Transcript
      </button>
      <a v-if="download" class="cv-player__tab" :href="download.url" download>
        <cv-icon name="download" /> Download<span v-if="download.label" class="cv-player__tab-count">{{ download.label }}</span>
      </a>
      <button
        type="button"
        class="cv-player__tab cv-player__tab--help"
        :aria-expanded="showShortcuts"
        :aria-controls="ids.shortcuts"
        aria-label="Keyboard shortcuts"
        @click="showShortcuts = !showShortcuts"
      >
        <cv-icon name="keyboard" />
      </button>
    </div>

    <div v-show="showShortcuts" :id="ids.shortcuts" class="cv-player__panel cv-player__shortcuts">
      <dl>
        <div><dt><kbd>K</kbd></dt><dd>Play or pause</dd></div>
        <div><dt><kbd>J</kbd> <kbd>L</kbd></dt><dd>Back 15 s, forward 30 s</dd></div>
        <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Back or forward 5 s</dd></div>
        <div><dt><kbd>M</kbd></dt><dd>Mute</dd></div>
      </dl>
      <p>Shortcuts work while the focus is inside the player.</p>
    </div>

    <div v-if="meta && chapters.length > 0" v-show="panel === 'chapters'" :id="ids.chapters" class="cv-player__panel">
      <ol class="cv-chapters">
        <li v-for="(chapter, index) in chapters" :key="chapter.start">
          <button
            type="button"
            class="cv-chapters__item"
            :class="{ 'is-active': currentChapter?.number === index + 1 }"
            :aria-current="currentChapter?.number === index + 1 ? 'true' : undefined"
            @click="jumpTo(chapter.start)"
          >
            <span class="cv-chapters__time">{{ format(chapter.start) }}</span>
            <span class="cv-chapters__title">{{ chapter.title }}</span>
          </button>
        </li>
      </ol>
    </div>

    <div v-if="meta && meta.cues.length > 0 && transcriptOpened" v-show="panel === 'transcript'" :id="ids.transcript" class="cv-player__panel">
      <transcript-panel :cues="meta.cues" :current-time="shownTime" :active="current" @seek="jumpTo" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import CvIcon from './CvIcon.vue';
import TranscriptPanel from './TranscriptPanel.vue';
import { absoluteApiUrl, loadEpisode, type EpisodeMeta } from '../player/episode';
import { RATES, player, playEpisode, resume, savedPosition, seek, setRate, skip, toggle, toggleMute } from '../player/engine';
import { formatDuration, formatTime, spokenTime } from '../helpers/time';

// The theme's own lightweight audio player. It reads the episode from the
// Podlove-format audio endpoint delivered in a post's `podlove_players` and
// plays through the app-wide audio engine (player/engine.ts).

defineOptions({ name: 'AudioPlayer' });

const props = withDefaults(defineProps<{
  apiUrl: string;
  elementId?: string;
  // Accepted for compatibility with the former Podlove wrapper; not used.
  playerConfig?: URL | string;
  variant?: 'full' | 'compact';
  title?: string;
  slug?: string;
}>(), { variant: 'full', elementId: '', title: '', slug: '', playerConfig: undefined });

const rates = RATES;
const format = formatTime;
const spoken = spokenTime;

const root = ref<HTMLElement | null>(null);
const uid = useId();
const ids = { chapters: `${uid}-chapters`, transcript: `${uid}-transcript`, shortcuts: `${uid}-shortcuts` };

const key = computed(() => absoluteApiUrl(props.apiUrl));
const current = computed(() => player.key !== '' && player.key === key.value);
const episodeRef = computed(() => ({ apiUrl: props.apiUrl, title: props.title, slug: props.slug }));

// Episode data of this player, loaded on its own so chapters, transcript and
// duration show before (and without) playing.
const ownMeta = shallowRef<EpisodeMeta | null>(null);
const metaLoading = ref(false);
const metaError = ref('');
let loadId = 0;

async function loadMeta(refresh = false) {
  const id = ++loadId;
  metaLoading.value = true;
  metaError.value = '';
  try {
    const loaded = await loadEpisode(props.apiUrl, refresh);
    if (id === loadId) ownMeta.value = loaded;
  } catch {
    if (id === loadId) metaError.value = 'Could not load the player. Please retry.';
  } finally {
    if (id === loadId) metaLoading.value = false;
  }
}

function prefetch() {
  if (!ownMeta.value && !metaLoading.value && !current.value) void loadMeta();
}

const meta = computed(() => (current.value && player.meta ? player.meta : ownMeta.value));
const playing = computed(() => current.value && player.playing);
const busy = computed(() => (current.value && (player.status === 'loading' || player.waiting)) || (metaLoading.value && props.variant === 'compact' && wantsPlay.value));
const wantsPlay = ref(false);
const error = computed(() => (current.value && player.status === 'error' ? player.error : metaError.value));
const duration = computed(() => (current.value && player.duration > 0 ? player.duration : meta.value?.duration ?? 0));

// Position shown while this episode is not the loaded one: where it stopped
// last time, or where the reader dragged the seek bar.
const restingTime = ref(0);
const restingMoved = ref(false);
const scrubTime = ref<number | null>(null);
const shownTime = computed(() => scrubTime.value ?? (current.value ? player.currentTime : restingTime.value));
const progress = computed(() => (duration.value > 0 ? Math.min(100, (shownTime.value / duration.value) * 100) : 0));

function readRestingTime() {
  restingTime.value = savedPosition(props.apiUrl);
  restingMoved.value = false;
}

const chapters = computed(() => meta.value?.chapters ?? []);
const chapterTicks = computed(() => (duration.value > 0 ? chapters.value.filter((chapter) => chapter.start > 0 && chapter.start < duration.value) : []));
const currentChapter = computed(() => {
  let found = -1;
  chapters.value.forEach((chapter, index) => {
    if (chapter.start <= shownTime.value) found = index;
  });
  return found >= 0 ? { number: found + 1, title: chapters.value[found].title } : null;
});

const download = computed(() => {
  const sources = meta.value?.sources ?? [];
  const source = sources.find((candidate) => candidate.mimeType === 'audio/mpeg') ?? sources[0];
  if (!source) return null;
  return { url: source.url, label: source.size > 0 ? `${(source.size / 1048576).toFixed(source.size < 10485760 ? 1 : 0)} MB` : '' };
});

const compactLabel = computed(() => {
  if (current.value && player.status === 'loading') return 'Loading…';
  if (current.value && player.status === 'ready') {
    const position = `${format(shownTime.value)}${duration.value > 0 ? ' / ' + format(duration.value) : ''}`;
    return `${playing.value ? 'Playing' : 'Paused'} · ${position}`;
  }
  if (restingTime.value > 0) return `Resume at ${format(restingTime.value)}`;
  const length = formatDuration(duration.value);
  return length ? `Play episode · ${length}` : 'Play episode';
});

const panel = ref<'chapters' | 'transcript' | null>(null);
const transcriptOpened = ref(false);
const showShortcuts = ref(false);

function togglePanel(name: 'chapters' | 'transcript') {
  panel.value = panel.value === name ? null : name;
  if (name === 'transcript') transcriptOpened.value = true;
}

function onToggle() {
  if (!current.value) {
    wantsPlay.value = true;
    void playEpisode(episodeRef.value, restingMoved.value ? restingTime.value : undefined).finally(() => { wantsPlay.value = false; });
    return;
  }
  toggle(episodeRef.value);
}

// Chapters and transcript lines: go there and play.
function jumpTo(time: number) {
  void playEpisode(episodeRef.value, time);
}

function skipBy(delta: number) {
  if (current.value) {
    skip(delta);
  } else if (duration.value > 0) {
    restingTime.value = Math.min(Math.max(0, restingTime.value + delta), duration.value);
    restingMoved.value = true;
  }
}

function onScrub(event: Event) {
  scrubTime.value = Number((event.target as HTMLInputElement).value);
}

function onScrubCommit(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  scrubTime.value = null;
  if (current.value) {
    seek(value);
  } else {
    restingTime.value = value;
    restingMoved.value = true;
  }
}

function onRate(event: Event) {
  setRate(Number((event.target as HTMLSelectElement).value));
}

function retry() {
  if (current.value && player.status === 'error') void resume();
  else void loadMeta(true);
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement;
  const tag = target.tagName;
  const isRange = tag === 'INPUT' && (target as HTMLInputElement).type === 'range';
  if ((tag === 'INPUT' && !isRange) || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable) return;
  const keyName = event.key.toLowerCase();
  if (keyName === 'k') onToggle();
  else if (keyName === 'j') skipBy(-15);
  else if (keyName === 'l') skipBy(30);
  else if (keyName === 'm') toggleMute();
  else if (keyName === 'arrowleft' && !isRange) skipBy(-5);
  else if (keyName === 'arrowright' && !isRange) skipBy(5);
  else return;
  event.preventDefault();
}

// The player bar hides while a full player of the loaded episode is on screen.
const onScreen = ref(false);
const countedVisible = ref(false);
let observer: IntersectionObserver | undefined;

watch(() => current.value && onScreen.value && props.variant === 'full', (visible) => {
  if (visible === countedVisible.value) return;
  countedVisible.value = visible;
  player.inlineVisible = Math.max(0, player.inlineVisible + (visible ? 1 : -1));
});

watch(current, (isNowCurrent) => {
  if (!isNowCurrent) readRestingTime();
});

watch(() => props.apiUrl, () => {
  loadId += 1;
  ownMeta.value = null;
  metaError.value = '';
  metaLoading.value = false;
  panel.value = null;
  transcriptOpened.value = false;
  readRestingTime();
  if (props.variant === 'full') void loadMeta();
});

onMounted(() => {
  readRestingTime();
  if (props.variant !== 'full') return;
  void loadMeta();
  if (root.value && typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver((entries) => {
      onScreen.value = entries.some((entry) => entry.isIntersecting);
    });
    observer.observe(root.value);
  } else {
    onScreen.value = true;
  }
});

onBeforeUnmount(() => {
  loadId += 1;
  observer?.disconnect();
  if (countedVisible.value) {
    countedVisible.value = false;
    player.inlineVisible = Math.max(0, player.inlineVisible - 1);
  }
});
</script>

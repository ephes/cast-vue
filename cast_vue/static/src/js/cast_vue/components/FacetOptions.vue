<template>
  <fieldset v-if="facets.length || selected">
    <legend class="cv-label">{{ label }}</legend>
    <ul class="cv-chips" role="list">
      <li v-for="facet in chips" :key="facet.slug">
        <button type="button" class="cv-chip" :aria-pressed="selected === facet.slug" @click="choose(facet.slug)">
          {{ facet.name }}
          <span v-if="facet.count !== null" class="cv-chip__count">{{ facet.count }}</span>
          <span v-if="selected === facet.slug" aria-hidden="true">×</span>
        </button>
      </li>
    </ul>
    <template v-if="showFinder">
      <label class="cv-facet-finder">
        <span class="cv-sr-only">{{ findLabel }}</span>
        <input ref="finder" v-model="query" type="search" class="cv-input" :placeholder="findLabel" autocomplete="off" />
      </label>
      <div v-if="query.trim()" class="cv-facet-results">
        <p :class="matches.length ? 'cv-sr-only' : 'cv-facet-empty'" role="status">
          {{ matches.length ? `${matches.length} matching ${label.toLowerCase()} shown.` : `No matching ${label.toLowerCase()}.` }}
        </p>
        <ul v-if="matches.length" class="cv-facet-list cv-facet-list--scroll" :aria-label="`Matching ${label.toLowerCase()}`" role="list">
          <li v-for="facet in matches" :key="facet.slug">
            <button type="button" class="cv-facet-option" :aria-pressed="selected === facet.slug" @click="choose(facet.slug)">
              {{ facet.name }} <span class="cv-chip__count">{{ facet.count }}</span>
            </button>
          </li>
        </ul>
      </div>
      <details v-if="facets.length" class="cv-filter-disclosure" @keydown.esc="closeFullList">
        <summary>{{ allLabel }}</summary>
        <ul class="cv-facet-list cv-facet-list--columns cv-facet-list--scroll" :aria-label="allLabel" role="list">
          <li v-for="facet in alphabetical" :key="facet.slug">
            <button type="button" class="cv-facet-option" :aria-pressed="selected === facet.slug" @click="choose(facet.slug)">
              {{ facet.name }} <span class="cv-chip__count">{{ facet.count }}</span>
            </button>
          </li>
        </ul>
      </details>
    </template>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { Facet } from './types';
import { alphabeticalFacets, TOP_FACETS, searchFacets, topFacets } from '../helpers/filters';

const props = defineProps<{
  label: string;
  findLabel: string;
  facets: Facet[];
  selected: string;
  alwaysShowFinder?: boolean;
}>();
const emit = defineEmits<{ select: [slug: string] }>();
const query = ref('');
const finder = ref<HTMLInputElement>();
const alphabetical = computed(() => alphabeticalFacets(props.facets));
const popular = computed(() => topFacets(props.facets));
const matches = computed(() => searchFacets(props.facets, query.value));
const showFinder = computed(() => props.facets.length > 0 && (props.alwaysShowFinder || props.facets.length > TOP_FACETS));
const allLabel = computed(() => `All ${props.facets.length} ${props.label.toLowerCase()}`);
const chips = computed(() => {
  const selected = props.selected;
  if (!selected || popular.value.some((facet) => facet.slug === selected)) return popular.value;
  const extra = props.facets.find((facet) => facet.slug === selected);
  return [{ slug: selected, name: extra?.name ?? selected, count: extra?.count ?? null }, ...popular.value];
});

function closeFullList(event: KeyboardEvent) {
  const details = event.currentTarget as HTMLDetailsElement;
  details.open = false;
  details.querySelector('summary')?.focus();
}

async function choose(slug: string) {
  const deselect = props.selected === slug;
  const focusedChip = document.activeElement?.classList.contains('cv-chip');
  emit('select', deselect ? '' : slug);
  if (deselect && focusedChip && !popular.value.some((facet) => facet.slug === slug)) {
    await nextTick();
    finder.value?.focus();
  }
}
</script>

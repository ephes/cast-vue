<template>
  <div class="cv-filters">
    <div class="cv-filters__top">
      <form class="cv-search" role="search" @submit.prevent="apply({ search })">
        <label for="id_search" class="cv-sr-only">Search posts</label>
        <input
          v-model="search"
          id="id_search"
          class="cv-input"
          type="search"
          placeholder="Search posts"
          enterkeyhint="search"
          autocomplete="off"
        />
        <button type="submit" class="cv-icon-button" aria-label="Search posts" title="Search posts">
          <cv-icon name="search" />
        </button>
      </form>
      <button
        type="button"
        class="cv-button cv-filters__toggle"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="open = !open"
      >
        <cv-icon name="filter" /> Filters
        <span v-if="activeCount" class="cv-count" :aria-label="`${activeCount} active`">{{ activeCount }}</span>
      </button>
    </div>

    <div :id="panelId" class="cv-filters__panel" :hidden="!open">
      <label class="cv-field">
        <span class="cv-label">Sort by</span>
        <span class="cv-select-wrap">
          <select :value="order" name="order" id="id_o" class="cv-select" @change="changeOrder">
            <option value="">Newest first</option>
            <option value="visible_date">Oldest first</option>
            <option v-if="order && order !== 'visible_date'" :value="order">{{ orderLabel(order) }}</option>
          </select>
          <cv-icon name="down" />
        </span>
      </label>
      <facet-options
        label="Categories"
        find-label="Find a category"
        :facets="facetCounts.category_facets ?? []"
        :selected="form.category_facets || ''"
        @select="apply({ category_facets: $event })"
      />
      <facet-options
        label="Tags"
        find-label="Find a tag"
        :facets="facetCounts.tag_facets ?? []"
        :selected="form.tag_facets || ''"
        always-show-finder
        @select="apply({ tag_facets: $event })"
      />
      <fieldset v-if="years.length || dateRangeEnabled">
        <legend class="cv-label">Archive</legend>
        <ul v-if="years.length" ref="yearList" class="cv-facet-list cv-archive__years" role="list">
          <li v-for="entry in years" :key="entry.year">
            <button
              type="button"
              class="cv-facet-option"
              :class="{ 'is-expanded': activeYear === entry.year }"
              :aria-expanded="activeYear === entry.year"
              :aria-controls="activeYear === entry.year ? monthsId : undefined"
              :aria-pressed="dateRangeEnabled ? selectedYear === entry.year : undefined"
              @click="chooseYear(entry.year)"
            >
              {{ entry.year }} <span class="cv-chip__count">{{ entry.count }}</span>
            </button>
          </li>
        </ul>
        <div v-if="activeMonths?.length" :id="monthsId" class="cv-archive__months">
          <p class="cv-label">Months in {{ activeYear }}</p>
          <ul class="cv-facet-list" :aria-label="`Months in ${activeYear}`" role="list">
            <li v-for="month in activeMonths" :key="month.slug">
              <button
                type="button"
                class="cv-facet-option"
                :aria-pressed="form.date_facets === month.slug"
                @click="chooseMonth(month.slug)"
              >
                {{ monthLabel(month.slug, locale, false) }} <span class="cv-chip__count">{{ month.count }}</span>
              </button>
            </li>
          </ul>
        </div>
        <details v-if="dateRangeEnabled" class="cv-filter-disclosure" :open="hasCustomRange">
          <summary>Custom range</summary>
          <form class="cv-filters__dates" @submit.prevent="apply(rangeFilter(from, until))">
            <label class="cv-field">
              <span>From</span>
              <input id="id_date_0" v-model="from" type="date" :max="until || undefined" class="cv-input" />
            </label>
            <label class="cv-field">
              <span>Until</span>
              <input id="id_date_1" v-model="until" type="date" :min="from || undefined" class="cv-input" />
            </label>
            <button type="submit" class="cv-button cv-button--small">Apply range</button>
          </form>
        </details>
      </fieldset>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import CvIcon from './CvIcon.vue';
import FacetOptions from './FacetOptions.vue';
import type { Form, FacetCounts } from './types';
import {
  archiveYears, emptyDateFilters, expandedYear, filterChips, monthFilter, monthLabel, orderLabel,
  rangeFilter, rangeYear, yearFilter,
} from '../helpers/filters';

const props = defineProps<{ form: Form; facetCounts: FacetCounts; dateRangeEnabled: boolean }>();
const emit = defineEmits<{ submitFilterForm: [form: Form] }>();
const open = ref(false);
const panelId = useId();
const monthsId = useId();
const yearList = ref<HTMLElement>();
const locale = document.documentElement.lang || undefined;

const activeCount = computed(() => filterChips(props.form, props.facetCounts, locale).length);
const years = computed(() => archiveYears(props.facetCounts.date_facets ?? []));
const browsedYear = ref<string>();
const activeYear = computed(() => props.dateRangeEnabled
  ? expandedYear(props.form)
  : browsedYear.value ?? expandedYear(monthFilter(props.form.date_facets)));
const selectedYear = computed(() => props.form.date_facets ? '' : rangeYear(props.form));
const activeMonths = computed(() => years.value.find((entry) => entry.year === activeYear.value)?.months);
const hasCustomRange = computed(() => props.dateRangeEnabled && !rangeYear(props.form) && Boolean(props.form.date_after || props.form.date_before));
const order = computed(() => props.form.order === '-visible_date' ? '' : props.form.order || '');

const search = ref('');
const from = ref('');
const until = ref('');
watch(() => props.form.search, (value) => { search.value = value; }, { immediate: true });
watch(() => props.form.date_facets, () => { browsedYear.value = undefined; });
watch(
  [() => props.form.date_after, () => props.form.date_before, () => props.form.date_facets],
  () => {
    from.value = hasCustomRange.value ? props.form.date_after : '';
    until.value = hasCustomRange.value ? props.form.date_before : '';
  },
  { immediate: true },
);

function apply(updates: Partial<Form>) {
  emit('submitFilterForm', { ...props.form, ...updates });
}

function chooseYear(year: string) {
  if (props.dateRangeEnabled) {
    apply(selectedYear.value === year ? emptyDateFilters : yearFilter(year));
  } else {
    browsedYear.value = activeYear.value === year ? '' : year;
  }
}

function chooseMonth(month: string) {
  if (props.form.date_facets === month) {
    yearList.value?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
    apply(emptyDateFilters);
  } else {
    apply(monthFilter(month));
  }
}

function changeOrder(event: Event) {
  apply({ order: (event.target as HTMLSelectElement).value });
}
</script>

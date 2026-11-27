<template>
  <form class="cv-filters" role="search" @submit.prevent="submitForm">
    <div class="cv-filters__top">
      <label class="cv-search">
        <span class="cv-sr-only">Search</span>
        <cv-icon name="search" />
        <input
          v-model="form.search"
          id="id_search"
          class="cv-input"
          type="search"
          placeholder="Search"
          enterkeyhint="search"
          autocomplete="off"
        />
      </label>
      <button
        type="button"
        class="cv-button cv-filters__toggle"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="open = !open"
      >
        <cv-icon name="filter" /> Filters
        <span v-if="activeCount > 0" class="cv-count" :aria-label="`${activeCount} active`">{{ activeCount }}</span>
      </button>
    </div>
    <div :id="panelId" class="cv-filters__panel" :hidden="!open">
      <fieldset v-for="group in facetGroups" :key="group.type">
        <legend class="cv-label">{{ group.label }}</legend>
        <ul class="cv-chips">
          <li v-for="facet in group.facets" :key="facet.slug">
            <button
              type="button"
              class="cv-chip"
              :aria-pressed="form[group.type] === facet.slug"
              @click="selectFacet(group.type, form[group.type] === facet.slug ? '' : facet.slug)"
            >
              {{ facet.label }} <span class="cv-chip__count">{{ facet.count }}</span>
            </button>
          </li>
          <li v-if="group.hidden > 0">
            <button type="button" class="cv-chip" :aria-expanded="false" @click="expanded[group.type] = true">
              Show all <span class="cv-chip__count">+{{ group.hidden }}</span>
            </button>
          </li>
        </ul>
      </fieldset>
      <fieldset>
        <legend class="cv-label">Date range</legend>
        <div class="cv-filters__dates">
          <label class="cv-field">
            <span>From</span>
            <input type="date" v-model="form.date_after" class="cv-input" id="id_date_0" />
          </label>
          <label class="cv-field">
            <span>Until</span>
            <input type="date" v-model="form.date_before" class="cv-input" id="id_date_1" />
          </label>
        </div>
      </fieldset>
      <label class="cv-field">
        <span class="cv-label">Sort by</span>
        <select v-model="form.order" name="order" id="id_o" class="cv-select" @change="submitForm">
          <option value="">Newest first</option>
          <option value="visible_date">Oldest first</option>
        </select>
      </label>
      <div class="cv-filters__actions">
        <button type="submit" class="cv-button cv-button--primary cv-button--small">Apply</button>
        <button v-if="activeCount > 0" type="button" class="cv-button cv-button--ghost cv-button--small" @click="clearAll">
          Clear all
        </button>
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import { computed, reactive, ref, useId, watchEffect } from 'vue';
import CvIcon from './CvIcon.vue';
import { Form, FacetCounts } from './types';

type FacetType = 'date_facets' | 'category_facets' | 'tag_facets';
const FACET_GROUPS: { type: FacetType; label: string }[] = [
  { type: 'category_facets', label: 'Categories' },
  { type: 'tag_facets', label: 'Tags' },
  { type: 'date_facets', label: 'Archive' },
];
// Long facet lists start collapsed to this many entries.
const FACET_LIMIT = 12;
const FILTER_KEYS: (keyof Form)[] = ['date_after', 'date_before', 'date_facets', 'category_facets', 'tag_facets', 'order'];

// "2026-11" -> "Nov 2026" in the page language; other names stay as they are.
function facetLabel(type: FacetType, name: string): string {
  const month = type === 'date_facets' ? /^(\d{4})-(\d{2})$/.exec(name) : null;
  if (!month) return name;
  const date = new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1));
  try {
    return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  } catch {
    return name;
  }
}

export default {
  components: { CvIcon },
  props: {
    form: {
      type: Object as () => Form,
      default: () => ({}),
    },
    facetCounts: {
      type: Object as () => FacetCounts,
      default: () => ({}),
    },
  },
  setup(props, context) {
    // A working copy: the applied filters only change through submitFilterForm.
    const form = ref<Form>({ ...props.form });
    const open = ref(false);
    const panelId = useId();
    const expanded = reactive<Record<FacetType, boolean>>({ date_facets: false, category_facets: false, tag_facets: false });

    watchEffect(() => {
      // Update the working copy whenever the applied filters change.
      const next = { ...props.form };
      if (next.order === '-visible_date') next.order = '';
      form.value = next;
    });

    const submitForm = () => {
      context.emit("submitFilterForm", { ...form.value });
    };

    const selectFacet = (type: FacetType, value: string) => {
      form.value[type] = value;
      submitForm();
    };

    const clearAll = () => {
      form.value = { ...form.value, search: '', date_after: '', date_before: '', date_facets: '', category_facets: '', tag_facets: '', order: '' };
      submitForm();
    };

    const activeCount = computed(() => FILTER_KEYS.filter((key) => Boolean(props.form[key]) && props.form[key] !== '-visible_date').length);

    const facetGroups = computed(() => FACET_GROUPS.map(({ type, label }) => {
      const all = (props.facetCounts[type] ?? []).map((facet) => ({ ...facet, label: facetLabel(type, facet.name) }));
      // Months read best newest first.
      if (type === 'date_facets') all.sort((a, b) => (a.slug < b.slug ? 1 : a.slug > b.slug ? -1 : 0));
      const selected = form.value[type];
      const facets = expanded[type] ? all : all.filter((facet, index) => index < FACET_LIMIT || facet.slug === selected);
      return { type, label, facets, hidden: all.length - facets.length };
    }).filter((group) => group.facets.length > 0));

    return { form, open, panelId, expanded, facetGroups, activeCount, submitForm, selectFacet, clearAll };
  },
  emits: ["submitFilterForm"],
};
</script>

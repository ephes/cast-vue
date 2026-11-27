<template>
  <div v-if="themes.length > 1" class="cv-theme-select">
    <label class="cv-label" :for="selectId">Site theme</label>
    <span class="cv-select-wrap">
      <select :id="selectId" class="cv-select" :value="selectedTheme" :aria-disabled="updating" @change="changeTheme">
        <option v-for="theme in themes" :key="theme.slug" :value="theme.slug">
          {{ theme.name }}
        </option>
      </select>
      <cv-icon name="down" />
    </span>
    <button
      v-if="canKeepTheme"
      type="button"
      class="cv-button cv-button--small"
      :aria-disabled="updating"
      @click="updateTheme(renderedTheme)"
    >
      Keep this theme
    </button>
    <span v-if="errorMessage" class="cv-form-error" role="alert">{{ errorMessage }}</span>
  </div>
</template>

<script lang="ts">
import { useId } from 'vue';
import CvIcon from './CvIcon.vue';
import config from '../config';
import { useDataStore } from '../stores/dataStore';
import { Theme } from './types';

// Switches the django-cast theme of the site for this visitor.
export default {
  components: { CvIcon },
  setup() {
    return { selectId: useId() };
  },
  data(): { selectedTheme: string; themes: Theme[]; errorMessage: string; updating: boolean } {
    return {
      selectedTheme: "",
      themes: [],
      errorMessage: "",
      updating: false,
    };
  },
  computed: {
    renderedTheme(): string {
      // This component runs in the Vue shell. The API's selected flag can
      // still describe a different session, blog or site default.
      return (this.themes.find((theme) => theme.slug === 'vue')
        ?? this.themes.find((theme) => theme.selected)
        ?? this.themes[0])?.slug ?? '';
    },
    canKeepTheme(): boolean {
      return this.themes.some((theme) => theme.selected && theme.slug !== this.renderedTheme);
    },
  },
  async mounted() {
    // Fetching the list of themes from the API
    try {
      const dataStore = useDataStore();
      const themeList = await dataStore.fetchJson(config.apiThemeListUrl);
      this.themes = Array.isArray(themeList.items) ? themeList.items as Theme[] : [];
    } catch {
      // Without the list there is nothing to choose from.
      this.themes = [];
    }
    this.selectedTheme = this.renderedTheme;
  },
  methods: {
    changeTheme(event: Event) {
      const select = event.target as HTMLSelectElement;
      if (this.updating) {
        select.value = this.selectedTheme;
        return;
      }
      void this.updateTheme(select.value);
    },
    async updateTheme(theme: string) {
      if (this.updating) return;
      this.updating = true;
      this.selectedTheme = theme;
      this.errorMessage = "";
      try {
        const response = await fetch(config.apiThemeUpdateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": config.csrfToken,
          },
          body: JSON.stringify({ theme_slug: theme }),
        });

        if (response.ok) {
          const url = new URL(window.location.href);
          // Drop request-only overrides so the reload uses the saved theme.
          if (url.searchParams.has('theme') || url.searchParams.has('template_base_dir')) {
            url.searchParams.delete('theme');
            url.searchParams.delete('template_base_dir');
            window.location.replace(url.href);
          } else {
            window.location.reload();
          }
          return;
        }
        const result = await response.json().catch(() => ({}));
        this.errorMessage = `The theme could not be changed${result?.error ? ": " + result.error : "."}`;
      } catch {
        this.errorMessage = "The theme could not be changed.";
      }
      this.selectedTheme = this.renderedTheme;
      this.updating = false;
    },
  },
};
</script>

<template>
  <div v-if="themes.length > 1" class="cv-theme-select">
    <label class="cv-label" :for="selectId">Site theme</label>
    <select :id="selectId" class="cv-select" v-model="selectedTheme" @change="updateTheme">
      <option v-for="theme in themes" :key="theme.slug" :value="theme.slug">
        {{ theme.name }}
      </option>
    </select>
    <span v-if="errorMessage" class="cv-form-error" role="alert">{{ errorMessage }}</span>
  </div>
</template>

<script lang="ts">
import { useId } from 'vue';
import config from '../config';
import { useDataStore } from '../stores/dataStore';
import { Theme } from './types';

// Switches the django-cast theme of the site for this visitor.
export default {
  setup() {
    return { selectId: useId() };
  },
  data(): { selectedTheme: string; themes: Theme[], errorMessage: string } {
    return {
      selectedTheme: "",
      themes: [],
      errorMessage: "",
    };
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
    const selectedTheme = this.themes.find((theme) => theme.selected);
    if (selectedTheme) {
      this.selectedTheme = selectedTheme.slug;
    }
  },
  methods: {
    async updateTheme() {
      this.errorMessage = "";
      try {
        const response = await fetch(config.apiThemeUpdateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": config.csrfToken,
          },
          body: JSON.stringify({ theme_slug: this.selectedTheme }),
        });

        if (response.ok) {
          // Reload the page to see the new theme
          window.location.reload();
        } else {
          const result = await response.json().catch(() => ({}));
          this.errorMessage = `The theme could not be changed${result?.error ? ": " + result.error : "."}`;
        }
      } catch {
        this.errorMessage = "The theme could not be changed.";
      }
    },
  },
};
</script>

import { ref } from "vue";

// The reader's colour scheme: "system" follows the device, "light" and "dark"
// are explicit choices remembered in localStorage and applied as data-theme on
// <html> (see styles.css).
export type ColorScheme = "system" | "light" | "dark";

const STORAGE_KEY = "cast-color-scheme";
const LEGACY_KEY = "cast-vue:color-scheme";
const REACT_LEGACY_KEY = "cast-react-color-scheme";

export const colorScheme = ref<ColorScheme>("system");

function apply(scheme: ColorScheme): void {
  colorScheme.value = scheme;
  if (scheme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = scheme;
  }
}

function syncColorScheme(event?: StorageEvent): void {
  if (event && event.key !== STORAGE_KEY && event.key !== LEGACY_KEY && event.key !== null) return;
  try {
    const storage = window.localStorage;
    if (event && event.storageArea !== storage) return;
    const value = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_KEY);
    apply(value === "light" || value === "dark" ? value : "system");
  } catch {
    // Keep the current page's choice if storage is unavailable.
  }
}

export function initColorScheme(): void {
  syncColorScheme();
  window.addEventListener("storage", syncColorScheme);
}

export function setColorScheme(scheme: ColorScheme): void {
  apply(scheme);
  try {
    const storage = window.localStorage;
    if (scheme !== "system") storage.setItem(STORAGE_KEY, scheme);
    storage.removeItem(LEGACY_KEY);
    storage.removeItem(REACT_LEGACY_KEY);
    if (scheme === "system") storage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or disabled storage: the choice lasts for this page only.
  }
}

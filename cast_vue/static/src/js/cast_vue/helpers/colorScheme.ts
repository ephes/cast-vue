import { ref } from "vue";

// The reader's colour scheme: "system" follows the device, "light" and "dark"
// are explicit choices remembered in localStorage and applied as data-theme on
// <html> (see styles.css).
export type ColorScheme = "system" | "light" | "dark";

const STORAGE_KEY = "cast-vue:color-scheme";
const ORDER: ColorScheme[] = ["system", "light", "dark"];

function stored(): ColorScheme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export const colorScheme = ref<ColorScheme>("system");

function apply(scheme: ColorScheme): void {
  if (scheme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = scheme;
  }
}

export function initColorScheme(): void {
  colorScheme.value = stored();
  apply(colorScheme.value);
}

export function setColorScheme(scheme: ColorScheme): void {
  colorScheme.value = scheme;
  apply(scheme);
  try {
    if (scheme === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Private mode or disabled storage: the choice lasts for this page only.
  }
}

export function nextColorScheme(scheme: ColorScheme): ColorScheme {
  return ORDER[(ORDER.indexOf(scheme) + 1) % ORDER.length];
}

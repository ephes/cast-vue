import { ref } from "vue";

// What the app shell knows about the blog: its title for the header and the
// browser tab. Route components report it once their data is loaded.
export const blogTitle = ref("");

export function setBlogTitle(title: unknown): void {
  if (typeof title === "string" && title.trim() !== "") blogTitle.value = title.trim();
}

export function setPageTitle(pageTitle?: string): void {
  const parts = [pageTitle?.trim(), blogTitle.value].filter((part) => part);
  if (parts.length > 0) document.title = parts.join(" · ");
}

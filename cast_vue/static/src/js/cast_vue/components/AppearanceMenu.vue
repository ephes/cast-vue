<template>
  <div ref="root" class="cv-appearance">
    <button
      ref="trigger"
      type="button"
      class="cv-icon-button cv-appearance__trigger"
      :aria-label="triggerLabel"
      :title="triggerLabel"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      @click="isOpen ? closeMenu() : openMenuAt(schemes.indexOf(colorScheme))"
      @keydown.down.prevent="openMenuAt(0)"
      @keydown.up.prevent="openMenuAt(schemes.length - 1)"
    >
      <cv-icon :name="options[colorScheme].icon" />
    </button>
    <div :id="menuId" ref="menu" class="cv-appearance__menu" role="menu" aria-label="Appearance" :hidden="!isOpen">
      <button
        v-for="(option, scheme, index) in options"
        :key="scheme"
        type="button"
        class="cv-appearance__item"
        role="menuitemradio"
        :aria-checked="colorScheme === scheme"
        tabindex="-1"
        @click="choose(scheme)"
        @keydown="handleItemKeydown($event, index, scheme)"
      >
        <cv-icon :name="option.icon" />
        {{ option.label }}
        <cv-icon v-if="colorScheme === scheme" class="cv-appearance__check" name="check" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { ref } from 'vue';

// The SPA and Django header mounts can be separate Vue apps on the same page.
let nextMenuId = 0;
const openMenuId = ref<string | null>(null);
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue';
import CvIcon from './CvIcon.vue';
import { colorScheme, setColorScheme, type ColorScheme } from '../helpers/colorScheme';

const options = {
  light: { label: 'Light', icon: 'sun' },
  dark: { label: 'Dark', icon: 'moon' },
  system: { label: 'System', icon: 'system' },
};
const schemes = Object.keys(options) as ColorScheme[];
const menuId = `cv-appearance-${++nextMenuId}`;
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const isOpen = computed(() => openMenuId.value === menuId);
const triggerLabel = computed(() => `Appearance: ${options[colorScheme.value].label}`);

function focusItem(index: number) {
  menu.value?.querySelectorAll('button')[index]?.focus();
}

async function openMenuAt(index: number) {
  openMenuId.value = menuId;
  await nextTick();
  if (isOpen.value) focusItem(index);
}

function closeMenu(returnFocus = false) {
  if (!isOpen.value) return;
  openMenuId.value = null;
  if (returnFocus) trigger.value?.focus();
}

function choose(scheme: ColorScheme) {
  setColorScheme(scheme);
  closeMenu(true);
}

function handleItemKeydown(event: KeyboardEvent, index: number, scheme: ColorScheme) {
  // Resume native Tab/Shift+Tab navigation from the trigger.
  if (event.key === 'Tab') {
    closeMenu(true);
    return;
  }

  switch (event.key) {
    case 'ArrowDown': focusItem((index + 1) % schemes.length); break;
    case 'ArrowUp': focusItem((index + schemes.length - 1) % schemes.length); break;
    case 'Home': focusItem(0); break;
    case 'End': focusItem(schemes.length - 1); break;
    case 'Enter':
    case ' ': choose(scheme); break;
    case 'Escape': closeMenu(true); break;
    default: return;
  }
  event.preventDefault();
  event.stopPropagation();
}

function closeOnOutsideClick(event: MouseEvent) {
  if (root.value && !event.composedPath().includes(root.value)) closeMenu();
}

onMounted(() => document.addEventListener('click', closeOnOutsideClick, true));
onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick, true);
  closeMenu();
});
</script>

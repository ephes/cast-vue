import { enableAutoUnmount, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import AppearanceMenu from '@/components/AppearanceMenu.vue';
import { initColorScheme } from '@/helpers/colorScheme';
import { memoryStorage } from './fixtures';

const key = 'cast-color-scheme';
const legacyKey = 'cast-vue:color-scheme';
const reactLegacyKey = 'cast-react-color-scheme';
const html = document.documentElement;

enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  initColorScheme();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function mountMenu() {
  const wrapper = mount(AppearanceMenu, { attachTo: document.body });
  return {
    trigger: wrapper.get('button[aria-haspopup="menu"]'),
    menu: wrapper.get('[role="menu"]'),
    items: wrapper.findAll('[role="menuitemradio"]'),
  };
}

test('shows the current setting, opens to the checked item and only toggles on trigger click', async () => {
  window.localStorage.setItem(key, 'dark');
  initColorScheme();
  const { trigger, menu, items } = mountMenu();

  expect(trigger.attributes()).toMatchObject({
    'aria-label': 'Appearance: Dark',
    title: 'Appearance: Dark',
    'aria-expanded': 'false',
    'aria-controls': menu.attributes('id'),
  });
  expect(menu.isVisible()).toBe(false);
  expect(trigger.find('svg').html()).toBe(items[1].find('svg').html());

  await trigger.trigger('click');
  expect(trigger.attributes('aria-expanded')).toBe('true');
  expect(menu.isVisible()).toBe(true);
  expect(items.map(item => item.text())).toEqual(['Light', 'Dark', 'System']);
  expect(items.map(item => item.attributes('aria-checked'))).toEqual(['false', 'true', 'false']);
  expect(items[1].find('.cv-appearance__check').exists()).toBe(true);
  expect(document.activeElement).toBe(items[1].element);

  await trigger.trigger('click');
  expect(trigger.attributes('aria-expanded')).toBe('false');
  expect(menu.isVisible()).toBe(false);
  expect(html.dataset.theme).toBe('dark');
  expect(window.localStorage.getItem(key)).toBe('dark');
});

test('closes on Escape, Tab and outside click', async () => {
  const { trigger, menu, items } = mountMenu();
  await trigger.trigger('click');
  await items[2].trigger('keydown', { key: 'Escape' });
  expect(menu.isVisible()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);

  await trigger.trigger('click');
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  items[2].element.dispatchEvent(tab);
  await nextTick();
  expect(menu.isVisible()).toBe(false);
  expect(tab.defaultPrevented).toBe(false);

  const outside = document.body.appendChild(document.createElement('button'));
  await trigger.trigger('click');
  outside.focus();
  outside.click();
  await nextTick();
  expect(menu.isVisible()).toBe(false);
  expect(document.activeElement).toBe(outside);
  expect(html.hasAttribute('data-theme')).toBe(false);
});

test('supports arrow navigation, Home, End, Enter and Space', async () => {
  const { trigger, menu, items } = mountMenu();
  await trigger.trigger('keydown', { key: 'ArrowDown' });
  expect(document.activeElement).toBe(items[0].element);
  await items[0].trigger('keydown', { key: 'ArrowUp' });
  expect(document.activeElement).toBe(items[2].element);
  await items[2].trigger('keydown', { key: 'ArrowDown' });
  expect(document.activeElement).toBe(items[0].element);
  await items[0].trigger('keydown', { key: 'End' });
  expect(document.activeElement).toBe(items[2].element);
  await items[2].trigger('keydown', { key: 'Home' });
  expect(document.activeElement).toBe(items[0].element);
  await items[0].trigger('keydown', { key: 'ArrowDown' });
  await items[1].trigger('keydown', { key: 'Enter' });
  expect(menu.isVisible()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  expect(html.dataset.theme).toBe('dark');

  await trigger.trigger('keydown', { key: 'ArrowUp' });
  expect(document.activeElement).toBe(items[2].element);
  await items[2].trigger('keydown', { key: ' ' });
  expect(menu.isVisible()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  expect(html.hasAttribute('data-theme')).toBe(false);
});

test.each([
  [0, 'Light', 'light'],
  [1, 'Dark', 'dark'],
  [2, 'System', null],
] as const)('chooses %s (%s), updates the page and clears both legacy preferences', async (index, label, value) => {
  window.localStorage.setItem(legacyKey, 'dark');
  window.localStorage.setItem(reactLegacyKey, 'dark');
  window.localStorage.setItem(key, 'light');
  initColorScheme();
  const { trigger, menu, items } = mountMenu();
  expect(trigger.attributes('aria-label')).toBe('Appearance: Light');

  await trigger.trigger('click');
  await items[index].trigger('click');
  expect(trigger.attributes('aria-label')).toBe(`Appearance: ${label}`);
  expect(html.getAttribute('data-theme')).toBe(value);
  expect(window.localStorage.getItem(key)).toBe(value);
  expect(window.localStorage.getItem(legacyKey)).toBeNull();
  expect(window.localStorage.getItem(reactLegacyKey)).toBeNull();
  expect(menu.isVisible()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
});

test('retains the page choice when reading or writing storage throws', async () => {
  function storageDisabled(): never { throw new Error('Storage disabled'); }
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(storageDisabled);
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(storageDisabled);
  initColorScheme();
  const { trigger, items } = mountMenu();
  expect(trigger.attributes('aria-label')).toBe('Appearance: System');
  await trigger.trigger('click');
  await items[0].trigger('click');
  expect(trigger.attributes('aria-label')).toBe('Appearance: Light');
  expect(html.dataset.theme).toBe('light');
});

test('syncs the page and menu on localStorage changes from a different tab', async () => {
  const { trigger, items } = mountMenu();
  await trigger.trigger('click');
  function notifyStorage(storageArea: Storage, changedKey = key) {
    const event = new StorageEvent('storage', { key: changedKey });
    // The browser's StorageEvent constructor requires native Storage objects.
    Object.defineProperty(event, 'storageArea', { value: storageArea });
    window.dispatchEvent(event);
  }
  window.localStorage.setItem(key, 'light');
  window.localStorage.setItem(legacyKey, 'dark');
  window.localStorage.setItem(reactLegacyKey, 'dark');
  notifyStorage(memoryStorage());
  await nextTick();
  expect(trigger.attributes('aria-label')).toBe('Appearance: System');

  notifyStorage(window.localStorage);
  await nextTick();
  expect(trigger.attributes('aria-label')).toBe('Appearance: Light');
  expect(items[0].attributes('aria-checked')).toBe('true');
  expect(html.dataset.theme).toBe('light');

  window.localStorage.removeItem(key);
  notifyStorage(window.localStorage);
  await nextTick();
  expect(trigger.attributes('aria-label')).toBe('Appearance: Dark');
  expect(items[1].attributes('aria-checked')).toBe('true');
  expect(html.dataset.theme).toBe('dark');

  window.localStorage.removeItem(legacyKey);
  notifyStorage(window.localStorage, legacyKey);
  await nextTick();
  expect(trigger.attributes('aria-label')).toBe('Appearance: System');
  expect(items[2].attributes('aria-checked')).toBe('true');
  expect(html.hasAttribute('data-theme')).toBe(false);
});

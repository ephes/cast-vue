import { afterEach, expect, test, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import SelectTheme from '@/components/SelectTheme.vue';

const fetchJson = vi.hoisted(() => vi.fn());
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => ({ fetchJson }) }));
vi.mock('@/config', () => ({ default: {
  apiThemeListUrl: new URL('http://localhost/api/themes/'),
  apiThemeUpdateUrl: new URL('http://localhost/api/update_theme/'),
  csrfToken: 'csrf',
} }));

const bootstrap = { slug: 'bootstrap5', name: 'Bootstrap 5', selected: true };
const plain = { slug: 'plain', name: 'Just HTML', selected: false };
const vue = { slug: 'vue', name: 'Vue.js', selected: false };

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

test.each([
  { items: [bootstrap, plain, vue], selected: 'vue', canKeepTheme: true },
  { items: [{ ...bootstrap, selected: false }, { ...vue, selected: true }], selected: 'vue', canKeepTheme: false },
  { items: [plain, bootstrap], selected: 'bootstrap5', canKeepTheme: false },
])('shows $selected and offers to keep it only when the API selects a different theme ($canKeepTheme)', async ({
  items, selected, canKeepTheme,
}) => {
  fetchJson.mockResolvedValueOnce({ items });
  const wrapper = mount(SelectTheme);
  await flushPromises();
  const select = wrapper.get<HTMLSelectElement>('select');
  expect(select.element.value).toBe(selected);
  expect(wrapper.get('label').attributes('for')).toBe(select.attributes('id'));
  expect(wrapper.find('button').exists()).toBe(canKeepTheme);
});

test('keeps Vue by posting the displayed theme from a preview', async () => {
  fetchJson.mockResolvedValueOnce({ items: [bootstrap, vue] });
  const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(SelectTheme);
  await flushPromises();

  const keepButton = wrapper.get('button');
  expect(keepButton.text()).toBe('Keep this theme');
  await keepButton.trigger('click');

  expect(fetch).toHaveBeenCalledExactlyOnceWith(new URL('http://localhost/api/update_theme/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': 'csrf' },
    body: JSON.stringify({ theme_slug: 'vue' }),
  });
});

test('keeps focus on the select while pending and restores the rendered choice on failure', async () => {
  fetchJson.mockResolvedValueOnce({ items: [bootstrap, plain, vue] });
  const { promise, resolve } = Promise.withResolvers<Response>();
  const fetch = vi.fn().mockReturnValue(promise);
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(SelectTheme, { attachTo: document.body });
  await flushPromises();

  const select = wrapper.get<HTMLSelectElement>('select');
  select.element.focus();
  await select.setValue('bootstrap5');
  expect(select.attributes('aria-disabled')).toBe('true');
  expect(select.element.disabled).toBe(false);
  expect(document.activeElement).toBe(select.element);

  await select.setValue('plain');
  expect(select.element.value).toBe('bootstrap5');
  await wrapper.get('button').trigger('click');
  expect(fetch).toHaveBeenCalledExactlyOnceWith(new URL('http://localhost/api/update_theme/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': 'csrf' },
    body: JSON.stringify({ theme_slug: 'bootstrap5' }),
  });
  resolve(Response.json({ error: 'Unavailable' }, { status: 503 }));
  await flushPromises();

  expect(wrapper.get('[role="alert"]').text()).toContain('Unavailable');
  expect(select.element.value).toBe('vue');
  expect(select.attributes('aria-disabled')).toBe('false');
  expect(document.activeElement).toBe(select.element);
});

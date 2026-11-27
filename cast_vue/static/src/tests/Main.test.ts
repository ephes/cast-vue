import { flushPromises } from '@vue/test-utils';
import type { App } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('@/App.vue', () => ({ default: { template: '<router-view />' } }));
vi.mock('@/components/LoadPostList.vue', () => ({ default: { template: '<p>Blog list</p>' } }));
vi.mock('@/components/Styleguide.vue', () => ({ default: { template: '<p>Styleguide</p>' } }));

const blogConfig = `
  data-blog-id="1"
  data-wagtail-api-pages-url="http://localhost/pages/"
  data-api-facet-counts-url="http://localhost/facets"
  data-post-comment-url="http://localhost/comments"
  data-api-theme-list-url="http://localhost/themes"
  data-api-theme-update-url="http://localhost/themes/update"
  data-api-podlove-player-config-url="http://localhost/player"
`;

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  document.querySelectorAll<Element & { __vue_app__: App }>('[data-v-app]')
    .forEach((element) => element.__vue_app__.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

test.each([false, true])('preserves an unrelated #app and mounts the colour scheme switch with blog config: %s', async (hasBlog) => {
  document.body.innerHTML = `
    <script id="vue-configuration" ${hasBlog ? blogConfig : ''}></script>
    <div data-cv-color-scheme></div>
    <div id="app"><p>Flat page content</p></div>
  `;
  await import('@/main');
  expect(document.querySelector('#app')?.textContent).toBe('Flat page content');
  expect(document.querySelector('[data-cv-color-scheme] button')?.getAttribute('aria-label')).toContain('Colour scheme');
});

test.each([
  ['data-cv-spa', '', 'Blog list'],
  ['', 'data-page-type="styleguide"', 'Styleguide'],
])('mounts the entry point for %s %s', async (marker, pageType, content) => {
  document.body.innerHTML = `
    <script id="vue-configuration" ${blogConfig} ${pageType}></script>
    <div id="app" ${marker}></div>
  `;
  await import('@/main');
  await flushPromises();
  expect(document.querySelector('#app')?.textContent).toBe(content);
});

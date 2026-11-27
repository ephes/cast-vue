import { flushPromises } from '@vue/test-utils';
import type { App } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { memoryStorage } from './fixtures';

vi.mock('@/components/Styleguide.vue', () => ({ default: { template: '<p>Styleguide</p>' } }));

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), setSlugToId: vi.fn(), slugToPost: {} }));
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));

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
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  mocks.fetchJson.mockReset().mockImplementation(async (url: URL) => {
    switch (url.pathname) {
      case '/pages/1/': return { title: 'Blog list' };
      case '/facets': return { facet_counts: {} };
      case '/themes': return { items: [] };
      case '/pages/': return {
        items: [{
          id: 1,
          title: 'Out of YAML',
          html_overview: '<p>Overview</p>',
          html_detail: '<p>Detail</p>',
          meta: { type: 'cast.Post', slug: 'out-of-yaml', html_url: `${location.origin}/blogs/ephes_blog/out-of-yaml/` },
        }],
        meta: { total_count: 6 },
      };
      default: throw new Error(`Unexpected test URL ${url}`);
    }
  });
});

afterEach(() => {
  document.querySelectorAll<Element & { __vue_app__: App }>('[data-v-app]')
    .forEach((element) => element.__vue_app__.unmount());
  document.body.replaceChildren();
  delete document.documentElement.dataset.theme;
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test.each([false, true])('preserves an unrelated #app and mounts the Django Appearance menu with blog config: %s', async (hasBlog) => {
  document.body.innerHTML = `
    <script id="vue-configuration" ${hasBlog ? blogConfig : ''}></script>
    <div data-cv-color-scheme></div>
    <div id="app"><p>Flat page content</p></div>
  `;
  await import('@/main');
  expect(document.querySelector('#app')?.textContent).toBe('Flat page content');
  const mount = document.querySelector('[data-cv-color-scheme]')!;
  const trigger = mount.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  expect(trigger.getAttribute('aria-label')).toBe('Appearance: System');
  trigger.click();
  await flushPromises();
  expect(mount.querySelector('[role="menu"]')?.hasAttribute('hidden')).toBe(false);
  expect(document.activeElement?.textContent?.trim()).toBe('System');
  mount.querySelector<HTMLButtonElement>('[role="menuitemradio"]')!.click();
  await flushPromises();
  expect(trigger.getAttribute('aria-label')).toBe('Appearance: Light');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(window.localStorage.getItem('cast-color-scheme')).toBe('light');
  expect(document.activeElement).toBe(trigger);
});

test('SPA and Django Appearance menus share the setting and only one opens at a time', async () => {
  window.history.replaceState(null, '', '/show/');
  document.body.innerHTML = `
    <script id="vue-configuration" ${blogConfig} data-blog-url="/show/"></script>
    <div id="app" data-cv-spa></div>
    <div data-cv-color-scheme></div>
  `;
  await import('@/main');
  await flushPromises();

  const [spa, django] = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]'));
  const [spaMenu, djangoMenu] = [spa, django].map(button => document.getElementById(button.getAttribute('aria-controls')!)!);
  expect(spaMenu).not.toBe(djangoMenu);
  spa.click();
  await flushPromises();
  expect(spaMenu.hidden).toBe(false);
  expect(djangoMenu.hidden).toBe(true);

  django.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  await flushPromises();
  expect(spaMenu.hidden).toBe(true);
  expect(djangoMenu.hidden).toBe(false);
  djangoMenu.querySelectorAll('button')[1].click();
  await flushPromises();
  expect([spa, django].map(button => button.getAttribute('aria-label'))).toEqual(['Appearance: Dark', 'Appearance: Dark']);
  expect(spaMenu.querySelector('[aria-checked="true"]')?.textContent?.trim()).toBe('Dark');
  expect(djangoMenu.hidden).toBe(true);
});

test.each(['/show/', '/blogs/ephes_blog/'])('uses the blog pathname %s in real router links', async (base) => {
  const blogUrl = base === '/show/' ? base : `${location.origin}${base}`;
  const feedUrl = `${blogUrl}feed/?theme=vue`;
  window.history.replaceState(null, '', base);
  document.body.innerHTML = `
    <script id="vue-configuration" ${blogConfig} data-blog-url="${blogUrl}"></script>
    <script id="cast-vue-subscribe-data" type="application/json">${JSON.stringify({ feedPageUrl: feedUrl })}</script>
    <div id="app" data-cv-spa></div>
  `;
  await import('@/main');
  await flushPromises();

  const { default: config } = await import('@/config');
  expect(config.routerBase).toBe(base);
  expect(document.querySelector('.cv-brand')?.getAttribute('href')).toBe(base);
  expect(document.querySelector('.cv-header__subscribe')?.getAttribute('href')).toBe(feedUrl);

  document.querySelector<HTMLButtonElement>('.cv-pagination [aria-label="Page 2"]')?.click();
  await flushPromises();
  expect(window.location.pathname + window.location.search).toBe(`${base}?page=2`);

  const postLink = document.querySelector<HTMLAnchorElement>('.cv-post__title a');
  expect(postLink?.getAttribute('href')).toBe(`${base}out-of-yaml/`);
  expect(document.querySelector('.cv-post__more')?.getAttribute('href')).toBe(`${base}out-of-yaml/`);

  postLink?.click();
  await flushPromises();
  expect(window.location.pathname).toBe(`${base}out-of-yaml/`);
  expect(document.querySelector('.cv-back')?.getAttribute('href')).toBe(base);
});

test('mounts the styleguide on its own absolute URL', async () => {
  const base = '/blogs/styleguide/';
  window.history.replaceState(null, '', base);
  document.body.innerHTML = `
    <script id="vue-configuration" ${blogConfig}
      data-blog-url="${location.origin}/blogs/ephes_blog/"
      data-styleguide-url="${location.origin}${base}?theme=vue"
      data-page-type="styleguide" data-vue-route-name="Styleguide"></script>
    <div id="app"></div>
  `;
  await import('@/main');
  await flushPromises();

  const { default: config } = await import('@/config');
  expect(config.routerBase).toBe(base);
  expect(document.querySelector('.cv-brand')?.getAttribute('href')).toBe(base);
  expect(document.querySelector('#cv-main')?.textContent).toBe('Styleguide');
});

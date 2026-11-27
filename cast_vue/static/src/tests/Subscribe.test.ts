import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '@/App.vue';
import LoadPostList from '@/components/LoadPostList.vue';
import PostDetail from '@/components/PostDetail.vue';
import { blogTitle } from '@/helpers/site';

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  setSlugToId: vi.fn(),
  slugToPost: {},
  isPodcast: true,
  showSubscribe: true,
  vueRouteName: 'PostList',
}));

vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));
vi.mock('@/config', () => ({
  default: {
    blogDetailUrl: new URL('http://localhost/blog'),
    postListUrl: new URL('http://localhost/posts?child_of=1'),
    apiFacetCountsUrl: new URL('http://localhost/facets'),
    apiThemeListUrl: new URL('http://localhost/themes'),
    paginationPageSize: 5,
    pageType: 'cast.Episode',
    get vueRouteName() { return mocks.vueRouteName; },
    postSlug: 'episode',
    get subscribe() {
      return mocks.showSubscribe ? {
        feedPageUrl: '/show/feed/',
        isPodcast: mocks.isPodcast,
        platformLinks: [
          { label: 'Apple Podcasts', url: 'https://podcasts.apple.com/podcast/id42', icon: 'podcast' },
          { label: 'Overcast', url: 'https://overcast.fm/itunes42', icon: 'headphones' },
          { id: 'castro', label: 'Castro', url: 'https://castro.fm/itunes/42', icon: 'headphones' },
        ],
        followLinks: [
          { label: 'Mastodon', url: 'https://social.example/@show', rel: 'me' },
          { label: 'LinkedIn', url: 'https://www.linkedin.com/company/show/' },
          { label: 'Email', url: 'mailto:show@example.com' },
        ],
      } : null;
    },
  },
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
  blogTitle.value = '';
  mocks.showSubscribe = true;
  mocks.isPodcast = true;
  mocks.vueRouteName = 'PostList';
  mocks.fetchJson.mockReset().mockImplementation(async (url: URL) => {
    if (url.pathname === '/blog') return { title: 'Test Podcast', description: '<p>Podcast intro</p>' };
    if (url.pathname === '/facets') return { facet_counts: {} };
    if (url.pathname === '/themes') return {
      items: [{ slug: 'vue', name: 'Vue', selected: true }, { slug: 'plain', name: 'Plain' }],
    };
    return {
      items: [{
        id: 1,
        title: 'Test Episode',
        html_detail: '<p>Episode notes</p>',
        podlove_players: [['player-1', 'http://localhost/player']],
        meta: { type: 'cast.Episode', slug: 'episode' },
      }],
      meta: { total_count: 1 },
    };
  });
});

async function mountBlog() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'PostList', component: LoadPostList },
      { path: '/:slug/', name: 'PostDetail', component: PostDetail },
    ],
  });
  const wrapper = mount(App, { global: { plugins: [router], stubs: { AudioPlayer: true, PlayerBar: true } } });
  await flushPromises();
  return wrapper;
}

test('the header and footer link to the Django feed page and the footer keeps theme selection', async () => {
  const wrapper = await mountBlog();
  const header = wrapper.get('.cv-header__actions');
  expect(header.element.firstElementChild?.tagName).toBe('A');
  expect(header.get('a').text()).toBe('Subscribe');
  expect(header.get('a').attributes('href')).toBe('/show/feed/');
  expect(header.get('svg').attributes('aria-hidden')).toBe('true');

  const footer = wrapper.get('footer');
  expect(footer.findAll('a').map(link => [link.text(), link.attributes('href')])).toEqual([
    ['Feeds', '/show/feed/'],
    ['Mastodon', 'https://social.example/@show'],
    ['LinkedIn', 'https://www.linkedin.com/company/show/'],
    ['Email', 'mailto:show@example.com'],
  ]);
  expect(footer.get('a[rel="me"]').text()).toBe('Mastodon');
  expect(footer.get('select').element.value).toBe('vue');
});

test('the podcast app row follows the blog intro on the archive', async () => {
  const wrapper = await mountBlog();
  const row = wrapper.get('.cv-hero__description + .cv-subscribe');
  expect(row.get('p').text()).toBe('Listen for free in your favourite podcast app');
  expect(row.findAll('a').map(link => link.attributes('href'))).toEqual([
    'https://podcasts.apple.com/podcast/id42', 'https://overcast.fm/itunes42', '/show/feed/',
  ]);
});

test('the archive of a written blog offers only a feed link', async () => {
  mocks.isPodcast = false;
  const wrapper = await mountBlog();
  const links = wrapper.get('.cv-hero .cv-subscribe').findAll('a');
  expect(links.map(link => [link.text(), link.attributes('href')])).toEqual([['RSS feed', '/show/feed/']]);
});

test('the episode subscribe line follows the player and precedes the show notes', async () => {
  mocks.vueRouteName = 'PostDetail';
  const wrapper = await mountBlog();
  const row = wrapper.get('.cv-post__players + .cv-subscribe--episode');
  expect(row.get('p').text()).toBe('Subscribe to Test Podcast');
  expect(row.findAll('a').map(link => link.attributes('href'))).toEqual([
    'https://podcasts.apple.com/podcast/id42', 'https://overcast.fm/itunes42', '/show/feed/',
  ]);
  expect(row.element.nextElementSibling?.textContent).toBe('Episode notes');
});

test('pages render without subscription data', async () => {
  mocks.showSubscribe = false;
  const wrapper = await mountBlog();
  expect(wrapper.find('.cv-header__subscribe').exists()).toBe(false);
  expect(wrapper.find('.cv-footer__links').exists()).toBe(false);
  expect(wrapper.find('.cv-subscribe').exists()).toBe(false);
  expect(wrapper.get('article h2').text()).toBe('Test Episode');
});

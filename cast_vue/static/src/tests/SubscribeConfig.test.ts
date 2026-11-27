import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<script id="vue-configuration" data-blog-id="1"></script>';
  const config = document.getElementById('vue-configuration')!;
  for (const key of [
    'wagtail-api-pages-url', 'api-facet-counts-url', 'post-comment-url',
    'api-podlove-player-config-url', 'api-theme-list-url', 'api-theme-update-url',
  ]) config.setAttribute('data-' + key, 'http://localhost/api/');
});

afterEach(() => document.body.replaceChildren());

function setSubscribeScript(text: string) {
  const script = document.createElement('script');
  script.id = 'cast-vue-subscribe-data';
  script.type = 'application/json';
  script.textContent = text;
  document.body.append(script);
}

test('reads the feed URLs and omits links with invalid URLs or schemes', async () => {
  setSubscribeScript(JSON.stringify({
    feedPageUrl: '/show/feed/',
    isPodcast: true,
    podcastRssUrl: 'https://show.example/show/feed/podcast/mp3/rss.xml',
    blogRssUrl: '/show/feed/rss.xml',
    platformLinks: [
      { label: 'Apple Podcasts', url: 'https://podcasts.apple.com/show/id42', icon: 'podcast' },
      { label: 'JavaScript', url: 'javascript:alert(1)' },
      { label: 'Data', url: 'data:text/html,test' },
      { label: 'Missing host', url: 'https://' },
      { label: 'Relative external', url: '//example.com/app' },
      { label: 'Backslash external', url: '/\\example.com/app' },
      { label: 'Email', url: 'mailto:show@example.com' },
    ],
    followLinks: [
      { label: 'Mastodon', url: 'http://social.example/@show', rel: 'me' },
      { label: 'Email', url: 'mailto:show@example.com' },
      { label: 'Bad', url: 'ftp://example.com/' },
    ],
  }));
  const { default: config, configError } = await import('@/config');
  expect(configError).toBeNull();
  expect(config.subscribe).toMatchObject({
    feedPageUrl: '/show/feed/',
    podcastRssUrl: 'https://show.example/show/feed/podcast/mp3/rss.xml',
    blogRssUrl: '/show/feed/rss.xml',
    isPodcast: true,
    platformLinks: [{ label: 'Apple Podcasts', url: 'https://podcasts.apple.com/show/id42', icon: 'podcast' }],
    followLinks: [
      { label: 'Mastodon', url: 'http://social.example/@show', rel: 'me' },
      { label: 'Email', url: 'mailto:show@example.com' },
    ],
  });
});

test.each([null, '{', 'null', '{"feedPageUrl":"javascript:alert(1)"}'])(
  'keeps the rest of the config usable when subscribe data is absent or invalid (%s)',
  async (json) => {
    if (json !== null) setSubscribeScript(json);
    const { default: config, configError } = await import('@/config');
    expect(configError).toBeNull();
    expect(config.blogId).toBe(1);
    expect(config.subscribe).toBeNull();
  },
);

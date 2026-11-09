import { afterEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import markup from './fixtures/castRichText.html?raw';
import { sanitizeRichText } from '@/helpers/sanitizeRichText';

vi.mock('@/config', () => ({ default: { pageType: 'styleguide' } }));
import PostItem from '@/components/PostItem.vue';
import PostList from '@/components/PostList.vue';

const attacks = [
  '<script>alert(1)</script>',
  '<img src="/missing" onerror="alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<a href="java&#x09;script:alert(1)">click</a>',
  '<svg onload="alert(1)"><circle></circle></svg>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="/x"></object>',
  '<img src="data:image/svg+xml,<svg onload=alert(1)></svg>">',
  '<img src="data:image/png;base64,AAAA"><a href="data:text/html,evil">click</a>',
  '<video poster="javascript:alert(1)"><source src="data:video/mp4,evil"></video>',
  '<img srcset="/safe.jpg 1x, javascript:alert(1) 2x">',
  '<img srcset="/safe.jpg 1x, data:image/png;base64,AAAA 2x">',
  '<img data-fullsrc="javascript:alert(1)" data-modal-src="data:text/html,evil" data-modal-srcset="/safe.jpg 1x, javascript:alert(1) 2x" data-srcset="data:image/png;base64,AAAA">',
  '<p style="background:url(javascript:alert(1))" onclick="alert(1)" data-unknown="evil">text</p>',
  '<iframe src="https://evil.example/embed"></iframe><iframe src="javascript:alert(1)"></iframe>',
  '<iframe src="https://www.youtube.com.evil.example/embed/x"></iframe><iframe src="http://www.youtube.com/embed/x"></iframe>',
  '<iframe src="/same-origin/page"></iframe><iframe src="https://www.youtube.com:8443/embed/x"></iframe>',
  '<iframe src="https://www.youtube.com/embed/x" srcdoc="<script>alert(1)</script>" onload="alert(1)" sandbox=""></iframe>',
  '<div allow="camera" allowfullscreen referrerpolicy="unsafe-url">text</div>',
];

const embed = '<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="" frameborder="0" height="315" src="https://www.youtube.com/embed/bD5dyePOjk0" width="560"></iframe>';
const tableAndSemantics = '<section class="weeknote-links" aria-label="Articles"><ul><li><mark>new</mark> <q>quoted</q> <cite>Source</cite> <abbr title="HyperText">HTML</abbr> <small>s</small> <kbd>k</kbd> <ins>i</ins></li></ul></section><table border="1" class="dataframe"><caption>Results</caption><colgroup><col span="2"></colgroup><thead><tr><th scope="col">server</th><th colspan="2">elapsed</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>1</td></tr></tbody><tfoot><tr><td>sum</td></tr></tfoot></table><span class="avatar" aria-hidden="true">J</span>';
const EMBED_SRC = /^https:\/\/(?:(?:www\.)?youtube\.com|www\.youtube-nocookie\.com|player\.vimeo\.com)\//;

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); });

function render(sink: string, html: string) {
  const post = {
    id: 1, title: 'Test', meta: { slug: 'test' },
    html_detail: html, html_overview: html, podlove_players: [],
  };
  const wrapper = sink === 'description'
    ? mount(PostList, {
      props: { blog: { title: 'Blog', description: html }, posts: { items: [] } },
      global: { plugins: [createPinia()] },
    })
    : mount(PostItem, { props: { post, detail: sink === 'detail' } });
  wrappers.push(wrapper);
  return wrapper;
}

function expectSafe(root: ParentNode) {
  expect(root.querySelector('script, svg, math, object, embed, style')).toBeNull();
  root.querySelectorAll('iframe').forEach(frame => {
    expect(frame.getAttribute('src') ?? '').toMatch(EMBED_SRC);
    expect(frame.hasAttribute('srcdoc')).toBe(false);
  });
  root.querySelectorAll('*').forEach(element => {
    if (element.tagName !== 'IFRAME') {
      for (const name of ['allow', 'allowfullscreen', 'referrerpolicy']) {
        expect(element.hasAttribute(name)).toBe(false);
      }
    }
    for (const attribute of element.attributes) {
      expect(attribute.name).not.toMatch(/^on|^style$|^data-unknown$/);
      expect(attribute.value).not.toMatch(/(?:javascript|data):/i);
    }
  });
}

describe('rich text policy', () => {
  test.each(attacks)('removes active content: %s', payload => {
    const template = document.createElement('template');
    template.innerHTML = sanitizeRichText(payload);
    expectSafe(template.content);
  });

  test('preserves rendered cast formatting and media markup unchanged', () => {
    expect(sanitizeRichText(markup)).toBe(markup);
  });

  test('preserves video embeds from allowed providers unchanged', () => {
    expect(sanitizeRichText(embed)).toBe(embed);
    const nocookie = '<iframe src="https://www.youtube-nocookie.com/embed/x" title="Video"></iframe><iframe src="https://player.vimeo.com/video/1"></iframe>';
    expect(sanitizeRichText(nocookie)).toBe(nocookie);
  });

  test('drops frames from other sources entirely', () => {
    expect(sanitizeRichText('<p>a</p><iframe src="https://evil.example/"></iframe><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(sanitizeRichText('<iframe src="https://www.youtube.com/embed/x" sandbox="" srcdoc="x"></iframe>'))
      .toBe('<iframe src="https://www.youtube.com/embed/x"></iframe>');
  });

  test('preserves tables, inline semantics and ARIA labels unchanged', () => {
    expect(sanitizeRichText(tableAndSemantics)).toBe(tableAndSemantics);
  });

  test('empty descriptions are safe', () => {
    expect(sanitizeRichText(undefined)).toBe('');
    expect(sanitizeRichText(null)).toBe('');
  });
});

describe.each(['description', 'overview', 'detail'])('%s v-html sink', sink => {
  test.each(attacks)('sanitizes the mounted component: %s', payload => {
    expectSafe(render(sink, payload).element);
  });

  test('preserves cast content when mounted and when props change', async () => {
    const wrapper = render(sink, markup);
    expect(wrapper.find('article').element.outerHTML + '\n').toBe(markup);
    if (sink === 'description') {
      await wrapper.setProps({ blog: { description: attacks.join('') } });
    } else {
      await wrapper.setProps({ post: {
        ...wrapper.props('post'), html_detail: attacks.join(''), html_overview: attacks.join(''),
      } });
    }
    expectSafe(wrapper.element);
  });
});

test('gallery modal retains safe responsive sources', async () => {
  const wrapper = render('detail', markup);
  await wrapper.find('#gallery-image-1').trigger('click');
  expect(wrapper.find('#modal-image').attributes('src')).toBe('/media/full.jpg');
  expect(wrapper.find('#modal-image').attributes('srcset')).toBe('/media/full.jpg 1200w');
  expect(wrapper.find('.modal source').attributes('src')).toBe('/media/full.avif');
  expect(wrapper.find('.modal source').attributes('srcset')).toBe('/media/full.avif 1200w');
});

test('unsafe gallery URLs cannot be copied into the modal', async () => {
  const wrapper = render('detail', '<picture><source data-modal-src="javascript:alert(1)" data-modal-srcset="data:image/svg+xml,evil"><img id="gallery-image-1" src="/safe.jpg" data-fullsrc="javascript:alert(1)" data-modal-srcset="/safe.jpg 1x, data:image/png;base64,AAAA 2x"></picture>');
  await wrapper.find('#gallery-image-1').trigger('click');
  expectSafe(wrapper.element);
  expect(wrapper.find('#modal-image').attributes('src')).toBeUndefined();
});

test.each(['overview', 'detail'])('keeps audio replacement and article metadata in %s', sink => {
  const html = '<script id="vue-article-data" data-article-author="Editor" data-article-date="Nov. 9" data-article-date-time="2026-11-09"></script><section class="block-audio"><p>old player</p></section><podlove-player></podlove-player><p>keep</p>';
  const wrapper = render(sink, html);
  expect(wrapper.text()).toContain('Editor');
  expect(wrapper.text()).toContain('keep');
  expect(wrapper.text()).not.toContain('old player');
  expect(wrapper.find('.block-audio, podlove-player, script').exists()).toBe(false);
});

import { flushPromises, mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

const { store } = vi.hoisted(() => ({
  store: { fetchJson: vi.fn(), setSlugToId: vi.fn() },
}));

vi.mock('@/stores/dataStore', () => ({ useDataStore: () => store }));
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts'),
  blogDetailUrl: new URL('http://localhost/blog'),
  apiFacetCountsUrl: new URL('http://localhost/facets'),
  paginationPageSize: 10,
  dateRangeEnabled: true,
} }));

import FilterForm from '@/components/FilterForm.vue';
import Styleguide from '@/components/Styleguide.vue';

test('the styleguide keeps the complete catalog and the applied archive selection', async () => {
  store.fetchJson.mockImplementation(async (url: URL) => {
    if (url.pathname === '/facets') {
      return { facet_counts: { date_facets: [{ slug: '2026-11', name: '2026-11', count: 2 }] } };
    }
    return url.pathname === '/posts' ? { items: [], meta: { total_count: 2 } } : {};
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Styleguide }] });
  await router.push('/?theme=vue&page=2');
  const wrapper = mount(Styleguide, { global: { plugins: [router], stubs: { PostList: true, PostItem: true } } });
  await flushPromises();

  await wrapper.get('.cv-archive__years button').trigger('click');
  await flushPromises();
  expect(wrapper.findComponent(FilterForm).props('form')).toMatchObject({
    date_after: '2026-01-01', date_before: '2026-12-31', page: 1,
  });

  await wrapper.get('.cv-archive__months button').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toMatchObject({ date_facets: '2026-11', theme: 'vue', page: '1' });
  const responseUrls = store.fetchJson.mock.calls.map(([url]) => new URL(url));
  expect(responseUrls.filter((url) => url.pathname === '/facets').every((url) => url.search === '')).toBe(true);
  expect(responseUrls.at(-1)?.searchParams.get('offset')).toBe('0');
  wrapper.unmount();
});

test('the styleguide sends the default API order when switching back to Newest first', async () => {
  const postOrders: (string | null)[] = [];
  store.fetchJson.mockImplementation(async (url: URL) => {
    if (url.pathname === '/posts') {
      postOrders.push(url.searchParams.get('order'));
      return { items: [], meta: { total_count: 2 } };
    }
    return url.pathname === '/facets' ? { facet_counts: {} } : {};
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Styleguide }] });
  await router.push('/?theme=vue&order=title');
  const wrapper = mount(Styleguide, { global: { plugins: [router], stubs: { PostList: true, PostItem: true } } });
  await flushPromises();

  await wrapper.get('#id_o').setValue('');
  await flushPromises();

  expect(postOrders).toEqual(['title', '-visible_date']);
  expect(router.currentRoute.value.query).toEqual({ theme: 'vue', page: '1' });
  wrapper.unmount();
});

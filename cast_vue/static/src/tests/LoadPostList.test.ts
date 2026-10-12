import { test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), setSlugToId: vi.fn() }));
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts?child_of=1'),
  blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10
} }));
import LoadPostList from '@/components/LoadPostList.vue';
import FilterForm from '@/components/FilterForm.vue';
export async function setupList(query = '?page=3') {
  mocks.fetchJson.mockReset().mockImplementation(async (url: URL) => url.pathname === '/posts' ? { items: [], meta: { total_count: 30 } } : url.pathname === '/facets' ? { facet_counts: {} } : {});
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: LoadPostList }] });
  await router.push('/' + query); await router.isReady();
  const wrapper = mount(LoadPostList, { global: { plugins: [router], stubs: { PostList: true, SelectTheme: true } } });
  await flushPromises();
  return { wrapper, router };
}
test('filter resets page and both API offsets', async () => {
  const { wrapper, router } = await setupList();
  wrapper.findComponent(FilterForm).vm.$emit('submitFilterForm', { search: 'rare', page: '3' });
  await flushPromises();
  expect(router.currentRoute.value.query.page).toBe('1');
  expect(wrapper.vm.currentPage).toBe(1);
  expect(wrapper.findComponent(FilterForm).props('form').page).toBe(1);
  const urls = mocks.fetchJson.mock.calls.slice(-3).map(call => call[0] as URL);
  expect(urls[1].searchParams.get('offset')).toBe('0');
  expect(urls[2].searchParams.get('offset')).toBe('0');
  wrapper.unmount();
});

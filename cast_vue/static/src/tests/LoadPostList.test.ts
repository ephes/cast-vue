import { afterEach, test, expect, vi } from 'vitest';
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), setSlugToId: vi.fn(), dateRangeEnabled: true }));
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts?child_of=1'),
  blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10,
  get dateRangeEnabled() { return mocks.dateRangeEnabled; },
} }));
import LoadPostList from '@/components/LoadPostList.vue';
import FilterForm from '@/components/FilterForm.vue';
import PostList from '@/components/PostList.vue';

enableAutoUnmount(afterEach);

async function setupList(query = '?page=3', {
  dateRangeEnabled = true, failFilteredRequest = false, failFacetRequest = false, attach = false,
} = {}) {
  mocks.dateRangeEnabled = dateRangeEnabled;
  mocks.fetchJson.mockReset().mockImplementation(async (url: URL) => {
    if (url.pathname === '/posts') {
      if (failFilteredRequest && url.searchParams.has('tag_facets')) throw new Error('filtered request failed');
      return { items: [{ id: 1, title: 'Django post', meta: { slug: 'django-post' } }], meta: { total_count: 30 } };
    }
    if (url.pathname === '/facets' && failFacetRequest) throw new Error('facet counts unavailable');
    return url.pathname === '/facets' ? { facet_counts: {} } : {};
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: LoadPostList }] });
  await router.push('/' + query); await router.isReady();
  const wrapper = mount(LoadPostList, {
    attachTo: attach ? document.body : undefined,
    global: { plugins: [router], stubs: { PostList: true, SelectTheme: true } },
  });
  await flushPromises();
  return { wrapper, router };
}
test('filter resets the post offset and keeps the facet catalog unfiltered', async () => {
  const { wrapper, router } = await setupList();
  wrapper.findComponent(FilterForm).vm.$emit('submitFilterForm', { search: 'rare', page: '3' });
  await flushPromises();
  expect(router.currentRoute.value.query.page).toBe('1');
  expect(wrapper.vm.currentPage).toBe(1);
  expect(wrapper.findComponent(FilterForm).props('form')!.page).toBe(1);
  const urls = mocks.fetchJson.mock.calls.slice(-3).map(call => call[0] as URL);
  expect(urls[1].search).toBe('');
  expect(urls[2].searchParams.get('offset')).toBe('0');
});

test('sort changes the post request while keeping the theme preview in the route', async () => {
  const { wrapper, router } = await setupList('?theme=vue&page=3');
  const sort = wrapper.get<HTMLSelectElement>('#id_o');
  await sort.setValue('visible_date');
  await flushPromises();

  expect(router.currentRoute.value.query).toEqual({ theme: 'vue', order: 'visible_date', page: '1' });
  let postUrl = mocks.fetchJson.mock.calls.at(-1)![0] as URL;
  expect(postUrl.searchParams.get('order')).toBe('visible_date');
  expect(postUrl.searchParams.has('theme')).toBe(false);

  await wrapper.get('.cv-active-filters .cv-button').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({ theme: 'vue' });
  postUrl = mocks.fetchJson.mock.calls.at(-1)![0] as URL;
  expect(postUrl.searchParams.get('order')).toBe('-visible_date');
  expect(sort.element.value).toBe('');
});

test('posts and available controls render when the facet counts request fails', async () => {
  const { wrapper } = await setupList('?tag_facets=django', { dateRangeEnabled: false, failFacetRequest: true });
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.getComponent(PostList).props('posts')?.items[0].title).toBe('Django post');
  expect(wrapper.get('.cv-list-summary [role="status"]').text()).toBe('30 posts found · page 1 of 3');
  await wrapper.get('.cv-filters__toggle').trigger('click');
  expect(wrapper.get('#id_search').isVisible()).toBe(true);
  expect(wrapper.get('#id_o').isVisible()).toBe(true);
  expect(wrapper.find('#id_date_0').exists()).toBe(false);
  expect(wrapper.find('[placeholder="Find a tag"]').exists()).toBe(false);
  expect(wrapper.get('[aria-label="Remove filter: Tag: django"]').isVisible()).toBe(true);
});

test('ignores unsupported bounds in shared URLs and preserves the month filter', async () => {
  const { wrapper } = await setupList('?date_after=2024-01-01&date_before=2024-12-31&date_facets=2026-11', {
    dateRangeEnabled: false,
  });
  expect(wrapper.findComponent(FilterForm).props('dateRangeEnabled')).toBe(false);
  expect(wrapper.get('[aria-label="Active filters"]').text()).toContain('Nov 2026');
  expect(wrapper.find('[aria-label="Remove filter: 2024"]').exists()).toBe(false);
  const postUrl = mocks.fetchJson.mock.calls.at(-1)![0] as URL;
  expect(postUrl.searchParams.has('date_after')).toBe(false);
  expect(postUrl.searchParams.has('date_before')).toBe(false);
  expect(postUrl.searchParams.get('date_facets')).toBe('2026-11');
});

test.each([true, false])('filters remain removable beside Retry after a failure (initial: %s)', async (initial) => {
  const failedQuery = '?search=testing&tag_facets=django';
  const { wrapper, router } = await setupList(initial ? failedQuery : '', { failFilteredRequest: true });
  if (!initial) {
    await router.push('/' + failedQuery);
    await flushPromises();
  }
  const filters = wrapper.get('[aria-label="Active filters"]');
  expect(wrapper.get('[role="alert"] button').text()).toBe('Retry');
  expect(wrapper.find('.cv-list-summary [role="status"]').exists()).toBe(false);
  await filters.get('[aria-label="Remove filter: Search: testing"]').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({ tag_facets: 'django', page: '1' });
  expect(wrapper.get('[role="alert"] button').text()).toBe('Retry');

  await wrapper.get('[aria-label="Active filters"] .cv-button').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({});
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.find('[aria-label="Active filters"]').exists()).toBe(false);
  expect(wrapper.get('.cv-list-summary [role="status"]').text()).toContain('30 posts');
});

test.each([
  { control: '.cv-active-filters .cv-button', replacementFails: false },
  { control: '.cv-active-filters .cv-chip', replacementFails: false },
  { control: '.cv-active-filters .cv-chip', replacementFails: true },
])('filter recovery restores focus after rendering ($control, fails: $replacementFails)', async ({ control, replacementFails }) => {
  const { wrapper } = await setupList('?tag_facets=django', { failFilteredRequest: true, attach: true });
  const originalFetch = mocks.fetchJson.getMockImplementation()!;
  let finishPosts!: () => void;
  mocks.fetchJson.mockImplementation((url: URL) => {
    if (url.pathname !== '/posts') return originalFetch(url);
    return new Promise((resolve, reject) => {
      finishPosts = () => {
        if (replacementFails) reject(new Error('replacement request failed'));
        else resolve({ items: [], meta: { total_count: 30 } });
      };
    });
  });

  const button = wrapper.get<HTMLButtonElement>(control);
  button.element.focus();
  await button.trigger('click');
  await flushPromises();
  expect(wrapper.find('.cv-skeleton').exists()).toBe(true);
  expect(document.activeElement).toBe(document.body);

  finishPosts();
  await flushPromises();
  const target = replacementFails ? '[role="alert"] button' : '.cv-list-summary [role="status"]';
  expect(document.activeElement).toBe(wrapper.get(target).element);
});

test('active chips remove their filter and Clear all resets the route', async () => {
  const { wrapper, router } = await setupList('?tag_facets=django&search=testing&date_after=2024-01-01&date_before=2024-12-31&page=3');
  const filters = wrapper.get('[aria-label="Active filters"]');
  expect(filters.text()).toContain('Search: testing');
  expect(filters.text()).toContain('2024');
  expect(wrapper.get('.cv-filters__toggle .cv-count').text()).toBe('3');
  await filters.get('[aria-label="Remove filter: Tag: django"]').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({
    search: 'testing', date_after: '2024-01-01', date_before: '2024-12-31', page: '1',
  });
  await filters.get('[aria-label="Remove filter: 2024"]').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({ search: 'testing', page: '1' });
  await filters.get('.cv-button').trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.query).toEqual({});
  expect(wrapper.find('[aria-label="Active filters"]').exists()).toBe(false);
});

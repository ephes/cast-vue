import { test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), setSlugToId: vi.fn(), slugToPost: {} }));
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts?child_of=1'),
  blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10, pageType: 'cast.Post'
} }));
import LoadPostList from '@/components/LoadPostList.vue';
import PostDetail from '@/components/PostDetail.vue';
import FilterForm from '@/components/FilterForm.vue';
async function setup(path: string, component: any, initial: string) {
  mocks.fetchJson.mockReset().mockImplementation(async (url: URL) => url.pathname === '/posts' ? {
    items: [{ id: 1, title: url.searchParams.get('slug') || url.searchParams.get('search') || 'all', meta: { slug: url.searchParams.get('slug') || 'a' } }], meta: { total_count: 30 }
  } : url.pathname === '/facets' ? { facet_counts: {} } : {});
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }] });
  await router.push(initial); await router.isReady();
  const wrapper = mount(RouterView, { global: { plugins: [router], stubs: {
    PostList: { props: ['posts'], template: '<article>{{ posts.items[0]?.title }}</article>' },
    PostItem: { name: 'PostItem', props: ['post'], template: '<article>{{ post.title }}</article>' }, SelectTheme: true
  } } });
  await flushPromises();
  return { wrapper, router };
}
test('list follows query navigation and history in the same component', async () => {
  const { wrapper, router } = await setup('/', LoadPostList, '/?search=first&page=1');
  const instance = wrapper.findComponent(LoadPostList).vm;
  await router.push('/?search=second&page=2'); await flushPromises();
  expect(wrapper.findComponent(LoadPostList).vm.$.uid).toBe(instance.$.uid);
  expect(wrapper.text()).toContain('second');
  expect(wrapper.findComponent(FilterForm).props('form')).toMatchObject({ search: 'second', page: 2 });
  expect(mocks.fetchJson.mock.calls.at(-1)![0].searchParams.get('offset')).toBe('10');
  expect(mocks.fetchJson).toHaveBeenCalledTimes(6);
  router.back(); await vi.waitFor(() => expect(router.currentRoute.value.query.search).toBe('first')); await flushPromises();
  expect(wrapper.text()).toContain('first');
  expect(wrapper.findComponent(FilterForm).props('form')).toMatchObject({ search: 'first', page: 1 });
  expect(mocks.fetchJson.mock.calls.at(-1)![0].searchParams.get('offset')).toBe('0');
  router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.query.search).toBe('second')); await flushPromises();
  expect(wrapper.text()).toContain('second');
  // A local pagination control uses the same watcher, one load only.
  const filterUid = wrapper.findComponent(FilterForm).vm.$.uid;
  const count = mocks.fetchJson.mock.calls.length;
  await instance.changePage(1); await flushPromises();
  expect(mocks.fetchJson).toHaveBeenCalledTimes(count + 3);
  expect(router.currentRoute.value.query.page).toBe('3');
  expect(wrapper.findComponent(FilterForm).vm.$.uid).toBe(filterUid);
  wrapper.unmount();
});
test('detail follows slug navigation, history and comment invalidation', async () => {
  const { wrapper, router } = await setup('/:slug/', PostDetail, '/a/');
  const instance = wrapper.findComponent(PostDetail).vm;
  await router.push('/b/'); await flushPromises();
  expect(wrapper.findComponent(PostDetail).vm.$.uid).toBe(instance.$.uid);
  expect(wrapper.find('article').text()).toBe('b');
  router.back(); await vi.waitFor(() => expect(router.currentRoute.value.params.slug).toBe('a')); await flushPromises();
  expect(wrapper.find('article').text()).toBe('a');
  router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.params.slug).toBe('b')); await flushPromises();
  expect(wrapper.find('article').text()).toBe('b');
  await instance.handleCommentPosted();
  expect(mocks.fetchJson.mock.calls.at(-1)![1]).toBe(true);
  expect(mocks.fetchJson.mock.calls.map(call => call[0].searchParams.get('slug'))).toEqual(['a', 'b', 'a', 'b', 'b']);
  wrapper.unmount();
});

test('initial list load does not start a second route transition', async () => {
  const { notifyContentReady, resetViewTransitionsForTests } = await import('@/helpers/viewTransitions');
  const start = vi.fn();
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true });
  notifyContentReady(0);
  try {
    const { wrapper } = await setup('/', LoadPostList, '/');
    expect(start).not.toHaveBeenCalled();
    wrapper.unmount();
  } finally {
    delete (document as any).startViewTransition;
    resetViewTransitionsForTests();
  }
});
test('comment refresh keeps the current PostItem mounted', async () => {
  const { wrapper } = await setup('/:slug/', PostDetail, '/a/');
  const item = wrapper.findComponent({ name: 'PostItem' });
  const uid = item.vm.$.uid;
  let resolve!: (data: any) => void;
  mocks.fetchJson.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  const refresh = wrapper.findComponent(PostDetail).vm.handleCommentPosted();
  await flushPromises();
  expect(wrapper.findComponent({ name: 'PostItem' }).vm.$.uid).toBe(uid);
  resolve({ items: [{ id: 1, title: 'a updated', meta: { slug: 'a' } }] });
  await refresh; await flushPromises();
  expect(wrapper.findComponent({ name: 'PostItem' }).vm.$.uid).toBe(uid);
  wrapper.unmount();
});

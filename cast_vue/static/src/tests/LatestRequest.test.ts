import { test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), setSlugToId: vi.fn() }));
vi.mock('@/stores/dataStore', () => ({ useDataStore: () => mocks }));
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts'), blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10
} }));
import LoadPostList from '@/components/LoadPostList.vue';
import FilterForm from '@/components/FilterForm.vue';
import { CONTENT_READY_EVENT } from '@/helpers/viewTransitions';
function deferred() { let resolve!: (value: any) => void; let reject!: (error: Error) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
test.each(['success', 'error'])('obsolete %s cannot replace the latest posts, facets, blog or readiness', async outcome => {
  const calls: { url: URL, task: ReturnType<typeof deferred> }[] = [];
  mocks.fetchJson.mockReset().mockImplementation((url: URL) => { const task = deferred(); calls.push({ url: new URL(url), task }); return task.promise; });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: LoadPostList }] });
  await router.push('/?page=2'); await router.isReady();
  const wrapper = mount(LoadPostList, { global: { plugins: [router], stubs: { PostList: { props: ['blog', 'posts'], template: '<article>{{ blog.title }} {{ posts.items[0]?.title }}</article>' }, SelectTheme: true } } });
  await flushPromises();
  await router.push('/?search=new'); await flushPromises();
  const ready = vi.fn(); window.addEventListener(CONTENT_READY_EVENT, ready);
  function finish(generation: number, name: string, fail = false) {
    for (const path of ['/blog', '/facets', '/posts']) {
      const { task } = calls.filter((call) => call.url.pathname === path)[generation];
      if (fail) task.reject(new Error('obsolete failure'));
      else if (path === '/blog') task.resolve({ title: `${name} blog` });
      else if (path === '/facets') task.resolve({ facet_counts: { tag_facets: [{ slug: name, name, count: 1 }] } });
      else task.resolve({ items: [{ id: 1, title: name, meta: { slug: name } }], meta: { total_count: 1 } });
    }
  }
  finish(1, 'new'); await flushPromises();
  expect(wrapper.text()).toContain('new blog new');
  expect(wrapper.findComponent(FilterForm).props('facetCounts')!.tag_facets[0].name).toBe('new');
  const readyCount = ready.mock.calls.length;
  finish(0, 'old', outcome === 'error'); await flushPromises();
  expect(wrapper.text()).toContain('new blog new');
  expect(wrapper.findComponent(FilterForm).props('facetCounts')!.tag_facets[0].name).toBe('new');
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(ready).toHaveBeenCalledTimes(readyCount);
  expect(readyCount).toBe(1);
  window.removeEventListener(CONTENT_READY_EVENT, ready); wrapper.unmount();
});

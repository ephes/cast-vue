import { test, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts'), blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10, pageType: 'cast.Post'
} }));
import LoadPostList from '@/components/LoadPostList.vue';
import PostDetail from '@/components/PostDetail.vue';
const post = { id: 1, title: 'Recovered post', meta: { slug: 'a' }, html_detail: '<p>Recovered</p>', podlove_players: [] };
afterEach(() => vi.unstubAllGlobals());
test.each(['list', 'detail'])('stable %s error, empty and retry states', async kind => {
  let outcome = 'http';
  let finishRetry!: (response: any) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
    if (url.pathname === '/posts') {
      if (outcome === 'pending') return new Promise(resolve => { finishRetry = resolve; });
      if (outcome === 'network') throw new Error('offline');
      if (outcome === 'http') return { ok: false, status: 500 };
      return { ok: true, json: async () => outcome === 'malformed' ? { items: [] } : { items: outcome === 'empty' ? [] : [post], meta: { total_count: outcome === 'empty' ? 0 : 1 } } };
    }
    return { ok: true, json: async () => url.pathname === '/facets' ? { facet_counts: {} } : { title: 'Blog' } };
  }));
  const component = kind === 'list' ? LoadPostList : PostDetail;
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:slug?', name: 'PostDetail', component }] });
  await router.push('/a'); await router.isReady();
  const errors = vi.fn();
  const wrapper = mount(component, { global: { plugins: [router, createPinia()], config: { errorHandler: errors }, stubs: { SelectTheme: true } } });
  await flushPromises();
  expect(wrapper.find('[role="alert"]').text()).toContain('Could not load');
  outcome = 'pending'; await wrapper.find('button').trigger('click'); await flushPromises();
  expect(wrapper.text()).toContain('Loading data...');
  expect(wrapper.text()).not.toContain('No posts found.');
  expect(wrapper.text()).not.toContain('Post not found.');
  finishRetry({ ok: false, status: 500 }); await flushPromises();
  outcome = 'network'; await wrapper.find('button').trigger('click'); await flushPromises();
  expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  if (kind === 'list') {
    outcome = 'malformed'; await wrapper.find('button').trigger('click'); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.vm.totalPages).toBe(0);
  }
  outcome = 'empty'; await wrapper.find('button').trigger('click'); await flushPromises();
  expect(wrapper.text()).toContain(kind === 'list' ? 'No posts found.' : 'Post not found.');
  expect(wrapper.findComponent({ name: 'PostItem' }).exists()).toBe(false);
  outcome = 'success';
  if (kind === 'list') await wrapper.vm.fetchData(true); else await wrapper.vm.fetchPostFromAPI(true);
  await flushPromises();
  expect(wrapper.text()).toContain('Recovered post');
  if (kind === 'list') {
    outcome = 'network'; await wrapper.vm.fetchData(true); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'PostItem' }).exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Recovered post');
  }
  if (kind === 'detail') {
    const uid = wrapper.findComponent({ name: 'PostItem' }).vm.$.uid;
    outcome = 'network'; await wrapper.vm.fetchPostFromAPI(true); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'PostItem' }).vm.$.uid).toBe(uid);
  }
  expect(errors).not.toHaveBeenCalled();
  wrapper.unmount();
});

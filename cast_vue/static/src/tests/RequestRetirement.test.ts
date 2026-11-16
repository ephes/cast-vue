import { afterEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
vi.mock('@/config', () => ({ default: {
  postListUrl: new URL('http://localhost/posts'), blogDetailUrl: new URL('http://localhost/blog'), apiFacetCountsUrl: new URL('http://localhost/facets'), paginationPageSize: 10
} }));
import PostDetail from '@/components/PostDetail.vue';
import LoadPostList from '@/components/LoadPostList.vue';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test.each([PostDetail, LoadPostList])('view retirement cancels its transports and deadline exposes Retry', async component => {
  const signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', vi.fn((_url, init) => { signals.push(init.signal); return new Promise(() => {}); }));
  vi.useFakeTimers();
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:slug', component }] });
  await router.push('/one');
  const wrapper = mount(component, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  await vi.advanceTimersByTimeAsync(15000);
  await flushPromises();
  expect(wrapper.find('[role="alert"]').text()).toContain('Could not load');
  await wrapper.find('[role="alert"] button').trigger('click');
  await flushPromises();
  expect(signals.at(-1)!.aborted).toBe(false);
  wrapper.unmount();
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

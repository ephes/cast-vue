import { afterEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PodlovePlayer from '@/components/PodlovePlayer.vue';
const props = { elementId: 'synthetic-audio', apiUrl: '/episode/a', playerConfig: new URL('http://localhost/config') };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test('source and config changes isolate late initialization and unmount retires the current container', async () => {
  const pending: { host: HTMLElement, resolve: () => void }[] = [];
  const init = vi.fn((host: HTMLElement) => new Promise<void>(resolve => { pending.push({ host, resolve }); }));
  vi.stubGlobal('podlovePlayer', init);
  const wrapper = mount(PodlovePlayer, { props, attachTo: document.body });
  await wrapper.setProps({ apiUrl: '/episode/b' });
  await flushPromises();
  expect(init).toHaveBeenCalledTimes(2);
  pending[0].host.innerHTML = '<iframe data-source="old"></iframe>';
  pending[0].resolve(); await flushPromises();
  expect(wrapper.find('[data-source="old"]').exists()).toBe(false);
  expect(pending[0].host.isConnected).toBe(false);
  await wrapper.setProps({ playerConfig: new URL('http://localhost/new-config') });
  await flushPromises();
  expect(init).toHaveBeenCalledTimes(3);
  expect(pending[1].host.isConnected).toBe(false);
  pending[2].host.innerHTML = '<iframe data-source="current"></iframe>';
  pending[2].resolve(); await flushPromises();
  expect(wrapper.find('[data-source="current"]').exists()).toBe(true);
  wrapper.unmount();
  expect(pending[2].host.innerHTML).toBe('');
  pending[1].host.innerHTML = '<iframe></iframe>';
  pending[1].resolve(); await flushPromises();
  expect(pending[1].host.innerHTML).toBe('');
});

test.each(['missing', 'throws', 'rejects', 'stalls'])('%s initialization exposes a working retry', async outcome => {
  vi.useFakeTimers();
  let lateHost: HTMLElement | undefined;
  let resolveLate!: () => void;
  const broken = outcome === 'missing' ? undefined : vi.fn((host: HTMLElement) => {
    if (outcome === 'throws') throw new Error('synthetic failure');
    if (outcome === 'rejects') return Promise.reject(new Error('synthetic failure'));
    lateHost = host;
    return new Promise<void>(resolve => { resolveLate = resolve; });
  });
  vi.stubGlobal('podlovePlayer', broken);
  const wrapper = mount(PodlovePlayer, { props });
  await flushPromises();
  if (outcome === 'stalls') { await vi.advanceTimersByTimeAsync(15000); await flushPromises(); }
  expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  const working = vi.fn((host: HTMLElement) => { host.innerHTML = '<iframe data-source="retry"></iframe>'; return Promise.resolve(); });
  vi.stubGlobal('podlovePlayer', working);
  await wrapper.find('button').trigger('click'); await flushPromises();
  expect(working).toHaveBeenCalledOnce();
  expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  expect(wrapper.find('[data-source="retry"]').exists()).toBe(true);
  if (lateHost) {
    lateHost.innerHTML = '<iframe data-source="late"></iframe>';
    resolveLate(); await flushPromises();
    expect(wrapper.find('[data-source="late"]').exists()).toBe(false);
    expect(lateHost.innerHTML).toBe('');
  }
  wrapper.unmount();
});

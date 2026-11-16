import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDataStore } from '@/stores/dataStore';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

test('an older load cannot overwrite a completed invalidating refresh', async () => {
  const old = deferred<Response>();
  const fetch = vi.fn().mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(new Response(JSON.stringify({ comments: ['new'] })));
  vi.stubGlobal('fetch', fetch);
  const store = useDataStore();
  const url = new URL('http://localhost/posts?slug=one');
  const first = store.fetchJson(url);
  await store.fetchJson(url, true);
  old.resolve(new Response(JSON.stringify({ comments: ['old'] })));
  await first;
  expect(await store.fetchJson(url)).toEqual({ comments: ['new'] });
  expect(fetch).toHaveBeenCalledTimes(2);
});

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

test('JSON and slug caches evict oldest entries while callers retain visible values', async () => {
  const fetch = vi.fn(async (url: URL) => new Response(JSON.stringify({ title: url.search })));
  vi.stubGlobal('fetch', fetch);
  const store = useDataStore();
  const visible = await store.fetchJson(new URL('http://localhost/posts?i=0'));
  for (let i = 1; i <= 40; i++) await store.fetchJson(new URL(`http://localhost/posts?i=${i}`));
  expect(Object.keys(store.jsonCache)).toHaveLength(32);
  expect(store.jsonCache['http://localhost/posts?i=0']).toBeUndefined();
  expect(visible).toEqual({ title: '?i=0' });
  for (let i = 0; i < 150; i++) store.setSlugToId({ items: [{ id: i, meta: { slug: `s${i}` } }] } as any);
  expect(Object.keys(store.slugToPost)).toHaveLength(128);
  expect(store.slugToPost.s0).toBeUndefined();
});

test.each(['absent', 'understated'])('oversize streamed response with %s length is cancelled without cache publication', async length => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('"' + 'x'.repeat(2 * 1024 * 1024)));
    }, cancel
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: length === 'absent' ? {} : { 'Content-Length': '1' } })));
  const store = useDataStore();
  await expect(store.fetchJson(new URL('http://localhost/large'))).rejects.toThrow();
  expect(cancel).toHaveBeenCalledOnce();
  expect(Object.keys(store.jsonCache)).toHaveLength(0);
  expect(Object.keys(store.slugToPost)).toHaveLength(0);
});

test('serialized byte budgets evict large entries and admit an exact-limit response', async () => {
  const text = JSON.stringify({ body: 'x'.repeat(2 * 1024 * 1024 - 11) });
  expect(new TextEncoder().encode(text).byteLength).toBe(2 * 1024 * 1024);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(text)));
  const store = useDataStore();
  for (let i = 0; i < 5; i++) await store.fetchJson(new URL(`http://localhost/large?i=${i}`));
  expect(Object.keys(store.jsonCache).length).toBeLessThan(5);
  for (let i = 0; i < 5; i++) store.setSlugToId({ items: [{ body: text, meta: { slug: `large${i}` } }] } as any);
  expect(Object.keys(store.slugToPost).length).toBeLessThan(5);
});

test.each(['headers', 'body'])('a stalled %s operation expires after the total deadline', async stage => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const fetch = vi.fn(stage === 'headers' ? () => new Promise(() => {}) : async () => new Response(new ReadableStream({ cancel })));
  vi.stubGlobal('fetch', fetch);
  try {
    const result = useDataStore().fetchJson(new URL('http://localhost/stalled'));
    const check = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15000);
    await check;
    expect((fetch.mock.calls[0] as any[])[1].signal.aborted).toBe(true);
    if (stage === 'body') expect(cancel).toHaveBeenCalledOnce();
    expect(Object.keys(useDataStore().jsonCache)).toHaveLength(0);
  } finally { vi.useRealTimers(); }
});

test('retiring one consumer leaves another request alive and fences late headers', async () => {
  const old = deferred<Response>();
  const next = deferred<Response>();
  const fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  vi.stubGlobal('fetch', fetch);
  const store = useDataStore();
  const url = new URL('http://localhost/shared');
  const owner = new AbortController();
  const retired = store.fetchJson(url, false, owner.signal);
  const check = expect(retired).rejects.toThrow();
  const live = store.fetchJson(url);
  owner.abort();
  await check;
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(false);
  next.resolve(new Response('{"title":"current"}'));
  await live;
  const cancel = vi.fn();
  old.resolve(new Response(new ReadableStream({ cancel })));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(cancel).toHaveBeenCalledOnce();
  expect(await store.fetchJson(url)).toEqual({ title: 'current' });
});

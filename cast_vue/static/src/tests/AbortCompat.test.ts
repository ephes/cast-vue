import { afterEach, expect, test, vi } from 'vitest';
import { fetchJson } from '@/helpers/fetchJson';

const original = AbortSignal.prototype.throwIfAborted;
afterEach(() => { AbortSignal.prototype.throwIfAborted = original; vi.unstubAllGlobals(); });

test('JSON reads work in engines without AbortSignal.throwIfAborted', async () => {
  // @ts-expect-error simulate an engine that predates throwIfAborted
  delete AbortSignal.prototype.throwIfAborted;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}')));
  const owner = new AbortController();
  await expect(fetchJson(new URL('http://localhost/api'), {}, owner.signal)).resolves.toEqual({ ok: true });
  owner.abort();
  await expect(fetchJson(new URL('http://localhost/api'), {}, owner.signal)).rejects.toBeTruthy();
});

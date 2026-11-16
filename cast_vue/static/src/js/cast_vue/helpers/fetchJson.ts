import { readJsonResponse } from './readJsonResponse';
import { throwIfAborted } from './abort';

export const REQUEST_DEADLINE_MS = 15000;

// Each call owns its transport. Cancelling it cannot abort another consumer.
export async function fetchJson(url: URL, init: RequestInit = {}, signal?: AbortSignal): Promise<any> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const retire = () => controller.abort(new Error('JSON request cancelled'));
  let rejectCancelled!: (reason: Error) => void;
  const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const onAbort = () => rejectCancelled(new Error('JSON request cancelled or timed out'));
  controller.signal.addEventListener('abort', onAbort, { once: true });
  signal?.addEventListener('abort', retire, { once: true });
  const timeout = setTimeout(retire, REQUEST_DEADLINE_MS);
  try {
    const work = (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal });
      return readJsonResponse(response, controller.signal);
    })();
    return await Promise.race([work, cancelled]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', retire);
    controller.signal.removeEventListener('abort', onAbort);
  }
}

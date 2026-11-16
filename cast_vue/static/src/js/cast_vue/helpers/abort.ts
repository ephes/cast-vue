// AbortSignal.throwIfAborted() is missing in older engines (Safari < 15.4).
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error('Request aborted');
}

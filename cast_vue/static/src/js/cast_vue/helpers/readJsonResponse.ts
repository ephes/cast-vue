// Count actual UTF-8 bytes before parsing; Content-Length alone is not trusted.
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function readJsonResponse(response: Response): Promise<any> {
  if (!response.ok) throw new Error('JSON request failed');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing JSON body');
  let finished = false;
  try {
    if (Number(response.headers.get('Content-Length')) > MAX_RESPONSE_BYTES) {
      throw new Error('JSON response too large');
    }
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) { finished = true; break; }
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('JSON response too large');
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(body));
  } finally {
    if (!finished) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

import { flushPromises } from '@vue/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { initFeedCopy } from '@/helpers/feedCopy';

const mp3Url = 'https://show.example/show/feed/podcast/mp3/rss.xml';
const opusUrl = 'https://show.example/show/feed/podcast/opus/rss.xml';

function addCopy(url: string, showUrl = true) {
  document.body.insertAdjacentHTML('beforeend', `
    <div data-cv-feed-copy>
      <input type="text" value="${url}" readonly data-cv-copy-url ${showUrl ? '' : 'hidden'}>
      <button data-cv-copy-button hidden><span data-cv-copy-label>Copy</span></button>
      <span role="status" class="cv-sr-only" data-cv-copy-status data-copied="Copied"
            data-selected="URL selected. Copy it using your device."></span>
    </div>`);
  const row = document.body.lastElementChild!;
  return {
    input: row.querySelector('input')!,
    button: row.querySelector('button')!,
    status: row.querySelector('[role="status"]')!,
  };
}

function stubClipboard(writeText?: (value: string) => Promise<void>) {
  vi.stubGlobal('navigator', { clipboard: writeText && { writeText } });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

test('reveals the button, copies the URL, and updates the label and live status', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  const { button, status } = addCopy(mp3Url);
  expect(button.hidden).toBe(true);
  initFeedCopy();
  initFeedCopy();
  expect(button.hidden).toBe(false);
  button.click();
  await flushPromises();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(mp3Url);
  expect(button.textContent).toBe('Copied');
  expect(status.textContent).toBe('Copied');
});

test('copies the absolute RSS URL for an alternate format without revealing its input', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard(writeText);
  const recommended = addCopy(mp3Url);
  const alternate = addCopy(opusUrl, false);
  initFeedCopy();
  alternate.button.click();
  await flushPromises();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(opusUrl);
  expect(alternate.input.hidden).toBe(true);
  expect(alternate.button.textContent).toBe('Copied');
  expect(alternate.status.textContent).toBe('Copied');
  expect(recommended.button.textContent).toBe('Copy');
  expect(recommended.status.textContent).toBe('');
});

test.each([
  { denied: false, showUrl: true },
  { denied: true, showUrl: true },
  { denied: true, showUrl: false },
])('selects the entire URL when clipboard access fails ($denied, visible input $showUrl)', async ({ denied, showUrl }) => {
  stubClipboard(denied ? vi.fn().mockRejectedValue(new Error('Permission denied')) : undefined);
  const url = showUrl ? mp3Url : opusUrl;
  const { button, input, status } = addCopy(url, showUrl);
  initFeedCopy();
  button.click();
  await flushPromises();
  expect(input.hidden).toBe(false);
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(url.length);
  expect(button.textContent).toBe('Copy');
  expect(status.textContent).toContain('URL selected');
  expect(status.classList.contains('cv-sr-only')).toBe(false);
});

test('initializes safely on a page without copy controls', () => {
  expect(() => initFeedCopy()).not.toThrow();
});

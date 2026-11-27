import { afterEach, expect, test, vi } from 'vitest';
import { setColorScheme } from '@/helpers/colorScheme';
import { memoryStorage } from './fixtures';

const templates = import.meta.glob<string>('../../../templates/cast/vue/*.html', {
  eager: true, query: '?raw', import: 'default',
});
const base = templates['../../../templates/cast/vue/base.html'];
const [, headScriptTag, headScript] = base.match(/(<script[^>]*>)([\s\S]*?)<\/script>/)!;

afterEach(() => vi.unstubAllGlobals());

function readPrePaintTheme(storage: Pick<Storage, 'getItem'>): string | null {
  const page = document.implementation.createHTMLDocument();
  new Function('localStorage', 'document', headScript)(storage, page);
  return page.documentElement.getAttribute('data-theme');
}

test('full-page Vue templates inherit the pre-paint script in the shared head', () => {
  const pageTemplates = Object.entries(templates).filter(([, source]) => /{% extends |<!DOCTYPE html>/i.test(source));
  expect(pageTemplates.length).toBeGreaterThan(1);
  for (const [path, source] of pageTemplates) {
    let shell = source;
    const visited = new Set([source]);
    let parent = shell.match(/{% extends "\.\/(.+?\.html)" %}/);
    while (parent) {
      shell = templates[`../../../templates/cast/vue/${parent[1]}`];
      expect(shell, `Parent template of ${path}`).toBeDefined();
      expect(visited.has(shell), `Inheritance cycle in ${path}`).toBe(false);
      visited.add(shell);
      parent = shell.match(/{% extends "\.\/(.+?\.html)" %}/);
    }
    expect(shell, `Page shell of ${path}`).toBe(base);
  }
  const head = base.split('<head>')[1].split('</head>')[0];
  expect(head).toContain('<meta name="color-scheme" content="light dark">');
  expect(head.indexOf(headScript)).toBeLessThan(head.indexOf('{% vite_asset'));
  expect(head).toContain(headScript);
});

test('the pre-paint script renders the lazy CSP nonce and omits the attribute when it is absent', () => {
  expect(headScriptTag).toBe('<script{% if csp_nonce is not None %} nonce="{{ csp_nonce }}"{% endif %}>');
});

test.each([
  ['dark', 'light', 'dark'],
  ['invalid', 'dark', null],
  [null, 'light', 'light'],
  [null, null, null],
] as const)('pre-paint applies the shared (%s) or legacy (%s) preference', (shared, legacy, expected) => {
  const storage = memoryStorage();
  if (shared !== null) storage.setItem('cast-color-scheme', shared);
  if (legacy !== null) storage.setItem('cast-vue:color-scheme', legacy);
  storage.setItem('cast-react-color-scheme', 'dark');
  expect(readPrePaintTheme(storage)).toBe(expected);
});

test('pre-paint follows System after clearing a shared preference and both legacy keys', () => {
  const storage = memoryStorage();
  storage.setItem('cast-color-scheme', 'light');
  storage.setItem('cast-vue:color-scheme', 'dark');
  storage.setItem('cast-react-color-scheme', 'dark');
  vi.stubGlobal('localStorage', storage);

  expect(readPrePaintTheme(storage)).toBe('light');
  setColorScheme('system');

  expect(storage.length).toBe(0);
  expect(readPrePaintTheme(storage)).toBeNull();
});

test('pre-paint leaves the device preference in effect when storage throws', () => {
  const storage = { getItem: () => { throw new Error('Storage unavailable'); } };
  expect(readPrePaintTheme(storage)).toBeNull();
});

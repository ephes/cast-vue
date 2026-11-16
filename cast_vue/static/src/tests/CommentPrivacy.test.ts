import { afterEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CommentList from '@/components/CommentList.vue';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
test.each(['success', 'moderated', 'validation', 'network', 'http'])('console redacts private material on %s', async outcome => {
  const spies = ['log', 'info', 'debug', 'warn', 'error'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
  const privateValues = ['synthetic-private-comment', 'reader-private@example.invalid', 'synthetic-private-csrf', 'synthetic-private-hash', 'synthetic-moderation-detail'];
  const fetch = vi.fn().mockImplementation(async () => {
    if (outcome === 'network') throw new Error(privateValues.join(' '));
    return { ok: outcome !== 'http', status: 500, json: async () => ({ success: outcome === 'success', is_moderated: outcome === 'moderated', errors: [privateValues[4]] }) };
  });
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: {
    content_type: 'cast.post', object_pk: '1', timestamp: '0', commentsAreEnabled: true,
    postCommentUrl: new URL('/comments', window.location.href), csrfToken: privateValues[2], security_hash: privateValues[3]
  } } });
  const complete = vi.fn();
  wrapper.vm.submitComment({ comment: privateValues[0], email: privateValues[1], name: 'Reader', title: '', parent: '' }, complete);
  await flushPromises();
  const output = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
  for (const value of privateValues) expect(output).not.toContain(value);
  expect(complete).toHaveBeenCalledOnce();
  if (outcome === 'moderated' || outcome === 'validation') expect(complete.mock.calls[0][0]).toContain(privateValues[4]);
  wrapper.unmount();
});

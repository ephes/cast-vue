import { test, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CommentList from '@/components/CommentList.vue';
import CommentForm from '@/components/CommentForm.vue';
afterEach(() => vi.unstubAllGlobals());
test.each(['rejected', 'moderated', 'network', 'http', 'success'])('draft survives %s until persistence', async outcome => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const fetch = vi.fn(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: {
    commentsAreEnabled: true, postCommentUrl: new URL('http://localhost/comments'),
    content_type: 'cast.post', object_pk: '1', timestamp: '0', security_hash: 'hash', csrfToken: 'csrf'
  } } });
  const form = wrapper.findComponent(CommentForm);
  await form.find('input').setValue('Reader');
  await form.find('textarea').setValue('Keep this draft');
  await form.find('button').trigger('click');
  expect(form.find('button').attributes('disabled')).toBeDefined();
  await form.find('button').trigger('click');
  expect(fetch).toHaveBeenCalledTimes(1);
  const snapshot = form.emitted('comment-submitted')![0][0] as any;
  expect(snapshot.comment).toBe('Keep this draft');
  if (outcome === 'network') reject(new Error('offline'));
  else resolve({ ok: outcome !== 'http', status: 500, json: async () => ({ success: outcome === 'success', is_moderated: outcome === 'moderated', errors: ['invalid'] }) });
  await flushPromises();
  expect((form.find('textarea').element as HTMLTextAreaElement).value).toBe(outcome === 'success' ? '' : 'Keep this draft');
  expect(snapshot.comment).toBe('Keep this draft');
  expect(form.find('[role="alert"]').exists()).toBe(outcome !== 'success');
  wrapper.unmount();
});

test('nested reply preserves ancestor drafts and closes only its own successful form', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: false, errors: ['invalid'] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [
    { id: 1, parent: null, user: 'A', date: '', comment: 'root' },
    { id: 2, parent: 1, user: 'B', date: '', comment: 'child' }
  ], commentMeta: {
    commentsAreEnabled: true, postCommentUrl: new URL('http://localhost/comments'),
    content_type: 'cast.post', object_pk: '1', timestamp: '0', security_hash: 'hash', csrfToken: 'csrf'
  } } });
  const items = wrapper.findAllComponents({ name: 'CommentItem' });
  await items[0].find('button').trigger('click');
  const ancestor = items[0].findComponent(CommentForm);
  await ancestor.find('textarea').setValue('Unsent ancestor draft');
  await items[1].find('button').trigger('click');
  const nested = items[1].findComponent(CommentForm);
  await nested.find('input').setValue('Reader');
  await nested.find('textarea').setValue('Nested draft');
  await nested.find('button').trigger('click'); await flushPromises();
  expect(nested.find('textarea').element.value).toBe('Nested draft');
  expect(nested.find('[role="alert"]').exists()).toBe(true);
  await nested.find('button').trigger('click'); await flushPromises();
  expect(items[1].findComponent(CommentForm).exists()).toBe(false);
  expect(ancestor.find('textarea').element.value).toBe('Unsent ancestor draft');
  wrapper.unmount();
});

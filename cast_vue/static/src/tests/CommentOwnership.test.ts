import { afterEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CommentList from '@/components/CommentList.vue';
import CommentForm from '@/components/CommentForm.vue';
const meta = { content_type: 'cast.post', object_pk: '1', timestamp: '0', security_hash: 'synthetic-hash', csrfToken: 'synthetic-csrf', postCommentUrl: new URL('/comments', window.location.href), commentsAreEnabled: true };
const draft = { comment: 'Synthetic draft', name: 'Reader', email: 'reader@example.invalid', title: '', parent: '' };
afterEach(() => vi.unstubAllGlobals());

test.each(['success', 'failure'])('retired post %s cannot complete or refresh the new post', async outcome => {
  let resolve!: (response: any) => void;
  const fetch = vi.fn(() => new Promise(yes => { resolve = yes; }));
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: meta } });
  const complete = vi.fn();
  wrapper.vm.submitComment(draft, complete);
  await wrapper.setProps({ commentMeta: { ...meta, object_pk: '2' } });
  const form = wrapper.findComponent(CommentForm);
  await form.find('textarea').setValue('B draft');
  resolve({ ok: true, json: async () => ({ success: outcome === 'success', errors: ['invalid'] }) });
  await flushPromises();
  expect(complete).not.toHaveBeenCalled();
  expect(wrapper.emitted('comment-posted')).toBeUndefined();
  expect(form.find('textarea').element.value).toBe('B draft');
  expect(form.find('[role="alert"]').exists()).toBe(false);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1].body.get('object_pk')).toBe('1');
  wrapper.unmount();
});

test('unmount retires callbacks without replaying a possibly accepted POST', async () => {
  let resolve!: (response: any) => void;
  const fetch = vi.fn(() => new Promise(yes => { resolve = yes; }));
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: meta } });
  const complete = vi.fn();
  wrapper.vm.submitComment(draft, complete);
  wrapper.unmount();
  resolve({ ok: true, json: async () => ({ success: true }) });
  await flushPromises();
  expect(complete).not.toHaveBeenCalled();
  expect(wrapper.emitted('comment-posted')).toBeUndefined();
  expect(fetch).toHaveBeenCalledOnce();
});

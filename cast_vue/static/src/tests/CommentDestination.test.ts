import { afterEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CommentList from '@/components/CommentList.vue';
import CommentForm from '@/components/CommentForm.vue';
const meta = { content_type: 'cast.post', object_pk: '1', timestamp: '0', security_hash: 'synthetic-hash', csrfToken: 'synthetic-csrf', commentsAreEnabled: true };
afterEach(() => vi.unstubAllGlobals());

test.each(['https://foreign.invalid/comments', '//foreign.invalid/comments', 'javascript:alert(1)', 'data:text/html,test', `${window.location.protocol}//user:secret@${window.location.host}/comments`])('refuses destination %s before transmitting credentials and retains draft', async url => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: { ...meta, postCommentUrl: url as any } } });
  const form = wrapper.findComponent(CommentForm);
  await form.find('input').setValue('Reader');
  await form.find('textarea').setValue('Synthetic private draft');
  await form.find('button').trigger('click');
  await flushPromises();
  expect(fetch).not.toHaveBeenCalled();
  expect(form.find('textarea').element.value).toBe('Synthetic private draft');
  expect(form.find('[role="alert"]').text()).toContain('Could not save');
  wrapper.unmount();
});

test.each([false, true])('same-origin submission rejects redirects and handles success=%s', async success => {
  const fetch = vi.fn().mockResolvedValue({ ok: success, status: success ? 200 : 302, json: async () => ({ success: true }) });
  vi.stubGlobal('fetch', fetch);
  const wrapper = mount(CommentList, { props: { comments: [], commentMeta: { ...meta, postCommentUrl: new URL('/comments', window.location.href) } } });
  const complete = vi.fn();
  wrapper.vm.submitComment({ comment: 'Synthetic draft', name: 'Reader', email: 'reader@example.invalid', title: '', parent: '' }, complete);
  await flushPromises();
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0];
  expect(new URL(url).origin).toBe(window.location.origin);
  expect(init.redirect).toBe('error');
  expect(init.credentials).toBe('same-origin');
  expect(init.headers['X-CSRFToken']).toBe(meta.csrfToken);
  expect(complete).toHaveBeenCalledWith(...(success ? [] : [expect.stringContaining('Could not save')]));
  wrapper.unmount();
});

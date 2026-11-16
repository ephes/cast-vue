import { expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import CommentList from '@/components/CommentList.vue';
const meta = { content_type: 'cast.post', object_pk: '1', timestamp: '0', security_hash: 'synthetic-hash', csrfToken: 'synthetic-csrf', commentsAreEnabled: false, postCommentUrl: new URL('http://localhost/comments') };
const comment = (id: number, parent: number | null) => ({ id, parent, user: 'Reader', date: '', comment: `Comment ${id}` });

test('recursive rendering uses linear parent-lookup work', () => {
  let reads = 0;
  const comments = Array.from({ length: 4 }, (_, i) => ({ ...comment(i + 1, null), get parent() { reads++; return i ? 1 : null; } }));
  const wrapper = mount(CommentList, { props: { comments, commentMeta: meta } });
  expect(wrapper.findAllComponents({ name: 'CommentItem' }).length).toBe(4);
  expect(reads).toBeLessThanOrEqual(3 * comments.length);
  wrapper.unmount();
});

test.each([
  ['duplicate', [comment(1, null), comment(1, null)]],
  ['cycle', [comment(1, 2), comment(2, 1)]],
  ['orphan', [comment(1, 999)]],
  ['deep', Array.from({ length: 33 }, (_, i) => comment(i + 1, i || null))],
  ['too many', Array.from({ length: 10001 }, (_, i) => comment(i + 1, null))],
])('%s comments refuse as a whole without recursive rendering', (_name, comments) => {
  const wrapper = mount(CommentList, { props: { comments, commentMeta: meta }, global: { stubs: { CommentItem: true } } });
  expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  expect(wrapper.find('[role="alert"]').text()).toContain('Comments could not be displayed');
  expect(wrapper.findAllComponents({ name: 'CommentItem' }).length).toBe(0);
  wrapper.unmount();
});

test('10k comments need only one parent read each and preserve sibling order', async () => {
  const { buildCommentTree } = await import('@/helpers/commentTree');
  let reads = 0;
  const comments = Array.from({ length: 10000 }, (_, i) => ({ ...comment(i + 1, null), get parent() { reads++; return i ? 1 : null; } }));
  const tree = buildCommentTree(comments);
  expect(tree.error).toBe(false);
  expect(reads).toBe(10000);
  expect(tree.children.get(1)?.map(item => item.id)).toEqual(comments.slice(1).map(item => item.id));
  expect(buildCommentTree(Array.from({ length: 32 }, (_, i) => comment(i + 1, i || null))).error).toBe(false);
});

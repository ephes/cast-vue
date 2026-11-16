import type { ComputedRef, InjectionKey } from 'vue';
import type { Comment } from '../components/types';

export const MAX_COMMENTS = 10000;
export const MAX_COMMENT_DEPTH = 32;
export interface CommentTree {
  children: Map<number | null, Comment[]>;
  error: boolean;
}
export const commentTreeKey: InjectionKey<ComputedRef<CommentTree>> = Symbol('comment tree');

// Read each parent once. Memoized depths validate disconnected cycles as well.
export function buildCommentTree(comments: readonly Comment[]): CommentTree {
  const children = new Map<number | null, Comment[]>();
  const parents = new Map<number, number | null>();
  const depths = new Map<number, number>();
  try {
    if (comments.length > MAX_COMMENTS) throw new Error();
    for (const comment of comments) {
      const { id, parent } = comment;
      if (!Number.isSafeInteger(id) || id <= 0 || parents.has(id) ||
          (parent !== null && (!Number.isSafeInteger(parent) || parent <= 0))) throw new Error();
      parents.set(id, parent);
      const siblings = children.get(parent) ?? [];
      siblings.push(comment);
      children.set(parent, siblings);
    }
    for (const id of parents.keys()) {
      let cursor: number | null = id;
      const path: number[] = [];
      const seen = new Set<number>();
      // A parent missing from the response (removed or unpublished) ends the chain:
      // its replies stay unreachable from the roots and are not rendered.
      while (cursor !== null && parents.has(cursor) && !depths.has(cursor)) {
        if (seen.has(cursor) || path.length >= MAX_COMMENT_DEPTH) throw new Error();
        seen.add(cursor);
        path.push(cursor);
        cursor = parents.get(cursor)!;
      }
      let depth = cursor !== null && depths.has(cursor) ? depths.get(cursor)! : 0;
      for (const item of path.reverse()) {
        if (++depth > MAX_COMMENT_DEPTH) throw new Error();
        depths.set(item, depth);
      }
    }
    return { children, error: false };
  } catch {
    return { children: new Map(), error: true };
  }
}

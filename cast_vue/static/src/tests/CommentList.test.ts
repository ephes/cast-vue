import { expect, test, describe } from "vitest";
import { mount } from '@vue/test-utils'
import CommentList from "../js/cast_vue/components/CommentList.vue";
import { Comment } from "../js/cast_vue/components/types";

describe("CommentList.vue", () => {
  test("renders comment list", () => {
    const comments: Comment[] = [
      {
        id: 1,
        parent: null,
        user: "User1",
        date: "2023-05-26",
        comment: "Hello World",
      },
      {
        id: 2,
        parent: 1,
        user: "User2",
        date: "2023-05-27",
        comment: "Hello back",
      },
    ];

    expect(CommentList).toBeTruthy()

    const wrapper = mount(CommentList, {
      props: {
        comments: comments,
      },
    })

    expect(wrapper.findAllComponents({ name: "CommentItem" })).toHaveLength(2);
  });
});

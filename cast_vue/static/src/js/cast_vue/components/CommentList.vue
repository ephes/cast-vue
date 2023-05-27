<template>
    <div class="comment-list">
        <div v-if="newCommentError">{{ newCommentError }}</div>
        <div v-for="comment in rootComments" :key="comment.id">
            <comment-item :comment="comment" :comments="comments" />
        </div>
        <textarea v-model="newCommentText" placeholder="Add a comment..."></textarea>
        <button @click="submitNewComment">Submit</button>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed } from 'vue';
import CommentItem from './CommentItem.vue';
import { Comment, CommentSecurityData, CommentFormData } from './types';

import { getTexContentFromElement } from '../helpers/dom';

const postCommentUrl = new URL(getTexContentFromElement("post-comment-url"));
const csrfToken = getTexContentFromElement("csrf-token")

export default defineComponent({
    components: {
        CommentItem,
    },
    props: {
        comments: {
            type: Array as PropType<Comment[]>,
            required: true,
        },
        securityData: {
            type: Object as PropType<CommentSecurityData>,
            required: true,
        },
        postId: {
            type: Number,
            required: true,
        }
    },
    setup(props, context) {
        const newCommentText = ref("");
        const newCommentError = ref("");
        const rootComments = computed(() =>
            props.comments.filter((comment) => comment.parent === null)
        );

        const submitNewComment = () => {
            console.log('Submit new comment:', newCommentText.value);
            console.log('post to url: ', postCommentUrl);
            console.log("csrf-token: ", csrfToken);
            console.log("security data: ", props.securityData)
            const newComment: CommentFormData = {
                content_type: "cast.post",
                object_pk: props.postId.toString(),
                comment: newCommentText.value,
                name: "User Name",
                email: "foo@example.com",
                title: "title foobar",
                security_hash: props.securityData.security_hash,
                timestamp: props.securityData.timestamp,
            }
            const newCommentData = new URLSearchParams();
            Object.keys(newComment).forEach(key => newCommentData.append(key, newComment[key]));

            fetch(postCommentUrl, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": csrfToken,
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: newCommentData
            })
                .then(response => {
                    console.log("response start: ", response)
                    return response.json()
                })
                .then(json => {
                    console.log("response json: ", json)
                    if (json["success"]) {
                        // cache invalidate post detail + refetch
                        context.emit("comment-posted", true);
                    } else {
                        // comment not successfully saved
                        if (json["is_moderated"]) {
                            newCommentError.value = `Your comment was moderated: ${json["html"]}`
                        } else {
                            newCommentError.value = `Some other error occurred saving comment: ${json["html"]}`
                        }
                    }
                    return json
                })
                .catch(err => console.error('Error posting comment: ', err));

        };

        return {
            newCommentText,
            newCommentError,
            submitNewComment,
            rootComments,

        }
    }
});
</script>
<style scoped>
.comment-list {
    margin: 0;
    padding: 0;
    list-style: none;
}
</style>

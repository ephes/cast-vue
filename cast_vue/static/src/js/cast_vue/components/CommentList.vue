<template>
    <div class="comment-list">
        <div v-for="comment in rootComments" :key="comment.id">
            <comment-item
                @comment-submitted="submitComment"
                :comment="comment"
                :comments="comments"
                :comments-enabled="commentMeta.commentsAreEnabled"
            />
        </div>
        <comment-form v-if="commentMeta.commentsAreEnabled" @comment-submitted="submitComment"></comment-form>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, computed, onMounted } from 'vue';
import CommentItem from './CommentItem.vue';
import CommentForm from './CommentForm.vue';
import { Comment, CommentMeta, CommentFormData, CommentInputData, CommentResponse } from './types';

export default defineComponent({
    components: {
        CommentItem,
        CommentForm,
    },
    props: {
        comments: {
            type: Array as PropType<Comment[]>,
            required: true,
        },
        commentMeta: {
            type: Object as PropType<CommentMeta>,
            required: true,
        },
    },
    setup(props, context) {
        const commentError = ref("");
        const rootComments = computed(() =>
            props.comments.filter((comment) => comment.parent === null)
        );

        const submitComment = (comment: CommentInputData, complete: (message?: string) => void = () => {}) => {
            console.log('Submit new comment - comment list:', comment);
            console.log("commentMeta: ", props.commentMeta)
            const newComment: CommentFormData = {
                content_type: props.commentMeta.content_type,
                object_pk: props.commentMeta.object_pk,
                comment: comment.comment,
                name: comment.name,
                email: comment.email,
                title: comment.title,
                security_hash: props.commentMeta.security_hash,
                timestamp: props.commentMeta.timestamp,
                parent: comment.parent ?? "",
            }
            const newCommentData = new URLSearchParams();
            Object.keys(newComment).forEach(key => newCommentData.append(key, newComment[key]));

            fetch(props.commentMeta.postCommentUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": props.commentMeta.csrfToken,
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: newCommentData
            })
            .then(response => {
                console.log("response start: ", response)
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<CommentResponse>
            })
            .then(json => {
                console.log("response json: ", json)
                if (json.success) {
                    // cache invalidate post detail + refetch
                    context.emit("comment-posted", true);
                    commentError.value = "";
                    complete();
                } else {
                    // comment not successfully saved
                    const errorMessage = JSON.stringify(json.errors);
                    if (json.is_moderated) {
                        commentError.value = `Your comment was moderated: ${errorMessage}`
                    } else {
                        commentError.value = `Some other error occurred saving comment: ${errorMessage}`
                    }
                    complete(commentError.value);
                }
                return json
            })
            .catch(() => {
                commentError.value = "Could not save your comment. Please retry.";
                complete(commentError.value);
            });
        };

        return {
            commentError,
            submitComment,
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

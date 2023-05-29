<template>
    <div class="comment-form">
        <textarea v-model="comment.comment" placeholder="Add a comment..."></textarea>
        <button @click="submitComment">Submit</button>
    </div>
</template>

<script lang="ts">
import { defineComponent, reactive, PropType } from 'vue';
import { CommentInputData } from './types';

export default defineComponent({
    props: {
        parent: {
            type: Number as PropType<number | null>,
            required: true,
        },
    },
    emits: ["comment-submitted"],
    setup(props, context) {
        let parent = "";
        if (props.parent) {
            parent = props.parent.toString();
        }
        const comment = reactive({parent: parent, comment: "", name: "", email: "", title: ""} as CommentInputData)

        const submitComment = () => {
            console.log('Submit new comment:', comment.comment);
            context.emit("comment-submitted", comment);
            comment.comment = "";
        };

        return {
            comment,
            submitComment,

        }
    }
});
</script>

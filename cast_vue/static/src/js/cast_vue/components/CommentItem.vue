<template>
    <div class="comment cv-comment">
        <div class="cv-comment__head">
            <span class="cv-avatar" aria-hidden="true">{{ (comment.user || '?').charAt(0) }}</span>
            <span class="comment-user cv-comment__user">{{ comment.user }}</span>
            <time class="comment-date cv-comment__date" :datetime="comment.date">{{ dateLabel }}</time>
        </div>
        <div class="comment-body cv-comment__body">{{ comment.comment }}</div>
        <div v-if="commentsEnabled">
            <button
                type="button"
                class="cv-button cv-button--ghost cv-button--small cv-comment__reply"
                :aria-expanded="showReplyForm"
                @click="showReplyForm = !showReplyForm"
            ><cv-icon name="reply" /> Reply</button>
            <div v-if="showReplyForm">
                <comment-form :parent="comment.id" @comment-submitted="submitReply"></comment-form>
            </div>
        </div>
        <ul class="comment-children cv-comment__children" v-if="hasChildren">
            <li v-for="child in children" :key="child.id">
                <comment-item :comment="child" :comments="comments" :comments-enabled="commentsEnabled" @comment-submitted="forwardReply"/>
            </li>
        </ul>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, reactive, inject, provide } from 'vue';
import { Comment, CommentInputData } from './types';
import CommentForm from './CommentForm.vue';
import CvIcon from './CvIcon.vue';
import { buildCommentTree, commentTreeKey } from '../helpers/commentTree';

export default defineComponent({
    name: 'CommentItem',
    components: {
        CommentForm,
        CvIcon,
    },
    props: {
        comment: {
            type: Object as PropType<Comment>,
            required: true,
        },
        comments: {
            type: Array as PropType<Comment[]>,
            required: true,
        },
        commentsEnabled: {
            type: Boolean as PropType<boolean>,
            required: true,
        },
    },
    emits: ['comment-submitted'],
    setup(props, context) {
        const reply = reactive({parent: props.comment.id.toString(), comment: "", name: "", email: "", title: ""} as CommentInputData);
        const showReplyForm = ref(false);
        // Standalone CommentItem callers retain the same public props contract.
        const tree = inject(commentTreeKey, null) ?? computed(() => buildCommentTree(props.comments));
        provide(commentTreeKey, tree);
        const children = computed(() => tree.value.children.get(props.comment.id) ?? []);
        const hasChildren = computed(() => children.value.length > 0);

        const dateLabel = computed(() => {
            const date = new Date(props.comment.date);
            if (Number.isNaN(date.getTime())) return props.comment.date;
            return new Intl.DateTimeFormat(document.documentElement.lang || undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
        });

        const submitReply = (comment: CommentInputData, complete: (message?: string) => void) => {
            context.emit('comment-submitted', comment, (message?: string) => {
                complete(message);
                if (!message) showReplyForm.value = false;
            });
        };

        const forwardReply = (comment: CommentInputData, complete: (message?: string) => void) => {
            context.emit("comment-submitted", comment, complete);
        };

        return {
            dateLabel,
            forwardReply,
            reply,
            showReplyForm,
            submitReply,
            children,
            hasChildren,
        };
    },
});
</script>

<template>
    <form class="comment-form cv-comment-form" :aria-label="parent ? 'Reply' : 'Leave a comment'" novalidate @submit.prevent>
      <h3 class="cv-comment-form__title">{{ parent ? 'Reply' : 'Leave a comment' }}</h3>
      <p v-if="error" class="cv-form-error" role="alert">{{ error }}</p>
      <div class="cv-comment-form__row">
        <div class="input-field cv-field">
          <label class="cv-label" :for="ids.name">Name</label>
          <input :id="ids.name" class="cv-input" type="text" v-model="comment.name" autocomplete="name" required>
        </div>
        <div class="input-field cv-field">
          <label class="cv-label" :for="ids.email">Email <span class="cv-comment-form__hint">(optional, not published)</span></label>
          <input :id="ids.email" class="cv-input" type="email" v-model="comment.email" autocomplete="email">
        </div>
      </div>
      <div class="input-field cv-field">
        <label class="cv-label" :for="ids.title">Title <span class="cv-comment-form__hint">(optional)</span></label>
        <input :id="ids.title" class="cv-input" type="text" v-model="comment.title">
      </div>
      <div class="input-field cv-field">
        <label class="cv-label" :for="ids.comment">Comment</label>
        <textarea :id="ids.comment" class="cv-textarea" v-model="comment.comment" required></textarea>
      </div>
      <div class="input-field">
        <button type="button" @click="submitComment" :disabled="pending || !isFormValid" class="submit-button cv-button cv-button--primary">
          <span v-if="pending" class="cv-spinner" aria-hidden="true"></span>
          {{ pending ? 'Sending…' : (parent ? 'Send reply' : 'Send comment') }}
        </button>
      </div>
    </form>
</template>

<script lang="ts">
import { defineComponent, reactive, PropType, computed, ref, useId } from 'vue';
import { CommentInputData } from './types';

export default defineComponent({
    props: {
        parent: {
            type: Number as PropType<number>,
            required: false,
        },
    },
    emits: ["comment-submitted"],
    setup(props, context) {
        let parent = null;
        if (props.parent) {
            parent = props.parent.toString();
        }
        const comment = reactive({parent: parent, comment: "", name: "", email: "", title: ""} as CommentInputData)

        const uid = useId();
        const ids = { name: `${uid}-name`, email: `${uid}-email`, title: `${uid}-title`, comment: `${uid}-comment` };

        const pending = ref(false);
        const error = ref("");
        const submitComment = () => {
            if (pending.value || !isFormValid.value) return;
            const snapshot = Object.freeze({ ...comment });
            pending.value = true;
            error.value = "";
            context.emit("comment-submitted", snapshot, (message?: string) => {
                pending.value = false;
                error.value = message || "";
                if (!message && comment.comment === snapshot.comment) comment.comment = "";
            });
        };

        const isFormValid = computed(() => comment.name !== '' && comment.comment !== '');

        return {
            comment,
            ids,
            pending,
            error,
            isFormValid,
            submitComment,

        }
    }
});
</script>

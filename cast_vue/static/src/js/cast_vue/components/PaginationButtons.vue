<template>
    <nav class="pagination cv-pagination" aria-label="Pagination">
        <button type="button" class="cv-button cv-button--small" @click="prevPage" :disabled="isFirstPage">
            <cv-icon name="arrowLeft" /> Prev
        </button>
        <ol class="cv-pagination__pages">
            <li v-for="(page, index) in pages" :key="index">
                <span v-if="page === null" class="cv-pagination__gap" aria-hidden="true">…</span>
                <button
                    v-else
                    type="button"
                    class="cv-pagination__page"
                    :aria-label="`Page ${page}`"
                    :aria-current="page === currentPage ? 'page' : undefined"
                    @click="goTo(page)"
                >{{ page }}</button>
            </li>
        </ol>
        <span class="cv-pagination__status">Page {{ currentPage }} of {{ totalPages }}</span>
        <button type="button" class="cv-button cv-button--small" @click="nextPage" :disabled="isLastPage">
            Next <cv-icon name="arrowRight" />
        </button>
    </nav>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import CvIcon from './CvIcon.vue';

export default defineComponent({
    name: 'PaginationButtons',
    components: { CvIcon },
    props: {
        currentPage: {
            type: Number,
            required: true,
        },
        totalPages: {
            type: Number,
            required: true,
        },
    },
    emits: ['change-page'],
    computed: {
        isFirstPage(): boolean {
            return this.currentPage <= 1;
        },
        isLastPage(): boolean {
            return this.currentPage >= this.totalPages;
        },
        // First, last and the pages around the current one; null marks a gap.
        pages(): (number | null)[] {
            const wanted = new Set([1, this.totalPages, this.currentPage - 1, this.currentPage, this.currentPage + 1]);
            const shown = [...wanted].filter((page) => page >= 1 && page <= this.totalPages).sort((a, b) => a - b);
            const result: (number | null)[] = [];
            shown.forEach((page, index) => {
                const previous = shown[index - 1];
                if (index > 0 && page - previous === 2) result.push(previous + 1);
                else if (index > 0 && page - previous > 2) result.push(null);
                result.push(page);
            });
            return result;
        },
    },
    methods: {
        prevPage() {
            if (!this.isFirstPage) {
                this.$emit('change-page', -1);
            }
        },
        nextPage() {
            if (!this.isLastPage) {
                this.$emit('change-page', 1);
            }
        },
        // The parent moves by a page delta.
        goTo(page: number) {
            if (page !== this.currentPage) {
                this.$emit('change-page', page - this.currentPage);
            }
        },
    },
});
</script>

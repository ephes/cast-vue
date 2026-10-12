<template>
    <div>
        <p v-if="isLoading && !hasLoaded">Loading data...</p>
        <div v-else>
          <div v-if="error" role="alert">
            <p>{{ error }}</p>
            <button @click="fetchData(true)">Retry</button>
          </div>
          <template v-if="hasLoaded">
            <select-theme></select-theme>
            <filter-form
                @submit-filter-form="handleSubmitFilterForm"
                :form="form"
                :facetCounts="facetCounts"
            ></filter-form>
            <br />
            <p v-if="!error && postsFromApi.items.length === 0">No posts found.</p>
            <pagination-buttons v-if="!error && totalPages > 0" :currentPage="currentPage" :totalPages="totalPages" @change-page="changePage">
            </pagination-buttons>
            <post-list v-if="!error" :blog="blog" :posts="postsFromApi" />
          </template>
        </div>
    </div>
</template>

<script lang="ts">
import config from '../config';
import { FacetCounts, PostsFromApi } from './types';
import { ref, watch, computed, Ref, nextTick, onBeforeUnmount } from 'vue';
import { LocationQueryRaw, useRoute, useRouter } from 'vue-router';
import FilterForm from './FilterForm.vue';
import PostList from './PostList.vue';
import PaginationButtons from './PaginationButtons.vue';
import SelectTheme from './SelectTheme.vue';
import { useDataStore } from '../stores/dataStore';
import { setUrlSearchParams } from '../helpers/url';
import { contentReadyToken, notifyContentReady, withViewTransition } from '../helpers/viewTransitions';
import { Form } from './types';


export default {
    components: {
        FilterForm,
        PostList,
        PaginationButtons,
        SelectTheme,
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const isLoading = ref(true);
        const hasLoaded = ref(false);
        const error = ref('');
        let requestId = 0;
        onBeforeUnmount(() => { requestId += 1; });
        const blog = ref({});
        const postsFromApi = ref({ items: [], meta: { total_count: 0 } } as unknown as PostsFromApi);
        const facetCounts = ref({} as FacetCounts);
        const form = ref({}) as Ref<Form>;
        const currentPage = ref(1);
        const itemsPerPage = config.paginationPageSize;
        const filterKeys = ['search', 'date_after', 'date_before', 'date_facets', 'category_facets', 'tag_facets', 'order'];
        const normalizedQuery = computed(() => {
            const query: Record<string, string> = {};
            for (const key of filterKeys) {
                const raw = route.query[key];
                query[key] = (Array.isArray(raw) ? raw[0] : raw) || '';
            }
            const rawPage = Number(route.query.page);
            query.page = String(Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1);
            return query;
        });
        let wagtailApiUrl: URL;
        let facetCountsApiUrl: URL;
        const applyQuery = () => {
            const query = normalizedQuery.value;
            currentPage.value = Number(query.page);
            form.value = { ...query, page: currentPage.value } as unknown as Form;
            wagtailApiUrl = new URL(config.postListUrl.toString());
            wagtailApiUrl.searchParams.set('type', 'cast.Post');
            wagtailApiUrl.searchParams.set('fields', 'html_overview,html_detail,visible_date,podlove_players');
            wagtailApiUrl.searchParams.set('limit', itemsPerPage.toString());
            wagtailApiUrl.searchParams.set('order', '-visible_date');
            wagtailApiUrl.searchParams.set('use_post_filter', 'true');
            facetCountsApiUrl = new URL(config.apiFacetCountsUrl.toString());
            const { page, ...filters } = query;
            // Empty ordering uses the configured descending default.
            if (!filters.order) delete filters.order;
            const params = { ...filters, offset: String((Number(page) - 1) * itemsPerPage) };
            setUrlSearchParams(wagtailApiUrl, params);
            setUrlSearchParams(facetCountsApiUrl, params);
        };

        const fetchData = async (invalidateCache: boolean = false) => {
            const id = ++requestId;
            const readyToken = contentReadyToken();
            const postUrl = new URL(wagtailApiUrl.href);
            const facetUrl = new URL(facetCountsApiUrl.href);
            const blogUrl = new URL(config.blogDetailUrl.toString());
            isLoading.value = true;
            error.value = '';
            try {
                const dataStore = useDataStore();
                const [blogResult, facetResult, posts] = await Promise.all([
                    dataStore.fetchJson(blogUrl, invalidateCache), dataStore.fetchJson(facetUrl, invalidateCache), dataStore.fetchJson(postUrl, invalidateCache)
                ]);
                if (id !== requestId) return;
                const meta = posts.meta;
                const count = meta && typeof meta === 'object' && 'total_count' in meta ? meta.total_count : undefined;
                if (!Array.isArray(posts.items) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
                    throw new Error('Invalid post list response');
                }
                dataStore.setSlugToId(posts as unknown as PostsFromApi);
                blog.value = blogResult;
                facetCounts.value = (facetResult.facet_counts || {}) as FacetCounts;
                postsFromApi.value = posts as unknown as PostsFromApi;
                hasLoaded.value = true;
            } catch (cause) {
                if (id !== requestId) return;
                console.error('Could not load posts:', cause);
                error.value = 'Could not load posts. Please retry.';
            } finally {
                if (id === requestId) {
                    isLoading.value = false;
                    await nextTick();
                    if (id === requestId) notifyContentReady(readyToken);
                }
            }
        };

        const handleSubmitFilterForm = async (data: Form) => {
            await router.push({ query: { ...data, page: 1 } as unknown as LocationQueryRaw });
        };
        const changePage = async (delta: number) => {
            await router.push({ query: { ...route.query, page: Math.max(1, currentPage.value + delta) } });
        };

        const totalPages = computed(() => {
            return Math.ceil(postsFromApi.value.meta.total_count / itemsPerPage);
        });

        let initialLoad = true;
        watch(() => JSON.stringify(normalizedQuery.value), () => {
            applyQuery();
            if (initialLoad) {
                initialLoad = false;
                void fetchData();
            } else {
                void withViewTransition(fetchData);
            }
        }, { immediate: true });

        return {
            isLoading,
            error,
            fetchData,
            hasLoaded,
            currentPage,
            totalPages,
            blog,
            postsFromApi,
            facetCounts,
            form,
            handleSubmitFilterForm,
            changePage
        };
    }
};
</script>

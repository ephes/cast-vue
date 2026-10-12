<template>
    <div>
        <p v-if="isLoading && !hasLoaded">Loading data...</p>
        <div v-else>
            <select-theme></select-theme>
            <filter-form
                @submit-filter-form="handleSubmitFilterForm"
                :form="form"
                :facetCounts="facetCounts"
            ></filter-form>
            <br />
            <pagination-buttons :currentPage="currentPage" :totalPages="totalPages" @change-page="changePage">
            </pagination-buttons>
            <post-list :blog="blog" :posts="postsFromApi" />
        </div>
    </div>
</template>

<script lang="ts">
import config from '../config';
import { FacetCounts, PostsFromApi } from './types';
import { ref, watch, computed, Ref, nextTick } from 'vue';
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
        const blog = ref({});
        const postsFromApi = ref({} as PostsFromApi);
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

        const fetchData = async () => {
            const readyToken = contentReadyToken();
            isLoading.value = true;
            try {
                const dataStore = useDataStore();
                blog.value = await dataStore.fetchJson(config.blogDetailUrl);
                const facetResult = await dataStore.fetchJson(facetCountsApiUrl);
                facetCounts.value = facetResult.facet_counts as FacetCounts;
                const posts = await dataStore.fetchJson(wagtailApiUrl) as unknown as PostsFromApi;
                dataStore.setSlugToId(posts);
                postsFromApi.value = posts;
            } catch (error) {
                console.error('Error fetching blog data from API: ', error);
            } finally {
                hasLoaded.value = true;
                isLoading.value = false;
                await nextTick();
                notifyContentReady(readyToken);
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

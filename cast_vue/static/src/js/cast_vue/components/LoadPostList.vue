<template>
    <div class="cv-list">
        <div v-if="isLoading && !hasLoaded" class="cv-skeleton" role="status">
          <span class="cv-sr-only">Loading data...</span>
          <div class="cv-skeleton__item" aria-hidden="true">
            <div class="cv-skeleton__line cv-skeleton__line--title"></div>
            <div class="cv-skeleton__line cv-skeleton__line--medium"></div>
          </div>
          <div v-for="n in 3" :key="n" class="cv-skeleton__item" aria-hidden="true">
            <div class="cv-skeleton__line cv-skeleton__line--short"></div>
            <div class="cv-skeleton__line cv-skeleton__line--title"></div>
            <div class="cv-skeleton__line"></div>
            <div class="cv-skeleton__line cv-skeleton__line--medium"></div>
          </div>
        </div>
        <div v-else>
          <div v-if="error" class="cv-alert" role="alert">
            <p>{{ error }}</p>
            <button type="button" class="cv-button" @click="fetchData(true)">Retry</button>
          </div>
          <template v-if="hasLoaded">
            <header class="cv-hero">
              <h1 class="cv-hero__title">{{ blog.title }}</h1>
              <div v-if="blog.description" class="cv-hero__description cv-prose" v-html="blog.description"></div>
            </header>
            <div class="cv-list-layout">
              <aside class="cv-list-layout__aside" aria-label="Search and filters">
                <filter-form
                    @submit-filter-form="handleSubmitFilterForm"
                    :form="form"
                    :facetCounts="facetCounts"
                ></filter-form>
              </aside>
              <div class="cv-list-layout__main" :class="{ 'is-refreshing': isLoading }" :aria-busy="isLoading">
                <div v-if="!error" class="cv-list-summary">
                  <p class="cv-eyebrow" role="status">{{ summary }}</p>
                  <button v-if="isFiltered" type="button" class="cv-button cv-button--ghost cv-button--small" @click="clearFilters">
                    Clear filters
                  </button>
                </div>
                <div v-if="!error && postsFromApi.items.length === 0" class="cv-empty">
                  <strong>No posts found.</strong>
                  <span v-if="isFiltered">Try a different search or remove a filter.</span>
                </div>
                <post-list v-if="!error" :blog="blog" :posts="postsFromApi" />
                <pagination-buttons v-if="!error && totalPages > 0" :currentPage="currentPage" :totalPages="totalPages" @change-page="changePage">
                </pagination-buttons>
              </div>
            </div>
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
import { setBlogTitle, setPageTitle } from '../helpers/site';


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
        let requestOwner: AbortController | undefined;
        onBeforeUnmount(() => { requestId += 1; requestOwner?.abort(); });
        const blog = ref({} as { title?: string; description?: string });
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
            wagtailApiUrl.searchParams.set('fields', 'html_overview,html_detail,visible_date,podlove_players,cover_image_poster_url,cover_alt_text');
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
            requestOwner?.abort();
            const owner = new AbortController();
            requestOwner = owner;
            const readyToken = contentReadyToken();
            const postUrl = new URL(wagtailApiUrl.href);
            const facetUrl = new URL(facetCountsApiUrl.href);
            const blogUrl = new URL(config.blogDetailUrl.toString());
            isLoading.value = true;
            error.value = '';
            try {
                const dataStore = useDataStore();
                const [blogResult, facetResult, posts] = await Promise.all([
                    dataStore.fetchJson(blogUrl, invalidateCache, owner.signal), dataStore.fetchJson(facetUrl, invalidateCache, owner.signal), dataStore.fetchJson(postUrl, invalidateCache, owner.signal)
                ]);
                if (id !== requestId) return;
                const meta = posts.meta;
                const count = meta && typeof meta === 'object' && 'total_count' in meta ? meta.total_count : undefined;
                if (!Array.isArray(posts.items) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
                    throw new Error('Invalid post list response');
                }
                dataStore.setSlugToId(posts as unknown as PostsFromApi);
                blog.value = blogResult;
                setBlogTitle(blogResult.title);
                setPageTitle();
                facetCounts.value = (facetResult.facet_counts || {}) as FacetCounts;
                postsFromApi.value = posts as unknown as PostsFromApi;
                hasLoaded.value = true;
            } catch (cause) {
                if (id !== requestId) return;
                console.error('Could not load posts:', cause);
                error.value = 'Could not load posts. Please retry.';
            } finally {
                owner.abort();
                if (id === requestId) {
                    isLoading.value = false;
                    await nextTick();
                    if (id === requestId) notifyContentReady(readyToken);
                }
            }
        };

        const handleSubmitFilterForm = async (data: Form) => {
            // Empty values are the defaults: keep them out of the address.
            const query: Record<string, string> = {};
            for (const [key, value] of Object.entries({ ...data, page: 1 })) {
                if (value !== '' && value !== null && value !== undefined) query[key] = String(value);
            }
            await router.push({ query: query as LocationQueryRaw });
        };
        const clearFilters = async () => {
            await router.push({ query: {} });
        };
        const changePage = async (delta: number) => {
            await router.push({ query: { ...route.query, page: Math.max(1, currentPage.value + delta) } });
        };

        const totalPages = computed(() => {
            return Math.ceil(postsFromApi.value.meta.total_count / itemsPerPage);
        });

        const isFiltered = computed(() => filterKeys.some((key) => normalizedQuery.value[key] !== ''));
        const summary = computed(() => {
            const count = postsFromApi.value.meta.total_count;
            const noun = count === 1 ? 'post' : 'posts';
            const page = totalPages.value > 1 ? ` · page ${currentPage.value} of ${totalPages.value}` : '';
            return `${count} ${noun}${isFiltered.value ? ' found' : ''}${page}`;
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
            clearFilters,
            isFiltered,
            summary,
            changePage
        };
    }
};
</script>

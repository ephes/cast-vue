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
          <header v-if="hasLoaded" class="cv-hero">
            <h1 class="cv-hero__title">{{ blog.title }}</h1>
            <div v-if="blog.description" class="cv-hero__description cv-prose" v-html="blog.description"></div>
            <subscribe-links />
          </header>
          <div :class="{ 'cv-list-layout': hasLoaded }">
            <aside v-if="hasLoaded" class="cv-list-layout__aside" aria-label="Search and filters">
              <filter-form
                  @submit-filter-form="handleSubmitFilterForm"
                  :form="form"
                  :facetCounts="facetCounts"
                  :dateRangeEnabled="dateRangeEnabled"
              ></filter-form>
            </aside>
            <div class="cv-list-layout__main" :class="{ 'is-refreshing': isLoading }" :aria-busy="isLoading">
              <div v-if="error" class="cv-alert" role="alert">
                <p>{{ error }}</p>
                <button ref="retryButton" type="button" class="cv-button" @click="fetchData(true)">Retry</button>
              </div>
              <div v-if="!error || isFiltered" class="cv-list-summary">
                <p v-if="!error" ref="summaryStatus" class="cv-eyebrow" role="status" tabindex="-1">{{ summary }}</p>
                <div v-if="isFiltered" ref="activeFilters" class="cv-active-filters" role="group" aria-label="Active filters">
                  <ul class="cv-chips" role="list">
                    <li v-for="(chip, index) in activeChips" :key="chip.label">
                      <button type="button" class="cv-chip" :aria-label="`Remove filter: ${chip.label}`" @click="removeFilter(chip.clear, index)">
                        {{ chip.label }} <cv-icon name="close" />
                      </button>
                    </li>
                  </ul>
                  <button type="button" class="cv-button cv-button--ghost cv-button--small" @click="clearFilters">
                    Clear all
                  </button>
                </div>
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
        </div>
    </div>
</template>

<script lang="ts">
import config from '../config';
import { FacetCounts, PostsFromApi } from './types';
import { ref, watch, computed, Ref, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CvIcon from './CvIcon.vue';
import FilterForm from './FilterForm.vue';
import PostList from './PostList.vue';
import SubscribeLinks from './SubscribeLinks.vue';
import PaginationButtons from './PaginationButtons.vue';
import { useDataStore } from '../stores/dataStore';
import { setUrlSearchParams } from '../helpers/url';
import { contentReadyToken, notifyContentReady, withViewTransition } from '../helpers/viewTransitions';
import { Form } from './types';
import { setBlogTitle, setPageTitle } from '../helpers/site';
import { filterChips } from '../helpers/filters';


export default {
    components: {
        CvIcon,
        FilterForm,
        PostList,
        SubscribeLinks,
        PaginationButtons,
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
        const dateRangeEnabled = config.dateRangeEnabled;
        const themePreview = computed(() => ({
            theme: route.query.theme,
            template_base_dir: route.query.template_base_dir,
        }));
        const filterKeys = ['search', 'date_facets', 'category_facets', 'tag_facets', 'order'];
        if (dateRangeEnabled) filterKeys.push('date_after', 'date_before');
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
        // The API counts only the filtered posts when given filters. The
        // complete catalog keeps other years and tags available after a choice.
        const facetCountsApiUrl = new URL(config.apiFacetCountsUrl.toString());
        const applyQuery = () => {
            const query = normalizedQuery.value;
            currentPage.value = Number(query.page);
            form.value = { date_after: '', date_before: '', ...query, page: currentPage.value } as Form;
            wagtailApiUrl = new URL(config.postListUrl.toString());
            wagtailApiUrl.searchParams.set('type', 'cast.Post');
            wagtailApiUrl.searchParams.set('fields', 'html_overview,html_detail,visible_date,podlove_players,cover_image_poster_url,cover_alt_text');
            wagtailApiUrl.searchParams.set('limit', itemsPerPage.toString());
            wagtailApiUrl.searchParams.set('order', '-visible_date');
            wagtailApiUrl.searchParams.set('use_post_filter', 'true');
            const { page, ...filters } = query;
            // Empty ordering uses the configured descending default.
            if (!filters.order) delete filters.order;
            const params = { ...filters, offset: String((Number(page) - 1) * itemsPerPage) };
            setUrlSearchParams(wagtailApiUrl, params);
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
                    dataStore.fetchJson(blogUrl, invalidateCache, owner.signal),
                    dataStore.fetchJson(facetUrl, invalidateCache, owner.signal).catch(() => null),
                    dataStore.fetchJson(postUrl, invalidateCache, owner.signal),
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
                if (facetResult) facetCounts.value = (facetResult.facet_counts || {}) as FacetCounts;
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

        const handleSubmitFilterForm = (data: Form) => {
            // Empty values are the defaults: keep them out of the address.
            const query: Record<string, string> = {};
            for (const [key, value] of Object.entries({ ...data, page: 1 })) {
                if (value !== '' && value !== null && value !== undefined) query[key] = String(value);
            }
            return router.push({ query: { ...themePreview.value, ...query } });
        };
        const activeFilters = ref<HTMLElement>();
        const summaryStatus = ref<HTMLElement>();
        const retryButton = ref<HTMLButtonElement>();
        const activeChips = computed(() => filterChips(form.value, facetCounts.value, document.documentElement.lang || undefined));
        let listRequest: Promise<void>;
        const restoreFilterFocus = async (index?: number) => {
            const request = listRequest;
            await request;
            if (request !== listRequest || document.activeElement !== document.body) return;
            const nextControl = index === undefined ? undefined : activeFilters.value?.querySelectorAll('button')[index];
            const target = nextControl ?? summaryStatus.value ?? retryButton.value;
            target?.focus();
        };
        const removeFilter = async (updates: Partial<Form>, index: number) => {
            if (!await handleSubmitFilterForm({ ...form.value, ...updates })) await restoreFilterFocus(index);
        };
        const clearFilters = async () => {
            if (!await router.push({ query: themePreview.value })) await restoreFilterFocus();
        };
        const changePage = async (delta: number) => {
            await router.push({ query: { ...route.query, page: Math.max(1, currentPage.value + delta) } });
        };

        const totalPages = computed(() => {
            return Math.ceil(postsFromApi.value.meta.total_count / itemsPerPage);
        });

        const isFiltered = computed(() => activeChips.value.length > 0);
        const summary = computed(() => {
            const count = postsFromApi.value.meta.total_count;
            const noun = count === 1 ? 'post' : 'posts';
            const page = totalPages.value > 1 ? ` · page ${currentPage.value} of ${totalPages.value}` : '';
            return `${count} ${noun}${isFiltered.value ? ' found' : ''}${page}`;
        });

        let initialLoad = true;
        watch(() => JSON.stringify(normalizedQuery.value), () => {
            applyQuery();
            listRequest = initialLoad ? fetchData() : withViewTransition(fetchData);
            initialLoad = false;
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
            dateRangeEnabled,
            form,
            handleSubmitFilterForm,
            clearFilters,
            removeFilter,
            activeFilters,
            activeChips,
            summaryStatus,
            retryButton,
            isFiltered,
            summary,
            changePage
        };
    }
};
</script>

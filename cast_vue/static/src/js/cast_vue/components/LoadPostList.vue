<template>
  <div>
      <p v-if="isLoading">Loading data...</p>
      <div v-else>
        <filter-form @submit-filter-form="handleSubmitFilterForm" :form="form"></filter-form>
        <br />
        <div class="pagination">
            <button @click="changePage(-1)" :disabled="currentPage <= 1">&laquo; Prev</button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button @click="changePage(1)" :disabled="currentPage >= totalPages">Next &raquo;</button>
        </div>
        <post-list :blog="blog" :posts="postsFromApi" />
      </div>
  </div>
</template>

<script lang="ts">
import { ref, Ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import FilterForm from './FilterForm.vue';
import PostList from './PostList.vue';
import { PostsFromApi } from './types';
import { getTexContentFromElement, getWagtailApiBaseUrl } from './domHelpers';
import { useDataStore } from '../stores/dataStore';


export default {
    components: {
        PostList,
        FilterForm,
    },
    data() {
        const pagesize = Number(getTexContentFromElement("pagination-page-size"));
        return {
            itemsPerPage: pagesize,
        };
    },
    computed: {
        totalPages() {
            if (!this.isLoading && this.postsFromApi.items !== undefined) {
                return Math.ceil(this.postsFromApi.meta.total_count / this.itemsPerPage);
            } else {
                return 0;
            }
        },
        paginatedPosts() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.postsFromApi.items.slice(start, end);
        },
    },
    methods: {
        async changePage(delta: number) {
            const dataStore = useDataStore();
            this.currentPage += delta;
            const offset = (this.currentPage - 1) * this.itemsPerPage;
            this.wagtailApiUrl.searchParams.set("offset", offset.toString());
            try {
                this.postsFromApi = await dataStore.fetchJson(this.wagtailApiUrl);
                console.log("postsFromApi: ", this.postsFromApi)
                this.$router.push({ query: { page: this.currentPage } });
            } catch (error) {
                console.error('Error fetching data from API: ', error);
            }
        },
        async handleSubmitFilterForm(data: any) {
            const dataStore = useDataStore();
            console.log("handleSubmitFilterForm: ", data);
            if (data.search === "") {
                this.wagtailApiUrl.searchParams.delete("search");
            } else {
                this.wagtailApiUrl.searchParams.set("search", data.search);
            }
            if (data.date_after === "") {
                this.wagtailApiUrl.searchParams.delete("date_after");
            } else {
                this.wagtailApiUrl.searchParams.set("date_after", data.date_after);
            }
            if (data.date_before === "") {
                this.wagtailApiUrl.searchParams.delete("date_before");
            } else {
                this.wagtailApiUrl.searchParams.set("date_before", data.date_before);
            }
            if (data.order === "") {
                this.wagtailApiUrl.searchParams.delete("order");
            } else {
                this.wagtailApiUrl.searchParams.set("order", data.order);
            }
            if (data.date_facets === "") {
                this.wagtailApiUrl.searchParams.delete("date_facets");
            } else {
                this.wagtailApiUrl.searchParams.set("date_facets", data.date_facets);
            }
            this.$router.push({ query: data });
            try {
                this.postsFromApi = await dataStore.fetchJson(this.wagtailApiUrl);
                console.log("postsFromApi: ", this.postsFromApi)
            } catch (error) {
                console.error('Error fetching data from API: ', error);
            }
        },
    },
    setup() {
        // refs for data
        const isLoading = ref(true);
        const currentPage = ref(1);
        const blog = ref({});
        const postsFromApi = ref({} as PostsFromApi);
        const route = useRoute();
        const form = ref({ search: "", date_after: "", date_before: "", date_facets: "", order: ""});

        // prepare api urls
        const blogPk = getTexContentFromElement("blog-pk");
        const pagesize = Number(getTexContentFromElement("pagination-page-size"));
        const wagtailApiUrlString = getTexContentFromElement("wagtail-api-pages-url");
        const wagtailApiUrl = getWagtailApiBaseUrl();
        wagtailApiUrl.searchParams.set("type", "cast.Post");
        wagtailApiUrl.searchParams.set("fields", "html_overview,html_detail,visible_date");
        wagtailApiUrl.searchParams.set("offset", "0");
        wagtailApiUrl.searchParams.set("limit", pagesize.toString());
        wagtailApiUrl.searchParams.set("order", "-visible_date");
        wagtailApiUrl.searchParams.set("use_post_filter", "true");
        if (route.query.page !== undefined) {
            currentPage.value = Number(route.query.page);
            const offset = (currentPage.value - 1) * pagesize;
            wagtailApiUrl.searchParams.set("offset", offset.toString());
        }
        if (route.query.search !== undefined) {
            wagtailApiUrl.searchParams.set("search", route.query.search as string);
            form.value.search = route.query.search as string;
        }
        if (route.query.date_after !== undefined) {
            wagtailApiUrl.searchParams.set("date_after", route.query.date_after as string);
            form.value.date_after = route.query.date_after as string;
        }
        if (route.query.date_before !== undefined) {
            wagtailApiUrl.searchParams.set("date_before", route.query.date_before as string);
            form.value.date_before = route.query.date_before as string;
        }
        if (route.query.order !== undefined) {
            wagtailApiUrl.searchParams.set("order", route.query.order as string);
            form.value.order = route.query.order as string;
        }
        if (route.query.date_facets !== undefined) {
            wagtailApiUrl.searchParams.set("date_facets", route.query.date_facets as string);
            form.value.date_facets = route.query.date_facets as string;
        }
        const blogDetailUrl = new URL(wagtailApiUrlString + blogPk + "/");

        // fetch data
        const dataStore = useDataStore();


        const fetchData = async () => {
            try {
                const urlsAndResults: [URL, Ref][] = [
                    [blogDetailUrl, blog],
                    [wagtailApiUrl, postsFromApi],
                ];

                for (const [url, refData] of urlsAndResults) {
                    refData.value = await dataStore.fetchJson(url);
                }
            }
            catch (error) {
                console.error('Error fetching blog data from API: ', error);
            } finally {
                isLoading.value = false;
            }
        };

        onMounted(fetchData);
        console.log("form: ", form);
        return {
            isLoading,
            blog,
            postsFromApi,
            dataStore,
            wagtailApiUrl,
            currentPage,
            form,
        };
    },
};
</script>

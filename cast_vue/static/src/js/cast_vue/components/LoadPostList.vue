<template>
  <div>
      <p v-if="isLoading">Loading data...</p>
      <div v-else>
        <br />
        <div class="pagination">
            <button @click="changePage(-1)" :disabled="currentPage <= 1">&laquo; Prev</button>
            <span>Page {{ currentPage }} of {{ totalPages }}</span>
            <button @click="changePage(1)" :disabled="currentPage >= totalPages">Next &raquo;</button>
        </div>
        <post-list :blog="blog" :posts="postsFromApi" :apiBaseUrl="wagtailApiUrl" />
      </div>
  </div>
</template>

<script lang="ts">
import { ref, Ref, onMounted } from 'vue';
import PostList from './PostList.vue'
import { PostsFromApi } from './types';
import { getTexContentFromElement, getWagtailApiBaseUrl } from './domHelpers';
import { useDataStore } from '../stores/dataStore';


export default {
    components: {
        PostList
    },
    data() {
        const pagesize = Number(getTexContentFromElement("pagination-page-size"));
        return {
            currentPage: 1,
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
            } catch (error) {
                console.error('Error fetching data from API: ', error);
            }
        },
    },
    setup() {
        // refs for data
        const isLoading = ref(true);
        const blog = ref({});
        const postsFromApi = ref({} as PostsFromApi);

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
        return {
            isLoading,
            wagtailApiUrl,
            blog,
            postsFromApi,
            dataStore,
        };
    },
};
</script>

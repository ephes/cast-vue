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
        <post-list :blog="blog" :posts="postsFromApi"/>
      </div>
  </div>
</template>

<script lang="ts">
import { ref, Ref, onMounted } from 'vue';
import PostList from './PostList.vue'
import { PostsFromApi } from './types';

function getTexContentFromElement(elementId: string): string {
    const element = document.getElementById(elementId);
    if (element === null || element.textContent === null) {
        throw new Error(`Could not find element with id "${elementId}"`);
    }
    return JSON.parse(element.textContent);
}

async function fetchPostsFromApi(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}


async function fetchElementData(elementId: string) {
    const url = getTexContentFromElement(elementId);
    if (elementId === "blog-post-list-api-url") {
        const postsUrl = url + "&limit=5&offset=0";
        return await fetchPostsFromApi(postsUrl);
    } else {
        return await fetchPostsFromApi(url);
    }
}

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
            this.currentPage += delta;
            const offset = (this.currentPage - 1) * this.itemsPerPage;
            const url = `../api/wagtail/pages?child_of=4&type=cast.Post&order=-visible_date&limit=5&offset=${offset}`;
            try {
                this.postsFromApi = await fetchPostsFromApi(url);
                console.log("postsFromApi: ", this.postsFromApi)
            } catch (error) {
                console.error('Error fetching data from API: ', error);
            }
        },
    },
    setup() {
        const isLoading = ref(true);
        const blog = ref({});
        const postsFromApi = ref({} as PostsFromApi);
        console.log("blog-post-list-api-url: ", getTexContentFromElement("blog-post-list-api-url"));
        console.log("wagtail-api-pages-url: ", getTexContentFromElement("wagtail-api-pages-url"));
        // const wagtailApiUrl = getTexContentFromElement("wagtail-api-pages-url");
        const blogPk = getTexContentFromElement("blog-pk");
        const pagesize = Number(getTexContentFromElement("pagination-page-size"));
        const wagtailApiUrlString = getTexContentFromElement("wagtail-api-pages-url");
        const wagtailApiUrl = new URL(wagtailApiUrlString);
        wagtailApiUrl.searchParams.set("child_of", blogPk);
        wagtailApiUrl.searchParams.set("type", "cast.Post");
        wagtailApiUrl.searchParams.set("offset", "0");
        wagtailApiUrl.searchParams.set("limit", pagesize.toString());
        wagtailApiUrl.searchParams.set("order", "-visible_date");
        const blogDetailUrl = new URL(wagtailApiUrlString + blogPk + "/");
        console.log("wagtailApiUrl: ", wagtailApiUrl)
        console.log("blogDetailUrl: ", blogDetailUrl)


        const fetchData = async () => {
            try {
                const urlsAndResults: [URL, Ref][] = [
                    [blogDetailUrl, blog],
                    [wagtailApiUrl, postsFromApi],
                ];

                for (const [url, refData] of urlsAndResults) {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    refData.value = await response.json();
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
            blog,
            postsFromApi,
        };
    },
};
</script>

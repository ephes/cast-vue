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
import { ref, onMounted } from 'vue';
import PostList from './PostList.vue'
import { PostsFromApi } from './types';

async function fetchPostsFromApi(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}


async function fetchElementData(elementId: string) {
    const element = document.getElementById(elementId);
    if (element === null || element.textContent === null) {
        throw new Error(`Could not find element with id "${elementId}"`);
    }
    const url = JSON.parse(element.textContent);
    console.log(`Fetching data from ${url}`);
    console.log("elementId: ", elementId);
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
        return {
            currentPage: 1,
            itemsPerPage: 5,
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

        const fetchData = async () => {
            try {
                const elements = {
                    "blog-api-url": blog,
                    "blog-post-list-api-url": postsFromApi,
                };

                for (const [key, value] of Object.entries(elements)) {
                    value.value = await fetchElementData(key);
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
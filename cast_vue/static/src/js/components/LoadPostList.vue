<template>
  <div>
      <p v-if="isLoading">Loading data...</p>
      <div v-else>
        <post-list :blog="blog" :post-list="postList"/>
      </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import PostList from './PostList.vue'

async function fetchElementData(elementId: string) {
    const element = document.getElementById(elementId);
    if (element === null || element.textContent === null) {
        throw new Error(`Could not find element with id "${elementId}"`);
    }
    const url = JSON.parse(element.textContent);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export default {
    components: {
        PostList
    },
    setup() {
        const isLoading = ref(true);
        const blog = ref({});
        const postList = ref([]);

        const fetchData = async () => {
            try {
                const elements = {
                    "blog-api-url": blog,
                    "blog-post-list-api-url": postList,
                };

                for (const [key, value] of Object.entries(elements)) {
                    value.value = await fetchElementData(key);
                }
            }
            catch (error) {
                console.error('Error fetching blog data from API:', error);
            } finally {
                isLoading.value = false;
            }
        };

        onMounted(fetchData);
        return {
            isLoading,
            blog,
            postList
        };
    },
};
</script>
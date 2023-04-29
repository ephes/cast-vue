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

export default {
    components: {
        PostList
    },
    setup() {
        const isLoading = ref(true);
        const blog = ref(null);
        const postList = ref(null);

        const fetchData = async () => {
            try {
                const blogUrlElement = document.getElementById("blog-api-url");
                if (blogUrlElement === null || blogUrlElement.textContent === null) {
                    throw new Error(`Could not find element with id "blog-api-url"`);
                }
                const blogUrl = JSON.parse(blogUrlElement.textContent);
                const responseBlog = await fetch(blogUrl);
                if (!responseBlog.ok) {
                    throw new Error(`HTTP error! status: ${responseBlog.status}`);
                }
                blog.value = await responseBlog.json();

                const postListUrlElement = document.getElementById("blog-post-list-api-url");
                if (postListUrlElement === null || postListUrlElement.textContent === null) {
                    throw new Error(`Could not find element with id "blog-post-list-api-url"`);
                }
                const postListUrl = JSON.parse(postListUrlElement.textContent);
                const responsePostList = await fetch(postListUrl);
                if (!responsePostList.ok) {
                    throw new Error(`HTTP error! status: ${responsePostList.status}`);
                }
                postList.value = await responsePostList.json();
            } catch (error) {
                console.error('Error fetching blog data:', error);
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
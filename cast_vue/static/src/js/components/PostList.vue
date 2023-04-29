<template>
  <div>
      <p v-if="isLoading">Loading data...</p>
      <div v-else>
        <h1>{{ data.title }}</h1>
        {{ data }}
      </div>
  </div>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';

export default {
    setup() {
        const isLoading = ref(true);
        const data = ref(null);

        const fetchData = async () => {
            try {
                const apiUrlElement = document.getElementById("blog-api-url");
                if (apiUrlElement === null || apiUrlElement.textContent === null) {
                    throw new Error(`Could not find element with id "blog-api-url"`);
                }
                const pageUrl = JSON.parse(apiUrlElement.textContent);
                const response = await fetch(pageUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                data.value = await response.json();
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                isLoading.value = false;
            }
        };

        onMounted(fetchData);
        return {
            isLoading,
            data
        };
    },
};
</script>
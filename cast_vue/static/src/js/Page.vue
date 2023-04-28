<template>
    <h1>Hello from Page Component!</h1>
    page pk: {{ pagePk }}
    <div>
        <p v-if="isLoading">Loading data...</p>
        <p v-else>{{ data }}</p>
  </div>
</template>
 
<script>
import { ref, onMounted } from 'vue';

export default {
    setup() {
        const isLoading = ref(true);
        const data = ref(null);

        const fetchData = async () => {
            try {
                const pagePk = JSON.parse(document.getElementById("page-pk").textContent);
                const response = await fetch(`http://localhost:8000/blogs/api/wagtail/pages/${pagePk}`);
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
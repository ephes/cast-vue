<script setup>
import Counter from "./Counter.vue"
</script>

<template>
    <h1>{{message}}</h1>
    <counter />
</template>
 
<script>
export default {
  components: { Counter },
  data() {
    return {
      // message: "Hi from App.vue",
      message: JSON.parse(document.getElementById("vue-message").textContent),
    };
  },
};
</script>

<script setup>
import Counter from "./Counter.vue"
import Page from "./Page.vue"
</script>

<template>
    <h2>asdf</h2>
    <counter />
    <page />
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

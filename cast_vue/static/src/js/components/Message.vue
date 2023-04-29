<template>
    <h1>Hello from Message Component!</h1>
    {{ message }}
</template>

<script lang="ts">
export default {
  data() {
    return {
      message: JSON.parse(document.getElementById("vue-message").textContent),
    };
  },
};
</script>

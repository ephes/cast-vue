<template>
    <h1>{{ blog.title }}</h1>
    {{ blog }}
    <br />
    <mr></mr>
    {{ postList }}
</template>

<script lang="ts">
export default {
  name: "PostList",
  props: {
    postList: {
      type: Array,
      default: () => [],
    },
    blog: {
      type: Object,
      default: () => ({}),
    }
  }
}
</script>
  
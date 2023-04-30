<script setup lang="ts">
import { useRouter } from 'vue-router';
</script>

<template>
  <header>
    <h1>Cast Vue Theme!</h1>
    The header...<br />
  </header>
  <nav>
    <router-link to="/">Blog</router-link> |
    <router-link to="/page">Page</router-link> |
    <router-link to="/counter">Counter</router-link> | 
    <router-link to="/message">Message</router-link> <br />
    The navigation
  </nav>
  <main>
    <router-view></router-view>
  </main>
</template>

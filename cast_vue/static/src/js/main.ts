import '../css/styles.css';

import { createApp } from 'vue';
import { createRouter, createWebHistory } from "vue-router";
import PostList from "./components/PostList.vue";
import Counter from "./components/Counter.vue";
import Message from "./components/Message.vue";
 
import App from './App.vue';

const routes = [
    {
        path: "/post-list",
        name: "PostList",
        component: PostList,
    },
    {
        path: "/counter",
        name: "Counter",
        component: Counter,
    },
    {
        path: "/©message",
        name: "Message",
        component: Message,
    },
];

const baseUrl = JSON.parse(document.getElementById("base-url").textContent);
const router = createRouter({
    history: createWebHistory(baseUrl),
    routes,
  }); 

const app = createApp(App)
app.use(router);
 
app.mount("#app") 

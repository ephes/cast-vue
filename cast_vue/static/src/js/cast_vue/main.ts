import '../../css/cast_vue/styles.css';

import { createApp } from 'vue';
import { createRouter, createWebHistory } from "vue-router";
import LoadPostList from "./components/LoadPostList.vue";
import Page from "./components/Page.vue";
import Counter from "./components/Counter.vue";
import Message from "./components/Message.vue";
 
import App from './App.vue';

const routes = [
    {
        path: "/",
        name: "PostList",
        component: LoadPostList,
    },
    {
        path: "/page",
        name: "Page",
        component: Page,
    },
    {
        path: "/counter",
        name: "Counter",
        component: Counter,
    },
    {
        path: "/message",
        name: "Message",
        component: Message,
    },
];

let baseUrl = "/";
const baseUrlElement = document.getElementById("base-url");
if (baseUrlElement?.textContent) {
    baseUrl = JSON.parse(baseUrlElement.textContent);
}
const router = createRouter({
    history: createWebHistory(baseUrl),
    routes,
  }); 

const app = createApp(App)
app.use(router);
 
app.mount("#app") 

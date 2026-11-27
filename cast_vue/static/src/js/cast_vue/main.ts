import '../../css/cast_vue/styles.css';
import '../../css/cast_vue/pygments.css';
import '../../css/cast_vue/content.css';
import '../../css/cast_vue/player.css';
import '../../css/cast_vue/subscribe.css';
import 'vite/modulepreload-polyfill';  // recommended by django-vite, dunno why

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from "vue-router";
import config, { configError } from './config';
import LoadPostList from "./components/LoadPostList.vue";
import PostDetail from "./components/PostDetail.vue";
import Styleguide from "./components/Styleguide.vue";
import { CONTENT_READY_EVENT, installRouteTransitions } from "./helpers/viewTransitions";
import { initColorScheme } from "./helpers/colorScheme";
import { initFeedCopy } from "./helpers/feedCopy";

import AppearanceMenu from "./components/AppearanceMenu.vue";

import App from './App.vue';

initColorScheme();
initFeedCopy();

// Back/forward restores the scroll position once the page's data is rendered.
const RESTORE_SCROLL_TIMEOUT_MS = 1500;
function contentRendered(): Promise<void> {
    return new Promise((resolve) => {
        const done = () => {
            window.clearTimeout(timer);
            window.removeEventListener(CONTENT_READY_EVENT, done);
            resolve();
        };
        const timer = window.setTimeout(done, RESTORE_SCROLL_TIMEOUT_MS);
        window.addEventListener(CONTENT_READY_EVENT, done);
    });
}

// Counts navigations, so a restoration still waiting for its page's content
// is dropped once the reader has navigated again.
let navigationCount = 0;

function start(mountPoint: HTMLElement) {
    const routes = config.pageType === "styleguide"
        ? [
            {
                path: "/",
                name: "Styleguide",
                component: Styleguide,
            },
        ]
        : [
            {
                path: "/",
                name: "PostList",
                component: LoadPostList,
            },
            {
                path: "/:slug/",
                name: "PostDetail",
                component: PostDetail,
            },
        ];

    const router = createRouter({
        history: createWebHistory(config.routerBase),
        routes,
        scrollBehavior(to, from, savedPosition) {
            const navigation = ++navigationCount;
            if (savedPosition) {
                // Restore only if this is still the latest navigation when its content arrives.
                return contentRendered().then(() => (navigation === navigationCount ? savedPosition : false));
            }
            if (to.hash) return { el: to.hash, top: 72 };
            if (to.path !== from.path || to.query.page !== from.query.page) return { top: 0 };
            return false;
        },
    });
    installRouteTransitions(router);

    const app = createApp(App)
    app.use(router);

    const pinia = createPinia()
    app.use(pinia);

    app.mount(mountPoint)
}

// django-cast supplies the styleguide template with its own page-type marker.
const mountPoint = document.querySelector<HTMLElement>("[data-cv-spa]")
    ?? (config?.pageType === "styleguide" ? document.getElementById("app") : null);
if (mountPoint) {
    if (configError === null) {
        start(mountPoint);
    } else {
        console.error("cast-vue: invalid configuration", configError);
    }
}
document.querySelectorAll("[data-cv-color-scheme]").forEach((mount) => createApp(AppearanceMenu).mount(mount));

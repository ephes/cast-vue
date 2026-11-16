<template>
    <div ref="player"></div>
    <p v-if="loading">Loading player...</p>
    <div v-if="error" role="alert">{{ error }} <button @click="loadPlayer">Retry</button></div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
declare const podlovePlayer: any;


export default defineComponent({
    name: 'PodlovePlayer',
    props: {
        elementId: {
            type: String,
            required: true,
        },
        apiUrl: {
            type: String,
            required: true,
        },
        playerConfig: {
            type: URL,
            required: true,
        },
    },
    setup(props) {
        const player = ref<HTMLElement | null>(null);

        const loading = ref(false);
        const error = ref('');
        let generation = 0;
        let retireCurrent = () => {};

        const loadPlayer = () => {
            const id = ++generation;
            retireCurrent();
            if (!player.value) return;
            loading.value = true;
            error.value = '';
            // A fresh host isolates even initializers which keep mutating after retirement.
            const host = document.createElement('div');
            player.value.replaceChildren(host);
            let retired = false;
            const fail = () => {
                if (retired || id !== generation) { host.replaceChildren(); return; }
                retireCurrent();
                loading.value = false;
                error.value = 'Could not load player. Please retry.';
            };
            const timeout = setTimeout(fail, 15000);
            retireCurrent = () => {
                retired = true;
                clearTimeout(timeout);
                host.replaceChildren();
                host.remove();
            };
            try {
                if (typeof podlovePlayer !== 'function') throw new Error();
                Promise.resolve(podlovePlayer(host, props.apiUrl, props.playerConfig.toString())).then(() => {
                    if (retired || id !== generation) { host.replaceChildren(); return; }
                    clearTimeout(timeout);
                    loading.value = false;
                }, fail);
            } catch { fail(); }
        };
        onMounted(loadPlayer);
        watch(() => [props.elementId, props.apiUrl, props.playerConfig.toString()], loadPlayer, { flush: 'post' });
        onBeforeUnmount(() => {
            generation += 1;
            retireCurrent();
        });

        return { player, loading, error, loadPlayer };
    },
});
</script>

import { PostsFromApi, Post } from './../components/types';
import { defineStore } from 'pinia';
import { fetchJson } from '../helpers/fetchJson';

// Tokens live only while a URL has current work; retired requests never publish.
const generations = new WeakMap<object, Map<string, symbol>>();

const cacheSizes = new WeakMap<object, Map<string, number>>();
const MAX_CACHE_BYTES = 8 * 1024 * 1024;

// Insertion order gives deterministic FIFO eviction, including refreshed entries.
function cacheValue(cache: Record<string, any>, key: string, value: any, limit: number) {
  const sizes = cacheSizes.get(cache) ?? new Map<string, number>();
  cacheSizes.set(cache, sizes);
  const bytes = new TextEncoder().encode(key + JSON.stringify(value)).byteLength;
  sizes.delete(key);
  delete cache[key];
  if (bytes > MAX_CACHE_BYTES) return;
  sizes.set(key, bytes);
  cache[key] = value;
  let total = [...sizes.values()].reduce((sum, size) => sum + size, 0);
  while (sizes.size > limit || total > MAX_CACHE_BYTES) {
    const oldest = sizes.keys().next().value!;
    total -= sizes.get(oldest)!;
    sizes.delete(oldest);
    delete cache[oldest];
  }
}

// Define the store type
interface DataStoreState {
  jsonCache: Record<string, any>;
  slugToPost: Record<string, Post>;
}

// Define and export the store
export const useDataStore = defineStore("main", {
  state: (): DataStoreState => ({
    jsonCache: Object.create(null),
    slugToPost: Object.create(null),
  }),
  actions: {
    async fetchJson(url: URL, invalidateCache: boolean = false, signal?: AbortSignal): Promise<Record<string, unknown>> {
      signal?.throwIfAborted();
      // Check if the URL is in the cache.
      const urlStr = url.toString();
      // console.log("fetchJson: ", urlStr)
      if (this.jsonCache[urlStr] && !invalidateCache) {
        return this.jsonCache[urlStr];
      }

      const requests = generations.get(this) ?? new Map<string, symbol>();
      generations.set(this, requests);
      const generation = Symbol();
      requests.set(urlStr, generation);
      // Fetch the JSON if it's not in the cache.
      try {
        const data = await fetchJson(url, {}, signal);

        signal?.throwIfAborted();
        // Store the result in the cache.
        if (requests.get(urlStr) === generation) cacheValue(this.jsonCache, urlStr, data, 32);
        return data;
      } finally {
        if (requests.get(urlStr) === generation) requests.delete(urlStr);
      }
    },
    setSlugToId(posts: PostsFromApi) {
      for (const post of posts.items) {
        cacheValue(this.slugToPost, post.meta.slug, post, 128);
      }
    }
  },
});

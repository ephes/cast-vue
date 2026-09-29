import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryHistory, createRouter, Router } from "vue-router";
import {
  CONTENT_READY_TIMEOUT_MS,
  contentReadyToken,
  installRouteTransitions,
  notifyContentReady,
  resetViewTransitionsForTests,
  withViewTransition,
} from "@/helpers/viewTransitions";

type Update = () => Promise<void>;

// Mimics the browser: the update callback runs after the old state is
// captured, and the returned promises settle with it.
function installStartViewTransition() {
  const calls: Update[] = [];
  const start = vi.fn((update: Update) => {
    calls.push(update);
    const updateCallbackDone = Promise.resolve().then(update);
    return { updateCallbackDone, finished: updateCallbackDone.catch(() => undefined) };
  });
  (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
  return { start, calls };
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

function makeRouter(): Router {
  const component = { template: "<div />" };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "PostList", component },
      { path: "/:slug/", name: "PostDetail", component },
    ],
  });
  installRouteTransitions(router);
  return router;
}

async function readyRouterAtList(): Promise<Router> {
  const router = makeRouter();
  await router.push("/");
  notifyContentReady(contentReadyToken());
  return router;
}

// Reports whether a promise settles once all queued microtasks have run.
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  promise.then(() => (settled = true), () => (settled = true));
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
  return settled;
}

describe("route view transitions", () => {
  beforeEach(() => {
    resetViewTransitionsForTests();
    setReducedMotion(false);
  });

  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    vi.useRealTimers();
  });

  test("crossfades route changes and captures the new state once content is ready", async () => {
    const { start } = installStartViewTransition();
    const router = await readyRouterAtList();
    const events: string[] = [];
    router.afterEach(() => events.push("navigated"));

    const staleToken = contentReadyToken();
    const navigation = router.push("/first-post/").then(() => events.push("push resolved"));
    await vi.waitFor(() => expect(events).toContain("navigated"));
    expect(start).toHaveBeenCalledTimes(1);
    const transition = start.mock.results[0].value;
    expect(await isSettled(transition.updateCallbackDone)).toBe(false);

    // A fetch the previous page left running must not release the transition.
    notifyContentReady(staleToken);
    expect(await isSettled(transition.updateCallbackDone)).toBe(false);

    notifyContentReady(contentReadyToken());
    await navigation;
    await transition.updateCallbackDone;
    expect(router.currentRoute.value.name).toBe("PostDetail");
  });

  test("gives up waiting for content after the timeout", async () => {
    const { start } = installStartViewTransition();
    const router = await readyRouterAtList();
    vi.useFakeTimers();

    const navigation = router.push("/slow-post/");
    await vi.advanceTimersByTimeAsync(CONTENT_READY_TIMEOUT_MS - 1);
    const transition = start.mock.results[0].value;
    expect(await isSettled(transition.updateCallbackDone)).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await navigation;
    expect(await isSettled(transition.updateCallbackDone)).toBe(true);
    expect(router.currentRoute.value.name).toBe("PostDetail");
  });

  test("does not animate query-only changes, the first render, or reduced motion", async () => {
    const { start } = installStartViewTransition();
    const router = makeRouter();
    await router.push("/");
    await router.push("/before-first-content/");
    expect(start).not.toHaveBeenCalled();

    notifyContentReady(contentReadyToken());
    await router.push("/before-first-content/?page=2");
    expect(start).not.toHaveBeenCalled();

    setReducedMotion(true);
    await router.push("/");
    expect(start).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe("PostList");
  });

  test("navigates normally without the View Transitions API", async () => {
    const router = await readyRouterAtList();

    await router.push("/first-post/");

    expect(router.currentRoute.value.name).toBe("PostDetail");
  });

  test("continues the navigation when the browser skips the transition", async () => {
    const start = vi.fn(() => ({
      updateCallbackDone: Promise.reject(new Error("skipped")),
      finished: Promise.resolve(),
    }));
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    const router = await readyRouterAtList();

    await router.push("/first-post/");

    expect(start).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe("PostDetail");
  });
});

describe("withViewTransition", () => {
  beforeEach(() => {
    resetViewTransitionsForTests();
    setReducedMotion(false);
  });

  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("runs the update inside a transition after the first content render", async () => {
    const { start } = installStartViewTransition();
    notifyContentReady(contentReadyToken());
    const update = vi.fn(async () => {});

    await withViewTransition(update);

    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("captures after the timeout but still waits for a slow update", async () => {
    const { start } = installStartViewTransition();
    notifyContentReady(contentReadyToken());
    vi.useFakeTimers();
    let finishUpdate: () => void = () => {};
    const slowUpdate = new Promise<void>((resolve) => (finishUpdate = resolve));

    const result = withViewTransition(() => slowUpdate);
    await vi.advanceTimersByTimeAsync(CONTENT_READY_TIMEOUT_MS);
    const transition = start.mock.results[0].value;
    expect(await isSettled(transition.updateCallbackDone)).toBe(true);
    expect(await isSettled(result)).toBe(false);

    finishUpdate();
    await result;
  });

  test("propagates update errors to the caller", async () => {
    installStartViewTransition();
    notifyContentReady(contentReadyToken());

    await expect(withViewTransition(async () => {
      throw new Error("fetch failed");
    })).rejects.toThrow("fetch failed");
  });

  test("runs the update directly when transitions are unavailable or unwanted", async () => {
    const update = vi.fn();
    notifyContentReady(contentReadyToken());

    await withViewTransition(update);

    const { start } = installStartViewTransition();
    setReducedMotion(true);
    await withViewTransition(update);

    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(2);
  });
});

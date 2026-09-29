import { nextTick } from "vue";
import { Router, START_LOCATION } from "vue-router";

// Progressive-enhancement view transitions for the single-page theme.
//
// Route components fetch their data after mounting, so a transition that only
// waited for the route change would crossfade into the "Loading data..." state.
// Instead the new state is captured once the destination reports that its
// content is rendered, or after CONTENT_READY_TIMEOUT_MS, whichever comes
// first. The browser keeps showing the old page while it waits, so the timeout
// bounds that freeze well below the browser's own abort limit.
//
// Each route transition starts a new content generation. Route components take
// a token when they are set up and report readiness with it, so a fetch that a
// previous page left running (or a later comment refresh) cannot release the
// transition early.
export const CONTENT_READY_EVENT = "cast-vue:content-ready";
export const CONTENT_READY_TIMEOUT_MS = 1000;

let firstContentRendered = false;
let contentGeneration = 0;

type StartViewTransition = (update: () => Promise<void>) => {
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
};

function startViewTransitionFunction(): StartViewTransition | null {
  const start = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition;
  return typeof start === "function" ? start.bind(document) : null;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canTransition(): boolean {
  return firstContentRendered && startViewTransitionFunction() !== null && !prefersReducedMotion();
}

// Route components call this in setup and pass the token to notifyContentReady.
export function contentReadyToken(): number {
  return contentGeneration;
}

// Route components call this once their data is loaded and rendered.
export function notifyContentReady(token: number): void {
  firstContentRendered = true;
  window.dispatchEvent(new CustomEvent(CONTENT_READY_EVENT, { detail: token }));
}

function waitForTimeout(promise: Promise<unknown>): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, CONTENT_READY_TIMEOUT_MS);
    promise.then(done, done);
  });
}

function waitForContentReady(generation: number): Promise<void> {
  let stopListening = () => {};
  const ready = new Promise<void>((resolve) => {
    const onReady = (event: Event) => {
      if ((event as CustomEvent<number>).detail === generation) {
        resolve();
      }
    };
    window.addEventListener(CONTENT_READY_EVENT, onReady);
    stopListening = () => window.removeEventListener(CONTENT_READY_EVENT, onReady);
  });
  return waitForTimeout(ready).finally(stopListening);
}

// Run an in-place content update (pagination, filters) inside a transition.
// The new state is captured when the update finishes or after the timeout; a
// slower update keeps running and completes without animation.
export async function withViewTransition(update: () => Promise<unknown> | unknown): Promise<void> {
  const start = startViewTransitionFunction();
  if (!canTransition() || start === null) {
    await update();
    return;
  }
  let updateDone: Promise<unknown> | null = null;
  const transition = start(async () => {
    updateDone = Promise.resolve().then(update);
    await waitForTimeout(updateDone);
    await nextTick();
  });
  await transition.updateCallbackDone.catch(() => undefined);
  // The browser runs the callback even for a skipped transition; the fallback
  // only guards against an implementation that does not.
  await (updateDone ?? update());
}

// Crossfade navigations between routes (post list <-> post detail, including
// back/forward). Query-only changes on the same route are left to
// withViewTransition, and nothing animates before the first content render.
export function installRouteTransitions(router: Router): void {
  router.beforeResolve((to, from) => {
    const start = startViewTransitionFunction();
    if (from === START_LOCATION || to.name === from.name || !canTransition() || start === null) {
      return true;
    }
    return new Promise<boolean>((resolveGuard) => {
      let resolved = false;
      const continueNavigation = () => {
        if (!resolved) {
          resolved = true;
          resolveGuard(true);
        }
      };
      const transition = start(async () => {
        // The old state is captured; start a new content generation and let
        // the navigation render the new route.
        contentGeneration += 1;
        const contentReady = waitForContentReady(contentGeneration);
        continueNavigation();
        await contentReady;
        await nextTick();
      });
      // Never hold the navigation hostage to a transition the browser skipped.
      transition.updateCallbackDone.catch(() => undefined).finally(continueNavigation);
      transition.finished.catch(() => undefined).finally(continueNavigation);
    });
  });
}

// Test hook: forget that the first content was rendered.
export function resetViewTransitionsForTests(): void {
  firstContentRendered = false;
}

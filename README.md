# Installing Vue.js Theme for Django-Cast

This document provides the instructions on how to install the Vue.js theme for Django-Cast. Please follow the steps below.

## Installation

### 1. Install the theme

To install the Vue.js theme, you will need to run the following command in your command line:

```shell
pip install cast-vue
```

### 2. Add entries to INSTALLED_APPS

You will need to add `django_vite` and `cast_vue.apps.CastVueConfig`
to your INSTALLED_APPS in your Django settings.

Then, set the DJANGO_VITE_ASSETS_PATH and DJANGO_VITE_DEV_MODE like so:

```python
INSTALLED_APPS = [
    ...
    'django_vite',
    'cast_vue.apps.CastVueConfig',
    ...
]

# For production
DJANGO_VITE_ASSETS_PATH = ROOT_DIR.path("staticfiles").path("cast_vue")  # does not matter for development
DJANGO_VITE_MANIFEST_PATH = DJANGO_VITE_ASSETS_PATH.path("manifest.json")
DJANGO_VITE_STATIC_URL_PREFIX = "cast_vue/"  # really important for production!
DJANGO_VITE_DEV_MODE = DEBUG

# For development
DJANGO_VITE_ASSETS_PATH = "need to be set but doesn't matter"
DJANGO_VITE_DEV_MODE = True
```

### 3. Set the theme in Wagtail admin

You can set the theme to `vue` in the Wagtail admin for the
complete site or just one blog.

### End

That's it! You have successfully installed and set up the Vue.js theme
for [`django-cast`](https://github.com/ephes/django-cast).

## Route transitions

In browsers with the View Transitions API, navigating between the post list and
a post (including back/forward), paging through the list, and applying filters
crossfade the page (`cast_vue/static/src/js/cast_vue/helpers/viewTransitions.ts`).
Route components load their data after mounting, so the new state is captured
once the destination reports its content as rendered, or after one second,
whichever comes first. Readiness is tied to the navigation, so a request left
running by the previous page cannot end the transition early. Paging and
filtering capture the new state when the fetch finishes, or after one second.
A slow API therefore shows the loading or previous state instead of freezing
the page, and the content appears without animation once it arrives. The first page load does not animate, readers who prefer
reduced motion get instant updates, and browsers without the API navigate as
before.

The server-rendered `pagination.html` and `_list_of_posts_and_paging_controls.html`
keep their htmx transition markup: they are part of django-cast's theme template
contract, even though the single-page app does not render them.

## Development

### Podlove player integration (Vue wrapper)

The Podlove Web Player is **not installed via npm** in `cast-vue`. Instead, it
is provided by `django-cast` as a static asset and loaded globally in the
Vue base template:

```html
<script src="{% static 'cast/js/web-player/embed.5.js' %}"></script>
```

This script exposes a global `podlovePlayer(...)` function. The Vue wrapper
component (`cast_vue/static/src/js/cast_vue/components/PodlovePlayer.vue`)
mounts the player into a local `<div>` and passes:

- the API URL for the episode (`apiUrl`)
- the player config URL (`playerConfig`)

No server-rendered `<podlove-player>` markup is required; the wrapper renders
the player purely via JS.

### Run Vite Development Server

```shell
npx vite
```

Then the vue app will be available at `http://localhost:8000`, the
url of the django app. If there's nothing to see, the actual port of vite
dev server (5173, was 3000 some time ago) and the port `django-vite` uses
(5173) might be different.

### Dependency security checks

Use Node.js 24 (as in CI) and install with `npm ci`. Run `npm run audit`
locally before committing; it checks the full dependency tree including development
packages and fails for moderate or higher advisories or scanner errors.
Vitest and coverage require at least 4.1.12. Test utilities are pinned to 2.4.11
with a temporary `js-beautify` 1.14.8 override to avoid the vulnerable glob and
minimatch dependency lines. Update the pin once upstream supplies a repaired
dependency tree; the older glob/inflight dependencies are deprecated.
See [the security review](docs/security-review-2026-11.md) for HTML trust
boundaries and scope.

### Rich text from the API

Blog descriptions and post overview/detail HTML are inserted with `v-html` as
delivered by the site's own django-cast API. This is editor-authored Wagtail
content that Wagtail filters when it is saved, and the server-rendered themes
output the same HTML without further sanitizing, so the Vue theme adds no
client-side sanitizer (and no dependency for one). PostItem removes
server-rendered audio blocks before rendering because the Vue Podlove wrapper
supplies those players.

### Run Tests

Just the tests:
```shell
npx vitest -r cast_vue/static/src/tests
```

With coverage:
```shell
npm run coverage
```

Run the full local gates before handoff:
```shell
npx vitest run -r cast_vue/static/src/tests/
npm run coverage
npm run build
npm run audit
```

GitHub Actions (`.github/workflows/ci.yml`) is manual-only.

### Build

Build the production bundle and normalize the manifest location:
```shell
just js-build-sync
```

This produces:
- `cast_vue/static/cast_vue/main-*.js`
- `cast_vue/static/cast_vue/main-*.css`
- `cast_vue/static/cast_vue/manifest.json`

Commit the updated files in `cast_vue/static/cast_vue/` so deploys and
`collectstatic` can pick them up.

If you prefer, you can run the underlying commands directly:
```shell
npx vite build
mv cast_vue/static/cast_vue/.vite/manifest.json cast_vue/static/cast_vue/manifest.json
rm -rf cast_vue/static/cast_vue/.vite
```

### Update Dependencies

```shell
npx npm-check-updates -u
```

### Comments and filtering

Comment submissions retain their draft until the server confirms persistence.
Validation, moderation and transport failures appear beside the form so readers
can correct or retry it. Pending forms disable duplicate submission, including replies.
Applying a filter in the blog list resets the displayed page, route and API offset to the first page.

The blog list follows filter and page query changes, including browser Back and
Forward, updating its form and API requests together. Detail pages reload when
the slug changes in the same mounted view; comment persistence still refreshes
the current detail from the server.

Only the latest list request may publish its blog, facets, posts or transition
readiness. Overlapping navigations cannot replace newer results. Initial loading,
API errors, empty lists and missing detail posts have explicit messages; errors
include a Retry button that refreshes the server response. Empty results do not
render a post or pagination. Detail requests also ignore obsolete slug responses.

Shared JSON cache publication belongs to the newest network request for each URL.
An older load completing after an explicit refresh cannot overwrite that refresh;
component request IDs separately protect visible state.

API JSON responses are limited to 2 MiB of actual streamed bytes before parsing.
Oversized responses are cancelled and never cached. The JSON cache retains at most
32 entries and the slug cache at most 128, each with an 8 MiB serialized UTF-8
budget (including keys). Oldest inserted entries are evicted first; refreshing an
entry moves it to the end. Eviction does not alter data already displayed by a
component. These are serialized-size budgets, not measurements of JS heap overhead.

Every API GET has a 15-second total deadline covering headers and body. List and
detail components abort their owned requests on navigation, retry or unmount;
retired work cannot repopulate the cache. Concurrent consumers use independent
requests, so retiring one does not cancel another. Deadline failures settle the
normal error/Retry state.

Comment submissions snapshot their target post. Changing the target or unmounting
retires local completion callbacks; late success/failure cannot refresh or reset
the next post's form. The target's forms are recreated when its identity changes.
A retired POST is never automatically replayed, since the server may already have
accepted it. Comment persistence events carry the submitted post identity.

Comment POST destinations must resolve to a same-origin HTTP(S) URL without URL
credentials. Redirects are rejected rather than followed. Invalid destinations
use the normal submit error and preserve the draft; CSRF tokens, email and comment
contents are only sent to an admitted endpoint.

Comment input, security metadata, response bodies and exception contents are not
logged to the browser console. Server validation/moderation messages remain
visible beside the submitting form.

Comment lists build one parent index per response and preserve sibling order.
They admit at most 10,000 comments with unique positive safe-integer IDs, no
cycles and at most 32 levels (including roots). Invalid lists display an explicit
unavailable message instead of rendering a partial/recursive tree. Replies whose
parent is missing from the response (removed or unpublished) are hidden together
with their own replies; the remaining comments still render.
Parent indexing and validation take linear work; nested replies share the index
and retain their existing submission callbacks.

The Podlove wrapper reinitializes when the episode URL, configuration URL or
identity prop changes. Each attempt has a separate host; previous iframes are
removed on replacement/unmount and late completion cannot attach to the current
player. Missing, throwing, rejected or stalled initialization exposes a Retry
button (15-second total initialization deadline). Retry creates a fresh instance.

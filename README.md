# Installing Vue.js Theme for Django-Cast

This document provides the instructions on how to install the Vue.js theme for Django-Cast. Please follow the steps below.

## Installation

### 1. Install the theme

To install the Vue.js theme, you will need to run the following command in your command line:

```shell
pip install cast-vue
```

The theme needs Python 3.11 or newer and django-cast 0.2.55 or newer (it reads the cover image URL of
posts from the API and asks for detail HTML with `render_for_feed=false`).

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

## Design

The theme is plain Vue with its own CSS, no component or CSS framework and no
web fonts. All colours, fonts, radii and widths are custom properties at the
top of `cast_vue/static/src/css/cast_vue/styles.css` (`--cv-*`); a site can
restyle the theme by overriding them in its own stylesheet, for example
`:root { --cv-accent: #0b6e4f; }`.

- **Light and dark:** the theme follows the device setting. The button in the
  header switches between system, light and dark; the choice is kept in
  `localStorage` (`cast-vue:color-scheme`) and applied as `data-theme` on
  `<html>`.
- **Layout:** one reading column with a sticky filter column on wide screens.
  On small screens, search stays visible and the other controls open from the
  "Filters" button. Removable chips above the posts show the applied filters
  and provide a "Clear all" action at any width.
- **Filters:** the eight most-used tags appear first with counts. "Find a tag"
  ignores case and accents and shows up to twenty matches. Exact matches come
  first, then prefix matches, then other substring matches. Each group sorts
  by count (highest first) and then by name. "All tags" opens a scrollable
  alphabetical list. Categories get the same finder when there are more than
  eight. The archive groups available months by year. Selecting a month
  applies that month filter. When `CAST_FILTERSET_FACETS` includes `date`
  (the django-cast default), selecting a year filters to that year and reveals
  its months, and readers can also apply a custom range.
  When the facet endpoint returns months and `date` is disabled, year controls
  expand or collapse those months. A new date selection replaces the previous
  one. Facet counts describe the full blog archive. If the facet endpoint fails,
  the post list still shows posts and the available filters.
- **States:** loading placeholders, error messages with Retry, and empty
  results are styled. Active filters can still be removed or cleared when
  a post list request fails. Clearing the last filter restores keyboard focus
  to the results summary or Retry. The gallery image viewer is a
  keyboard-operable dialog.
- **Accessibility:** skip link, visible focus, labelled controls, text contrast
  of at least 4.5:1 in both colour schemes, and no motion for readers who
  prefer reduced motion.

Django pages can extend `cast/vue/base.html` and fill the `content` block.
They get the same header, colour scheme and reading typography as the post
views, plus a footer with a link to the theme selector. The base also offers
`title`, `meta`, `head` and `navigation` blocks. The theme ships
`feed_detail.html`, `transcript.html` and error page templates that use this
shell. The full-page theme selector uses the shell through django-cast's
`select_theme_page.html`. The post list and detail mount the blog app through
the `data-cv-spa` marker in `spa.html`.
Django-cast controls which theme's error templates are selected.

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

### Audio player

The theme plays audio with its own small player
(`cast_vue/static/src/js/cast_vue/components/AudioPlayer.vue`); the Podlove Web
Player is no longer loaded. A post's `podlove_players` API field still names
the audio: each entry's URL is django-cast's Podlove-format audio endpoint, and
the player reads title, cover, audio files, chapters and transcript from it
(`player/episode.ts`). No player library and no extra request for a player
configuration are involved. Server-rendered audio blocks in the post HTML
(Podlove or django-cast's custom player, whichever `CAST_AUDIO_PLAYER` selects)
are removed before rendering, as before.

- **Post page:** a full player below the title: play/pause, back 15 s and
  forward 30 s, seek bar with chapter marks, playback speed, mute, the chapter
  list, a searchable transcript that follows playback, and a download link.
  Players of posts with several audio files are listed together there.
- **Post list:** one play button per post. The episode data is fetched when
  the reader points at or presses the button, not for every list entry.
- **Player bar:** one audio element serves the whole single-page app
  (`player/engine.ts`), so playback continues while the reader browses. A bar
  at the bottom of the window shows the running episode whenever its full
  player is not on screen.
- Playback speed and the position per episode are remembered in
  `localStorage` (`cast-vue:player`); an episode resumes where it stopped.
- Keyboard, while the focus is inside the player: `K` play/pause, `J`/`L`
  back/forward, `←`/`→` 5 seconds, `M` mute. Lock-screen and headset controls
  work through the Media Session API.

In the post list a play button appears for audio that is part of the post body
(an audio block); the list API does not report an episode's podcast audio when
it is not also in the body. The post page shows it either way.

Seeking needs a media host that answers HTTP range requests (any production
web server or object store does; Django's `runserver` does not).

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
delivered by the site's own django-cast API. The Vue theme trusts that rendered
output the same way the server-rendered themes do: editor-authored Wagtail rich
text, the site's own body blocks (including blocks configured through
`CAST_POST_BODY_BLOCKS`) and the embed HTML of the configured embed providers.
The trust boundary is therefore the site's editor permissions and block/embed
configuration; the Vue theme adds no client-side sanitizer (and no dependency
for one). PostItem removes server-rendered audio blocks before rendering
because the theme's own audio player supplies those players.

### Type check

TypeScript and `vue-tsc` are not project dependencies. Run the check on demand:

```shell
npx -p typescript@5 -p vue-tsc@2 vue-tsc --noEmit -p tsconfig.json
```

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
Applying a filter resets the displayed page, route and post API offset to the
first page. The facet catalog is loaded from the existing facet endpoint with
no filter or pagination arguments.

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

The audio player reloads its episode data when the episode URL changes; a
response for a previous URL is ignored. The episode asked for last is the one
that plays, even when an earlier request finishes later. A failed episode
request or an audio error shows a message with Retry. Episode data is read
through the same bounded JSON reader as the other API reads (15-second
deadline, 2 MiB), only `http(s)` audio, cover and link URLs are used, and
titles, chapters and transcript text are rendered as text, never as HTML.

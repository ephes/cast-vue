# Changelog

## Unreleased

- Redesign the theme: own typography, spacing and colour tokens (`--cv-*`), light and dark colour schemes with a switch in the header, a sticky header, styled loading, error and empty states, and a responsive layout from phone to large desktop.
- Replace the Podlove Web Player with the theme's own lightweight audio player: full player with chapters, searchable transcript, speed, skip and download on post pages, one play button per post in lists, and a player bar that keeps playing while browsing. `embed.5.js` is no longer loaded. Position and speed are remembered per browser.
- Post list: cover images, titles link to the post, search field, filter chips for categories, tags and months with counts, date range, sort order, "Clear filters", and numbered pagination. Empty filter values no longer appear in the address.
- Post page: cover, title and player header, readable rich text, code blocks readable in both colour schemes, a keyboard-operable image viewer with previous/next, and restyled comments and comment forms with labelled fields.
- Navigating to another page scrolls to the top; Back and Forward restore the previous scroll position.
- Base template: valid document structure (assets inside `<head>`), page titles, `title`/`meta`/`head` blocks, and styled error pages. `post_body.html` no longer emits unused helper elements.
- Require django-cast 0.2.55 or newer (post cover image URL and `render_for_feed` in the API).
- Remove the client-side DOMPurify rich-text sanitizer and its `dompurify` dependency; API HTML is rendered as delivered again.
- Fence shared JSON cache publication against responses older than a refresh.
- Bound streamed JSON bodies and both shared caches with deterministic eviction.
- Give API reads a total deadline and cancel work owned by retired views.
- Bind comment completion and refresh events to the submitted post lifecycle.
- Restrict comment submissions to same-origin credential-free HTTP(S) URLs and refuse redirects.
- Remove private comment, credential and moderation payloads from console output.
- Validate bounded acyclic comment trees once, render replies through a shared parent index and hide only replies whose parent is missing.

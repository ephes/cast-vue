# Changelog

## Unreleased

- Give the sort and theme selects inset chevrons and shared pill styling, refine the archive and filter controls, and give the sticky header a solid background. Stack the footer on phones and offer "Keep this theme" to save Vue from its preview. Preserve focus while saving a theme and make the "Current" marker accessible on the responsive theme selection page. Keep the preview active while sorting or filtering and use the saved theme after switching.
- Redesign the theme: own typography, spacing and colour tokens (`--cv-*`), light and dark colour schemes with a switch in the header, a sticky header, styled loading, error and empty states, and a responsive layout from phone to large desktop.
- Replace the Podlove Web Player with the theme's own lightweight audio player: full player with chapters, searchable transcript, speed, skip and download on post pages, one play button per post in lists, and a player bar that keeps playing while browsing. `embed.5.js` is no longer loaded. Position and speed are remembered per browser.
- Add cover images, linked titles, search, sort order and numbered pagination to the post list. Label custom sort orders with their query value. Removable filter chips stay available on desktop and phone when a request fails. Empty filter values no longer appear in the address.
- Browse popular tags and categories or search by name. Results rank by exact match, prefix, then substring, with ties sorted by count and name. The archive groups available months by year with counts. Year and custom range filters require django-cast's `date` filter.
- Keep posts and available filters visible if the facet endpoint fails. Restore keyboard focus after clearing filters, and use newest-first API ordering when the styleguide returns to its default sort.
- Post page: cover, title and player header, readable rich text, code blocks readable in both colour schemes, a keyboard-operable image viewer with previous/next, and restyled comments and comment forms with labelled fields.
- Navigating to another page scrolls to the top; Back and Forward restore the previous scroll position.
- Give Django-rendered pages a shared header, colour-scheme control, reading column and footer. Mount the blog app on elements marked by `spa.html`. Style the theme selector and error pages, and add Vue templates for feed details, standalone transcripts and the server-rendered gallery fragment. The base retains page titles and `title`/`meta`/`head` blocks. `post_body.html` no longer emits unused helper elements.
- Require django-cast 0.2.55 or newer (post cover image URL and `render_for_feed` in the API) and, like django-cast, Python 3.11 or newer.
- Remove the client-side DOMPurify rich-text sanitizer and its `dompurify` dependency; API HTML is rendered as delivered again.
- Fence shared JSON cache publication against responses older than a refresh.
- Bound streamed JSON bodies and both shared caches with deterministic eviction.
- Give API reads a total deadline and cancel work owned by retired views.
- Bind comment completion and refresh events to the submitted post lifecycle.
- Restrict comment submissions to same-origin credential-free HTTP(S) URLs and refuse redirects.
- Remove private comment, credential and moderation payloads from console output.
- Validate bounded acyclic comment trees once, render replies through a shared parent index and hide only replies whose parent is missing.

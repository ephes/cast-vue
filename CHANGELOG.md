# Changelog

## Unreleased

- Fence shared JSON cache publication against responses older than a refresh.
- Bound streamed JSON bodies and both shared caches with deterministic eviction.
- Give API reads a total deadline and cancel work owned by retired views.
- Bind comment completion and refresh events to the submitted post lifecycle.
- Restrict comment submissions to same-origin credential-free HTTP(S) URLs and refuse redirects.
- Remove private comment, credential and moderation payloads from console output.
- Validate bounded acyclic comment trees once, render replies through a shared parent index and hide only replies whose parent is missing.
- Retire obsolete Podlove instances on source/config changes and offer bounded, retryable initialization failures.

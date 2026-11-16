# Changelog

## Unreleased

- Fence shared JSON cache publication against responses older than a refresh.
- Bound streamed JSON bodies and both shared caches with deterministic eviction.
- Give API reads a total deadline and cancel work owned by retired views.
- Bind comment completion and refresh events to the submitted post lifecycle.

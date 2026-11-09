# Cast rich-text fixture

`castRichText.html` is representative rendered API HTML, with deterministic
media paths and text substituted for Django template values. It combines the
Vue article/section wrappers, standard Wagtail rich text, and these templates:

- cast-vue `41de8d3`: `cast_vue/templates/cast/vue/post_body.html` and
  `cast_vue/templates/cast/vue/gallery.html`.
- django-cast `b594f805f5526feae040561bfd82a6f6996c0f57`:
  [`image/image.html`](https://github.com/ephes/django-cast/blob/b594f805f5526feae040561bfd82a6f6996c0f57/src/cast/templates/cast/image/image.html)
  and [`video/video.html`](https://github.com/ephes/django-cast/blob/b594f805f5526feae040561bfd82a6f6996c0f57/src/cast/templates/cast/video/video.html).

The native audio example covers the supported HTML audio/source contract;
PostItem's separate regression verifies that server-rendered `.block-audio` and
`podlove-player` markup is still replaced by the Vue player. The metadata script
is tested separately because it must be read as text and removed from output.
Void elements and boolean attributes use browser serialization so the fixture
can assert exact preservation after sanitization and mounting.

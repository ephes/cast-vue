import re
from urllib.parse import urlsplit

from cast import appsettings
from django import template
from django.urls import NoReverseMatch, reverse
from django.utils.translation import gettext, gettext_noop

try:
    from cast.follow_links import get_follow_links
except ModuleNotFoundError as exc:
    if exc.name != "cast.follow_links":
        raise
    get_follow_links = None

register = template.Library()

PLATFORMS = (
    ("apple_podcasts", "Apple Podcasts", "podcast"),
    ("overcast", "Overcast", "headphones"),
    ("pocket_casts", "Pocket Casts", "headphones"),
    ("spotify", "Spotify", "music"),
    ("youtube", "YouTube", "video"),
    ("castro", "Castro", "headphones"),
)
FOLLOW_LINKS = (
    ("mastodon", "Mastodon", "me"),
    ("github", "GitHub", ""),
    ("bluesky", "Bluesky", ""),
    ("linkedin", "LinkedIn", ""),
    ("email", gettext_noop("Email"), ""),
)


@register.simple_tag
def cast_vue_date_range_enabled() -> bool:
    """Use the same effective setting as django-cast's PostFilterset."""
    return "date" in appsettings.CAST_FILTERSET_FACETS


def safe_link(value, request, *, allow_mailto=False):
    if not isinstance(value, str) or "\\" in value or any(char.isspace() or ord(char) < 32 for char in value):
        return ""
    try:
        url = urlsplit(value)
        if url.scheme in {"https", "http"} and url.hostname:
            return value
        if allow_mailto and url.scheme == "mailto" and url.path:
            return value
        if value.startswith("/") and not value.startswith("//"):
            return request.build_absolute_uri(value) if request else value
    except ValueError:
        pass
    return ""


def feed_url(name, slug, **kwargs):
    try:
        return reverse(f"cast:{name}", kwargs={"slug": slug, **kwargs})
    except NoReverseMatch:
        # Older django-cast releases may not have the feed detail route.
        return ""


@register.simple_tag(takes_context=True)
def cast_vue_subscribe(context):
    blog = context.get("blog")
    # Post contexts can hold the base Blog page instead of its Podcast subtype.
    blog = getattr(blog, "specific", blog)
    request = context.get("request")
    slug = getattr(blog, "slug", "")
    is_podcast = bool(getattr(blog, "is_podcast", False))
    follow_links = context.get("follow_links")
    if follow_links is None:
        follow_links = get_follow_links(blog) if slug and get_follow_links else context.get("default_follow_links") or {}

    feed_page = feed_url("feed_detail", slug) if slug else ""
    blog_rss = feed_url("latest_entries_feed", slug) if slug else follow_links.get("rss")
    podcast_rss = feed_url("podcast_feed_rss", slug, audio_format="mp3") if slug and is_podcast else ""
    if feed_page and request and (request.GET.get("template_base_dir") or request.GET.get("theme")) == "vue":
        feed_page += "?theme=vue"

    platform_urls = {}
    if is_podcast:
        platform_urls = {
            key: safe_link(follow_links.get(key) or context.get(f"{key}_url"), request)
            for key in ("apple_podcasts", "spotify", "youtube")
        }
        apple_path = urlsplit(platform_urls["apple_podcasts"]).path
        if match := re.search(r"/id([0-9]+)(?:/|$)", apple_path):
            apple_id = match[1]
            platform_urls.update(
                overcast=f"https://overcast.fm/itunes{apple_id}",
                pocket_casts=f"https://pca.st/itunes/{apple_id}",
                castro=f"https://castro.fm/itunes/{apple_id}",
            )

    return {
        "feedPageUrl": safe_link(feed_page, request),
        "isPodcast": is_podcast,
        "podcastRssUrl": safe_link(podcast_rss, request),
        "blogRssUrl": safe_link(blog_rss, request),
        "platformLinks": [
            {"id": key, "label": label, "icon": icon, "url": platform_urls[key]}
            for key, label, icon in PLATFORMS
            if platform_urls.get(key)
        ],
        "followLinks": [
            {"label": gettext(label) if key == "email" else label, "url": url, "rel": rel}
            for key, label, rel in FOLLOW_LINKS
            if (url := safe_link(follow_links.get(key), request, allow_mailto=key == "email"))
        ],
    }


@register.simple_tag(takes_context=True)
def cast_vue_absolute_link(context, value):
    return safe_link(value, context.get("request"))

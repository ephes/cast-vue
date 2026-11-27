import re
from urllib.parse import urlsplit

from cast import appsettings
from cast.models import Blog, Episode
from cast.site_lookup import get_site_specific_page_or_404
from django import template
from django.db.models import Count, Q
from django.http import Http404
from django.urls import NoReverseMatch, reverse
from django.utils.translation import gettext, gettext_noop

try:
    from cast.blog_index import public_posts
except ImportError:
    # Older django-cast releases used Wagtail's public() queryset method.
    def public_posts(queryset):
        return queryset.public()

try:
    from cast.follow_links import get_follow_links
except ModuleNotFoundError as exc:
    if exc.name != "cast.follow_links":
        raise
    get_follow_links = None

register = template.Library()

PODCAST_FORMATS = ("mp3", "m4a", "oga", "opus")
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


def site_feed_blog(blog, request):
    if request is None or not getattr(blog, "slug", ""):
        return None
    try:
        page = get_site_specific_page_or_404(Blog, request, slug=blog.slug)
    except Http404:
        return None
    return page if page.pk == getattr(blog, "pk", None) else None


def published_podcast_formats(blog):
    episodes = public_posts(Episode.objects.using(blog._state.db).live()).descendant_of(blog)
    # A feed enclosure needs an uploaded file. Count skips NULL and the filter skips empty filenames.
    counts_by_format = {}
    for audio_format in PODCAST_FORMATS:
        field = f"podcast_audio__{audio_format}"
        counts_by_format[audio_format] = Count(field, filter=~Q(**{field: ""}))
    counts = episodes.filter(podcast_audio__isnull=False).aggregate(**counts_by_format)
    return [audio_format for audio_format in PODCAST_FORMATS if counts[audio_format]]


def configured_feed_page(context, request, unavailable_url):
    unavailable = urlsplit(safe_link(unavailable_url, request))
    for key in ("follow_links", "default_follow_links"):
        candidate = safe_link((context.get(key) or {}).get("feed_detail"), request)
        # django-cast's follow_links may contain the same generated route.
        if candidate and urlsplit(candidate)._replace(query="", fragment="") != unavailable:
            return candidate
    return ""


@register.simple_tag(takes_context=True)
def cast_vue_subscribe(context):
    blog = context.get("blog")
    # Post contexts can hold the base Blog page instead of its Podcast subtype.
    # Repository projections already have the correct subtype and can omit the content type.
    if getattr(blog, "content_type_id", None):
        blog = blog.specific
    request = context.get("request")
    slug = getattr(blog, "slug", "")
    is_podcast = bool(getattr(blog, "is_podcast", False))
    follow_links = context.get("follow_links")
    if follow_links is None:
        follow_links = get_follow_links(blog) if slug and get_follow_links else context.get("default_follow_links") or {}

    feed_path = feed_url("feed_detail", slug) if slug else ""
    feed_blog = site_feed_blog(blog, request)
    # feed_detail requires a live site-scoped blog with no direct or inherited restrictions.
    restricted = feed_blog is not None and feed_blog.get_view_restrictions().exists()
    public_blog = feed_blog if not restricted else None
    feed_page = feed_path if public_blog is not None else ""
    if feed_page and (request.GET.get("template_base_dir") or request.GET.get("theme")) == "vue":
        feed_page += "?theme=vue"
    if not feed_page and not restricted:
        feed_page = configured_feed_page(context, request, feed_path)

    blog_rss = follow_links.get("rss") if not slug else ""
    podcast_rss = ""
    podcast_formats = []
    if public_blog is not None:
        blog_rss = feed_url("latest_entries_feed", slug)
        if is_podcast:
            podcast_formats = published_podcast_formats(public_blog)
            recommended_format = next(iter(podcast_formats), "mp3")
            podcast_rss = feed_url("podcast_feed_rss", slug, audio_format=recommended_format)

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
        "podcastFormats": podcast_formats,
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

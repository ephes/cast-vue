from django import template

register = template.Library()


@register.filter
def transcript_timestamp(segment: object) -> str:
    """Format explicit milliseconds, or show the standard Podlove timestamp."""
    if not isinstance(segment, dict):
        return ""

    milliseconds = segment.get("start_ms")
    if type(milliseconds) is int and milliseconds >= 0:
        hours, remainder = divmod(milliseconds // 1000, 3600)
        minutes, seconds = divmod(remainder, 60)
        return f"{hours}:{minutes:02}:{seconds:02}" if hours else f"{minutes}:{seconds:02}"

    start = segment.get("start")
    return str(start) if isinstance(start, (str, int, float)) and type(start) is not bool else ""

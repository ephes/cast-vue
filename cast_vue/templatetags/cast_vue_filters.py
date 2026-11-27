from cast import appsettings
from django import template

register = template.Library()


@register.simple_tag
def cast_vue_date_range_enabled() -> bool:
    """Use the same effective setting as django-cast's PostFilterset."""
    return "date" in appsettings.CAST_FILTERSET_FACETS

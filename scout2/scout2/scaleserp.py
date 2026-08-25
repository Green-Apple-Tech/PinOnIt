"""Back-compat wrapper. Search lives in search.py (free by default)."""

from .search import organic_links

__all__ = ["organic_links"]

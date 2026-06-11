"""SSRF 防護模組（FIX-068）"""

from .safe_url import SsrfBlockedError, assert_safe_url

__all__ = ["assert_safe_url", "SsrfBlockedError"]

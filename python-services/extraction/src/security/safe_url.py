"""
@fileoverview SSRF 防護：URL 安全驗證（assert_safe_url）
@description
  在抓取使用者可控 URL 前，封鎖內網/雲端 metadata 位址，防止 SSRF。
  與 Node 側 src/lib/security/safe-fetch.ts 語意對等。

  - protocol 僅允許 http/https
  - hostname 層封鎖 localhost / *.localhost / *.local
  - DNS 解析後逐一比對所有 IP（防 DNS rebinding）
  - IPv4-mapped IPv6（::ffff:127.0.0.1）正規化後再比對

@module python-services/extraction/src/security/safe_url
@since FIX-068 - SSRF host 白名單（WP-5）
@lastModified 2026-06-10
"""

import ipaddress
import socket
from urllib.parse import urlparse


class SsrfBlockedError(Exception):
    """SSRF 攔截錯誤（開發者導向，由呼叫端轉為 4xx，不洩漏內部探測結果）"""


def _is_blocked_ip(ip: str) -> bool:
    """判斷 IP 是否落在封鎖網段（私網/loopback/link-local/metadata/unique-local 等）。"""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # 無法解析的位址，保守封鎖

    # IPv4-mapped IPv6（::ffff:127.0.0.1）正規化為 IPv4 再比對
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped

    return (
        addr.is_private  # 10/8、172.16/12、192.168/16（含 loopback）
        or addr.is_loopback  # 127/8、::1
        or addr.is_link_local  # 169.254/16（含 metadata 169.254.169.254）、fe80::/10
        or addr.is_reserved
        or addr.is_unspecified  # 0.0.0.0、::
        or addr.is_multicast
    )


def assert_safe_url(url: str) -> None:
    """驗證 URL 是否安全可外呼。不安全時 raise SsrfBlockedError。"""
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise SsrfBlockedError(f"Protocol not allowed: {parsed.scheme}")

    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname:
        raise SsrfBlockedError("Empty host")
    if (
        hostname == "localhost"
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
    ):
        raise SsrfBlockedError(f"Hostname not allowed: {hostname}")

    # DNS 解析後逐一驗證（IP 字面值時 getaddrinfo 會原樣返回，一併涵蓋）
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SsrfBlockedError(f"DNS resolution failed: {hostname}") from exc

    if not infos:
        raise SsrfBlockedError(f"No DNS records: {hostname}")

    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise SsrfBlockedError(
                f"Resolved IP is in a blocked range: {hostname} -> {ip}"
            )

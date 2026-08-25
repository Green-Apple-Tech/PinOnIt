"""Skip junk / directory / government domains at export time."""

from __future__ import annotations

from .settings import ROOT

EXCLUDE_PATH = ROOT / "config" / "exclude_domains.txt"

_CONTAINS = ("chamber",)
_SUFFIXES = (".gov", ".edu")


def load_exclude_hosts(path=EXCLUDE_PATH) -> set[str]:
    hosts: set[str] = set()
    if not path.exists():
        return hosts
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip().lower()
        if not raw or raw.startswith("#"):
            continue
        hosts.add(raw.removeprefix("www."))
    return hosts


def normalize_host(domain: str) -> str:
    d = (domain or "").strip().lower().removeprefix("www.")
    return d.split("/")[0].split(":")[0]


def is_excluded_domain(domain: str, hosts: set[str] | None = None) -> bool:
    d = normalize_host(domain)
    if not d:
        return True
    known = hosts if hosts is not None else load_exclude_hosts()
    if d in known:
        return True
    labels = d.split(".")
    for i in range(len(labels)):
        if ".".join(labels[i:]) in known:
            return True
    if any(token in d for token in _CONTAINS):
        return True
    return d.endswith(_SUFFIXES)

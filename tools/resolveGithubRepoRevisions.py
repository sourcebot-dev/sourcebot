"""Resolve GitHub connection revision globs for a single repository.

Connection-level ``revisions.branches`` / ``revisions.tags`` apply to every
repository unless overridden under ``revisions.repositories`` for that
``{owner}/{repo}`` key. When an override sets ``branches`` or ``tags``, that
field replaces the connection-level value; omitted fields fall back.
"""

from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Optional


def resolve_github_repo_revisions(
    repo_full_name: str,
    revisions: Optional[Mapping[str, Any]] = None,
) -> dict[str, Optional[list[str]]]:
    """Return the effective branch/tag globs for ``repo_full_name``.

    Args:
        repo_full_name: Repository name in ``{owner}/{repo}`` form (GitHub
            ``full_name``). Matching against ``revisions.repositories`` is
            case-sensitive and exact — no globbing on the map keys.
        revisions: The connection ``revisions`` object from a GitHub
            connection config, or ``None``.

    Returns:
        A dict with ``branches`` and ``tags`` keys. Each value is either a
        list of glob patterns or ``None`` when unset at both the connection
        and per-repository levels.
    """
    if not revisions:
        return {"branches": None, "tags": None}

    override: Mapping[str, Any] = {}
    repositories = revisions.get("repositories")
    if isinstance(repositories, Mapping):
        candidate = repositories.get(repo_full_name)
        if isinstance(candidate, Mapping):
            override = candidate

    def field(name: str) -> Optional[list[str]]:
        if name in override and override[name] is not None:
            value = override[name]
            if not isinstance(value, list):
                raise TypeError(
                    f"revisions.repositories[{repo_full_name!r}].{name} must be a list"
                )
            return list(value)
        value = revisions.get(name)
        if value is None:
            return None
        if not isinstance(value, list):
            raise TypeError(f"revisions.{name} must be a list")
        return list(value)

    return {
        "branches": field("branches"),
        "tags": field("tags"),
    }


def apply_revisions_to_repos(
    repo_full_names: list[str],
    revisions: Optional[Mapping[str, Any]] = None,
) -> dict[str, dict[str, Optional[list[str]]]]:
    """Resolve revisions for many repositories (handy for config dry-runs)."""
    return {
        name: resolve_github_repo_revisions(name, revisions)
        for name in repo_full_names
    }


def merge_connection_example() -> MutableMapping[str, Any]:
    """Example GitHub connection shape used by tests and docs."""
    return {
        "type": "github",
        "orgs": ["acme"],
        "revisions": {
            "branches": ["main", "release/*"],
            "tags": ["v*"],
            "repositories": {
                "acme/datastore": {
                    "branches": ["datastore-release/*"],
                },
                "acme/frontend": {
                    "branches": ["main", "release/*"],
                    "tags": ["v*", "rc-*"],
                },
            },
        },
    }

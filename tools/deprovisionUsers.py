#!/usr/bin/env python3
"""Interactively deprovision inactive users from a Sourcebot organization."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Sequence


USERS_PATH = "/api/ee/users"
USER_PATH = "/api/ee/user"
DURATION_PATTERN = re.compile(r"^(?P<amount>\d+(?:\.\d+)?)(?P<unit>[smhdw])$", re.IGNORECASE)
DURATION_UNITS = {
    "s": "seconds",
    "m": "minutes",
    "h": "hours",
    "d": "days",
    "w": "weeks",
}


@dataclass(frozen=True)
class User:
    id: str
    name: str | None
    email: str
    role: str
    last_activity_at: datetime | None
    created_at: datetime
    suspended_at: datetime | None

    @classmethod
    def from_json(cls, value: dict[str, Any]) -> "User":
        return cls(
            id=require_string(value, "id"),
            name=optional_string(value, "name"),
            email=require_string(value, "email"),
            role=require_string(value, "role"),
            last_activity_at=parse_optional_datetime(value, "lastActivityAt"),
            created_at=parse_datetime(require_string(value, "createdAt")),
            suspended_at=parse_optional_datetime(value, "suspendedAt"),
        )


class SourcebotApiError(RuntimeError):
    pass


class SourcebotClient:
    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def list_users(self) -> list[User]:
        payload = self._request("GET", USERS_PATH)
        if not isinstance(payload, list):
            raise SourcebotApiError("The users endpoint returned an unexpected response.")
        return [User.from_json(value) for value in payload]

    def deprovision_user(self, user_id: str) -> None:
        query = urllib.parse.urlencode({"userId": user_id})
        self._request("DELETE", f"{USER_PATH}?{query}")

    def _request(self, method: str, path: str) -> Any:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            method=method,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "sourcebot-user-deprovisioning/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            message = extract_error_message(body) or error.reason
            raise SourcebotApiError(f"Sourcebot returned HTTP {error.code}: {message}") from error
        except urllib.error.URLError as error:
            raise SourcebotApiError(f"Could not connect to Sourcebot: {error.reason}") from error

        if not body:
            return None
        try:
            return json.loads(body)
        except json.JSONDecodeError as error:
            raise SourcebotApiError("Sourcebot returned invalid JSON.") from error


def require_string(value: dict[str, Any], field: str) -> str:
    result = value.get(field)
    if not isinstance(result, str):
        raise SourcebotApiError(f"User response is missing string field {field!r}.")
    return result


def optional_string(value: dict[str, Any], field: str) -> str | None:
    result = value.get(field)
    if result is not None and not isinstance(result, str):
        raise SourcebotApiError(f"User response has invalid field {field!r}.")
    return result


def parse_optional_datetime(value: dict[str, Any], field: str) -> datetime | None:
    raw_value = value.get(field)
    if raw_value is None:
        return None
    if not isinstance(raw_value, str):
        raise SourcebotApiError(f"User response has invalid field {field!r}.")
    return parse_datetime(raw_value)


def parse_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise SourcebotApiError(f"Sourcebot returned an invalid timestamp: {value!r}.") from error
    if parsed.tzinfo is None:
        raise SourcebotApiError(f"Sourcebot returned a timestamp without a timezone: {value!r}.")
    return parsed.astimezone(timezone.utc)


def parse_duration(value: str) -> timedelta:
    match = DURATION_PATTERN.fullmatch(value.strip())
    if not match:
        raise argparse.ArgumentTypeError(
            "must be a number followed by s, m, h, d, or w (for example: 90d)"
        )
    amount = float(match.group("amount"))
    duration = timedelta(**{DURATION_UNITS[match.group("unit").lower()]: amount})
    if duration <= timedelta(0):
        raise argparse.ArgumentTypeError("must be greater than zero")
    return duration


def parse_base_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urllib.parse.urlsplit(normalized)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise argparse.ArgumentTypeError("must be an absolute http:// or https:// URL")
    if parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError("must not contain a query string or fragment")
    return normalized


def find_inactive_users(users: Sequence[User], cutoff: datetime) -> list[User]:
    candidates = []
    for user in users:
        if user.suspended_at is not None:
            continue
        activity_reference = user.last_activity_at or user.created_at
        if activity_reference < cutoff:
            candidates.append(user)
    return sorted(candidates, key=lambda user: user.last_activity_at or user.created_at)


def format_duration(duration: timedelta) -> str:
    seconds = max(0, int(duration.total_seconds()))
    days, remainder = divmod(seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def print_users_table(users: Sequence[User], now: datetime) -> None:
    headers = ("Name", "Email", "Role", "Last activity", "Inactive for")
    rows = []
    for user in users:
        reference = user.last_activity_at or user.created_at
        rows.append(
            (
                user.name or "—",
                user.email,
                user.role,
                user.last_activity_at.isoformat(timespec="seconds") if user.last_activity_at else "Never",
                format_duration(now - reference),
            )
        )

    widths = [max(len(header), *(len(row[index]) for row in rows)) for index, header in enumerate(headers)]
    separator = "+-" + "-+-".join("-" * width for width in widths) + "-+"

    def print_row(row: Sequence[str]) -> None:
        print("| " + " | ".join(value.ljust(widths[index]) for index, value in enumerate(row)) + " |")

    print(separator)
    print_row(headers)
    print(separator)
    for row in rows:
        print_row(row)
    print(separator)


def extract_error_message(body: str) -> str | None:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return body.strip() or None
    if isinstance(payload, dict):
        for key in ("message", "error"):
            if isinstance(payload.get(key), str):
                return payload[key]
    return body.strip() or None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Preview and deprovision inactive Sourcebot organization users."
    )
    parser.add_argument(
        "--base-url",
        required=True,
        type=parse_base_url,
        help="Sourcebot base URL, such as https://sourcebot.example.com",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("SOURCEBOT_API_KEY"),
        help="Sourcebot owner API key (defaults to SOURCEBOT_API_KEY)",
    )
    parser.add_argument(
        "--inactivity-time",
        required=True,
        type=parse_duration,
        metavar="DURATION",
        help="Inactivity threshold using s, m, h, d, or w (for example: 90d)",
    )
    parser.add_argument("--timeout", type=float, default=30.0, help=argparse.SUPPRESS)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.api_key:
        parser.error("--api-key is required when SOURCEBOT_API_KEY is not set")
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")

    now = datetime.now(timezone.utc)
    client = SourcebotClient(args.base_url, args.api_key, args.timeout)
    try:
        inactive_users = find_inactive_users(client.list_users(), now - args.inactivity_time)
    except SourcebotApiError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    if not inactive_users:
        print("No users exceed the inactivity threshold.")
        return 0

    print_users_table(inactive_users, now)
    print(f"\n{len(inactive_users)} user(s) will be permanently removed from this organization.")
    try:
        confirmation = input('Type "deprovision" to continue: ')
    except (EOFError, KeyboardInterrupt):
        print("\nCancelled. No users were deprovisioned.")
        return 0
    if confirmation.strip().lower() != "deprovision":
        print("Cancelled. No users were deprovisioned.")
        return 0

    failures = []
    for user in inactive_users:
        try:
            client.deprovision_user(user.id)
            print(f"Deprovisioned {user.email}")
        except SourcebotApiError as error:
            failures.append((user, error))
            print(f"Failed to deprovision {user.email}: {error}", file=sys.stderr)

    if failures:
        print(
            f"Deprovisioned {len(inactive_users) - len(failures)} of {len(inactive_users)} user(s); "
            f"{len(failures)} failed.",
            file=sys.stderr,
        )
        return 1

    print(f"Successfully deprovisioned {len(inactive_users)} user(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

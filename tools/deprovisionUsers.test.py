import argparse
import importlib.util
import io
import sys
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


MODULE_PATH = Path(__file__).with_name("deprovisionUsers.py")
SPEC = importlib.util.spec_from_file_location("deprovisionUsers", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class UserDeprovisioningTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 7, 20, tzinfo=timezone.utc)

    def make_user(self, **overrides):
        values = {
            "id": "user-1",
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "role": "MEMBER",
            "last_activity_at": self.now - timedelta(days=100),
            "created_at": self.now - timedelta(days=200),
            "suspended_at": None,
        }
        values.update(overrides)
        return MODULE.User(**values)

    def test_parse_duration(self):
        self.assertEqual(MODULE.parse_duration("90d"), timedelta(days=90))
        self.assertEqual(MODULE.parse_duration("1.5h"), timedelta(minutes=90))

    def test_parse_base_url(self):
        self.assertEqual(MODULE.parse_base_url("https://sourcebot.example.com/"), "https://sourcebot.example.com")

        with self.assertRaises(argparse.ArgumentTypeError):
            MODULE.parse_base_url("sourcebot.example.com")

    def test_find_inactive_users_uses_strict_cutoff(self):
        old = self.make_user(id="old", last_activity_at=self.now - timedelta(days=91))
        boundary = self.make_user(id="boundary", last_activity_at=self.now - timedelta(days=90))
        recent = self.make_user(id="recent", last_activity_at=self.now - timedelta(days=1))

        result = MODULE.find_inactive_users([boundary, recent, old], self.now - timedelta(days=90))

        self.assertEqual([user.id for user in result], ["old"])

    def test_never_active_user_uses_creation_time(self):
        old = self.make_user(id="old", last_activity_at=None, created_at=self.now - timedelta(days=91))
        new = self.make_user(id="new", last_activity_at=None, created_at=self.now - timedelta(days=2))

        result = MODULE.find_inactive_users([new, old], self.now - timedelta(days=90))

        self.assertEqual([user.id for user in result], ["old"])

    def test_suspended_users_are_skipped(self):
        user = self.make_user(suspended_at=self.now - timedelta(days=2))

        self.assertEqual(MODULE.find_inactive_users([user], self.now - timedelta(days=90)), [])

    def test_print_table_includes_user(self):
        output = io.StringIO()

        with redirect_stdout(output):
            MODULE.print_users_table([self.make_user()], self.now)

        self.assertIn("Ada Lovelace", output.getvalue())
        self.assertIn("ada@example.com", output.getvalue())
        self.assertIn("100d 0h", output.getvalue())

    def test_main_does_not_delete_without_confirmation(self):
        client = MagicMock()
        client.list_users.return_value = [self.make_user()]

        with patch.object(MODULE, "SourcebotClient", return_value=client):
            with patch("builtins.input", return_value="no"), redirect_stdout(io.StringIO()):
                result = MODULE.main([
                    "--base-url", "https://sourcebot.example.com",
                    "--api-key", "test-key",
                    "--inactivity-time", "90d",
                ])

        self.assertEqual(result, 0)
        client.deprovision_user.assert_not_called()

    def test_main_deletes_after_confirmation(self):
        client = MagicMock()
        client.list_users.return_value = [self.make_user()]

        with patch.object(MODULE, "SourcebotClient", return_value=client):
            with patch("builtins.input", return_value="deprovision"), redirect_stdout(io.StringIO()):
                result = MODULE.main([
                    "--base-url", "https://sourcebot.example.com",
                    "--api-key", "test-key",
                    "--inactivity-time", "90d",
                ])

        self.assertEqual(result, 0)
        client.deprovision_user.assert_called_once_with("user-1")


if __name__ == "__main__":
    unittest.main()

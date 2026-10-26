import importlib.util
import json
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("resolveGithubRepoRevisions.py")
SPEC = importlib.util.spec_from_file_location("resolveGithubRepoRevisions", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas" / "v3"


class ResolveGithubRepoRevisionsTest(unittest.TestCase):
    def test_no_revisions_returns_none_fields(self):
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/datastore"),
            {"branches": None, "tags": None},
        )
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/datastore", None),
            {"branches": None, "tags": None},
        )
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/datastore", {}),
            {"branches": None, "tags": None},
        )

    def test_connection_level_applies_when_no_override(self):
        revisions = {
            "branches": ["main", "release/*"],
            "tags": ["v*"],
        }
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/other", revisions),
            {"branches": ["main", "release/*"], "tags": ["v*"]},
        )

    def test_per_repo_branches_replace_connection_branches_only(self):
        revisions = {
            "branches": ["main", "release/*"],
            "tags": ["v*"],
            "repositories": {
                "acme/datastore": {
                    "branches": ["datastore-release/*"],
                }
            },
        }
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/datastore", revisions),
            {"branches": ["datastore-release/*"], "tags": ["v*"]},
        )
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/frontend", revisions),
            {"branches": ["main", "release/*"], "tags": ["v*"]},
        )

    def test_per_repo_can_override_tags_independently(self):
        revisions = {
            "branches": ["main"],
            "tags": ["v*"],
            "repositories": {
                "acme/frontend": {
                    "tags": ["v*", "rc-*"],
                }
            },
        }
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/frontend", revisions),
            {"branches": ["main"], "tags": ["v*", "rc-*"]},
        )

    def test_per_repo_empty_branches_clears_connection_branches(self):
        revisions = {
            "branches": ["main", "release/*"],
            "repositories": {
                "acme/docs": {
                    "branches": [],
                }
            },
        }
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/docs", revisions),
            {"branches": [], "tags": None},
        )

    def test_repository_key_match_is_exact_and_case_sensitive(self):
        revisions = {
            "branches": ["main"],
            "repositories": {
                "acme/datastore": {"branches": ["datastore-release/*"]},
            },
        }
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("Acme/datastore", revisions)["branches"],
            ["main"],
        )
        self.assertEqual(
            MODULE.resolve_github_repo_revisions("acme/datastore-extra", revisions)["branches"],
            ["main"],
        )

    def test_apply_revisions_to_repos_batch(self):
        example = MODULE.merge_connection_example()
        resolved = MODULE.apply_revisions_to_repos(
            ["acme/datastore", "acme/frontend", "acme/backend"],
            example["revisions"],
        )
        self.assertEqual(
            resolved["acme/datastore"],
            {"branches": ["datastore-release/*"], "tags": ["v*"]},
        )
        self.assertEqual(
            resolved["acme/frontend"],
            {"branches": ["main", "release/*"], "tags": ["v*", "rc-*"]},
        )
        self.assertEqual(
            resolved["acme/backend"],
            {"branches": ["main", "release/*"], "tags": ["v*"]},
        )


class GithubRevisionsSchemaE2ETest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            import jsonschema
            from jsonschema import Draft7Validator
            from referencing import Registry, Resource
            from referencing.jsonschema import DRAFT7
        except ImportError as exc:  # pragma: no cover - exercised in CI after pip install
            raise unittest.SkipTest(
                f"jsonschema stack not installed: {exc}. "
                "Install with: pip install 'jsonschema>=4.18' referencing"
            )

        cls.jsonschema = jsonschema
        cls.Draft7Validator = Draft7Validator

        resources = []
        for path in SCHEMAS_DIR.glob("*.json"):
            schema = json.loads(path.read_text())
            # Register under the relative filenames used by $ref in the schemas.
            resources.append((path.name, Resource.from_contents(schema, default_specification=DRAFT7)))
            resources.append((f"./{path.name}", Resource.from_contents(schema, default_specification=DRAFT7)))

        registry = Registry().with_resources(resources)
        github_schema = json.loads((SCHEMAS_DIR / "github.json").read_text())
        cls.validator = Draft7Validator(github_schema, registry=registry)

    def assert_valid(self, instance):
        errors = sorted(self.validator.iter_errors(instance), key=lambda e: list(e.path))
        if errors:
            messages = "; ".join(f"{list(e.path)}: {e.message}" for e in errors)
            self.fail(f"expected valid config, got: {messages}")

    def assert_invalid(self, instance):
        errors = list(self.validator.iter_errors(instance))
        self.assertTrue(errors, "expected schema validation errors")

    def test_legacy_global_revisions_still_valid(self):
        self.assert_valid(
            {
                "type": "github",
                "repos": ["acme/frontend"],
                "revisions": {
                    "branches": ["main", "release/*"],
                    "tags": ["v*"],
                },
            }
        )

    def test_per_repository_revisions_valid(self):
        self.assert_valid(MODULE.merge_connection_example())

    def test_repositories_only_override_valid(self):
        self.assert_valid(
            {
                "type": "github",
                "orgs": ["acme"],
                "revisions": {
                    "repositories": {
                        "acme/datastore": {
                            "branches": ["datastore-release/*"],
                        }
                    }
                },
            }
        )

    def test_invalid_repository_key_rejected(self):
        self.assert_invalid(
            {
                "type": "github",
                "revisions": {
                    "repositories": {
                        "not-a-valid-key": {
                            "branches": ["main"],
                        }
                    }
                },
            }
        )

    def test_unknown_revisions_property_rejected(self):
        self.assert_invalid(
            {
                "type": "github",
                "revisions": {
                    "branches": ["main"],
                    "unexpected": True,
                },
            }
        )

    def test_e2e_issue_scenario_datastore_release_isolation(self):
        """SOU-2701: datastore-release/* applies only to the datastore repo."""
        config = {
            "type": "github",
            "orgs": ["acme"],
            "revisions": {
                "branches": ["main"],
                "repositories": {
                    "acme/datastore": {
                        "branches": ["datastore-release/*"],
                    }
                },
            },
        }
        self.assert_valid(config)

        resolved = MODULE.apply_revisions_to_repos(
            ["acme/datastore", "acme/payments", "acme/web"],
            config["revisions"],
        )
        self.assertEqual(resolved["acme/datastore"]["branches"], ["datastore-release/*"])
        self.assertEqual(resolved["acme/payments"]["branches"], ["main"])
        self.assertEqual(resolved["acme/web"]["branches"], ["main"])
        self.assertNotIn(
            "datastore-release/*",
            resolved["acme/payments"]["branches"] + resolved["acme/web"]["branches"],
        )


if __name__ == "__main__":
    unittest.main()

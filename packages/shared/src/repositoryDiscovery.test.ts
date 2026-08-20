import { describe, expect, test } from "vitest";
import { repositoryDiscoveryIssueSchema } from "./repositoryDiscovery.js";

describe("repositoryDiscoveryIssueSchema", () => {
    test("allows an issue without a subject", () => {
        expect(
            repositoryDiscoveryIssueSchema.parse({
                code: "INVALID_PROVIDER_RESPONSE",
                effect: "DISCOVERY_INCOMPLETE",
                message: "The provider returned an invalid repository.",
            }),
        ).toEqual({
            code: "INVALID_PROVIDER_RESPONSE",
            effect: "DISCOVERY_INCOMPLETE",
            message: "The provider returned an invalid repository.",
        });
    });

    test("accepts an authentication fallback issue", () => {
        expect(
            repositoryDiscoveryIssueSchema.parse({
                code: "AUTHENTICATION_FALLBACK",
                effect: "DISCOVERY_INCOMPLETE",
                subject: {
                    kind: "configuration",
                    value: "GitHub App installation for sourcebot on github.com",
                },
                message:
                    "No matching GitHub App installation was found. Discovery used legacy credentials and may be incomplete.",
            }),
        ).toEqual({
            code: "AUTHENTICATION_FALLBACK",
            effect: "DISCOVERY_INCOMPLETE",
            subject: {
                kind: "configuration",
                value: "GitHub App installation for sourcebot on github.com",
            },
            message:
                "No matching GitHub App installation was found. Discovery used legacy credentials and may be incomplete.",
        });
    });
});

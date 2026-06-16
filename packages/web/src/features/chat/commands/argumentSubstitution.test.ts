import { describe, expect, test } from "vitest";
import { getArgumentHint, getArgumentHintTokenStates, parseArgumentNames, parseArguments, substituteArguments } from "./argumentSubstitution";

describe("parseArguments", () => {
    test("splits arguments shell-style", () => {
        expect(parseArguments('hello "good morning" Spanish')).toEqual(["hello", "good morning", "Spanish"]);
    });

    test("preserves empty quoted arguments", () => {
        expect(parseArguments('"" next')).toEqual(["", "next"]);
    });

    test("groups tokens inside single quotes", () => {
        expect(parseArguments("'hello world' next")).toEqual(["hello world", "next"]);
    });

    test("does not process escape sequences inside single quotes", () => {
        expect(parseArguments("'a\\nb'")).toEqual(["a\\nb"]);
    });

    test("escapes the quote character inside double quotes", () => {
        expect(parseArguments('"a\\"b"')).toEqual(['a"b']);
    });

    test("escapes whitespace outside quotes", () => {
        expect(parseArguments("foo\\ bar")).toEqual(["foo bar"]);
    });

    test("flushes the accumulated token when a quote is left unterminated", () => {
        expect(parseArguments('"hello')).toEqual(["hello"]);
    });
});

describe("parseArgumentNames", () => {
    test("parses shell-style names", () => {
        expect(parseArgumentNames("language topic")).toEqual(["language", "topic"]);
    });

    test("rejects numeric and reserved names", () => {
        expect(() => parseArgumentNames("0 topic")).toThrow("Invalid argument name: 0");
        expect(() => parseArgumentNames("ARGUMENTS topic")).toThrow("Invalid argument name: ARGUMENTS");
    });
});

describe("substituteArguments", () => {
    test("replaces $ARGUMENTS with the full raw string", () => {
        expect(substituteArguments(
            "Write a clear commit message for: $ARGUMENTS",
            "fix race condition in auth cache",
        )).toBe("Write a clear commit message for: fix race condition in auth cache");
    });

    test("does not append trailing arguments after full raw argument substitution", () => {
        expect(substituteArguments(
            "Write a clear commit message for: $ARGUMENTS",
            "fix race condition in auth cache",
        )).toBe("Write a clear commit message for: fix race condition in auth cache");
    });

    test("replaces zero-based positional shorthand", () => {
        expect(substituteArguments(
            'Translate the word "$0" into $1.',
            "hello French",
        )).toBe('Translate the word "hello" into French.');
    });

    test("appends trailing arguments after positional substitutions", () => {
        expect(substituteArguments(
            "Review $0.",
            "src/auth/session.ts carefully for races",
        )).toBe("Review src/auth/session.ts.\nARGUMENTS: carefully for races");
    });

    test("replaces explicit indexed arguments", () => {
        expect(substituteArguments(
            'Open a PR titled "$ARGUMENTS[0]" targeting the $ARGUMENTS[1] branch.',
            '"Add rate limiting" main',
        )).toBe('Open a PR titled "Add rate limiting" targeting the main branch.');
    });

    test("preserves out-of-range positional-looking literals", () => {
        expect(substituteArguments(
            "Write about pricing that costs $10.",
            "src/billing.ts",
        )).toBe("Write about pricing that costs $10.\nARGUMENTS: src/billing.ts");
    });

    test("preserves out-of-range explicit indexed placeholders", () => {
        expect(substituteArguments(
            "Compare $ARGUMENTS[0] with $ARGUMENTS[10].",
            "current",
        )).toBe("Compare current with $ARGUMENTS[10].");
    });

    test("replaces named arguments by position", () => {
        expect(substituteArguments(
            "Generate a beginner-friendly $language tutorial about $topic.",
            "Python decorators",
            ["language", "topic"],
        )).toBe("Generate a beginner-friendly Python tutorial about decorators.");
    });

    test("does not partially replace named arguments", () => {
        expect(substituteArguments(
            "Compare $language with $languages.",
            "Python",
            ["language"],
        )).toBe("Compare Python with $languages.");
    });

    test("appends raw arguments when the instructions have no placeholders", () => {
        expect(substituteArguments(
            "Review the code for security vulnerabilities and explain any findings.",
            "src/auth/session.ts",
        )).toBe("Review the code for security vulnerabilities and explain any findings.\nARGUMENTS: src/auth/session.ts");
    });

    test("does not re-substitute placeholder-like text from named argument values", () => {
        expect(substituteArguments(
            "Named value: $language; second: $topic",
            '"$topic token" details',
            ["language", "topic"],
        )).toBe("Named value: $topic token; second: details");
    });

    test("does not re-substitute placeholder-like text from indexed argument values", () => {
        expect(substituteArguments(
            "Indexed value: $ARGUMENTS[0]; second: $1",
            '"$1 token" details',
        )).toBe("Indexed value: $1 token; second: details");
    });

    test("does not re-substitute placeholder-like text from positional argument values", () => {
        expect(substituteArguments(
            "Positional value: $0; raw: $ARGUMENTS",
            '"$ARGUMENTS token" details',
        )).toBe('Positional value: $ARGUMENTS token; raw: "$ARGUMENTS token" details');
    });

    test("substitutes an empty string for a named argument with no value", () => {
        expect(substituteArguments(
            "Generate a $language tutorial about $topic.",
            "Python",
            ["language", "topic"],
        )).toBe("Generate a Python tutorial about .");
    });

    test("does not append an ARGUMENTS line when the raw arguments are only whitespace", () => {
        expect(substituteArguments(
            "Review the code for security vulnerabilities.",
            "   ",
        )).toBe("Review the code for security vulnerabilities.");
    });

    test("does not append an ARGUMENTS line when there are no placeholders and no arguments", () => {
        expect(substituteArguments(
            "Review the code for security vulnerabilities.",
            "",
        )).toBe("Review the code for security vulnerabilities.");
    });
});

describe("getArgumentHint", () => {
    test("prefers named argument hints", () => {
        expect(getArgumentHint("Generate a $language tutorial about $topic.", ["language", "topic"]))
            .toBe("<language> <topic>");
    });

    test("derives hints from positional placeholders", () => {
        expect(getArgumentHint('Translate "$0" into $1.')).toBe("<arg0> <arg1>");
    });

    test("fills positional hint gaps through the highest referenced index", () => {
        expect(getArgumentHint("Use the second argument: $1.")).toBe("<arg0> <arg1>");
        expect(getArgumentHint("Use the third argument: $ARGUMENTS[2].")).toBe("<arg0> <arg1> <arg2>");
    });

    test("does not infer positional hints from price-like shorthand", () => {
        expect(getArgumentHint("Summarize pricing for a $10 plan.")).toBeUndefined();
        expect(getArgumentHint("Compare $0 against the $10 plan.")).toBe("<arg0>");
    });

    test("derives multi-digit hints from explicit indexed placeholders", () => {
        expect(getArgumentHint("Use the eleventh argument: $ARGUMENTS[10]."))
            .toBe("<arg0> <arg1> <arg2> <arg3> <arg4> <arg5> <arg6> <arg7> <arg8> <arg9> <arg10>");
    });

    test("derives a generic hint from a bare $ARGUMENTS placeholder", () => {
        expect(getArgumentHint("Write a clear commit message for: $ARGUMENTS")).toBe("<arguments>");
    });
});

describe("getArgumentHintTokenStates", () => {
    test("marks discrete hint tokens as filled by parsed argument count", () => {
        expect(getArgumentHintTokenStates("<language> <topic> <audience>", 'TypeScript "React Server Components"'))
            .toEqual([
                { token: "<language>", isFilled: true },
                { token: "<topic>", isFilled: true },
                { token: "<audience>", isFilled: false },
            ]);
    });

    test("treats a bare arguments hint as filled only when raw arguments are present", () => {
        expect(getArgumentHintTokenStates("<arguments>", "")).toEqual([
            { token: "<arguments>", isFilled: false },
        ]);
        expect(getArgumentHintTokenStates("<arguments>", "fix auth cache")).toEqual([
            { token: "<arguments>", isFilled: true },
        ]);
    });
});

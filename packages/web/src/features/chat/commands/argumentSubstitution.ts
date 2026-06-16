export const parseArguments = (input: string): string[] => {
    const args: string[] = [];
    let current = "";
    let quote: "'" | '"' | null = null;
    let hasCurrent = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (quote) {
            if (char === quote) {
                quote = null;
                hasCurrent = true;
                continue;
            }

            if (char === "\\" && quote === '"' && i + 1 < input.length) {
                current += input[i + 1];
                hasCurrent = true;
                i += 1;
                continue;
            }

            current += char;
            hasCurrent = true;
            continue;
        }

        if (/\s/.test(char)) {
            if (hasCurrent) {
                args.push(current);
                current = "";
                hasCurrent = false;
            }
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            hasCurrent = true;
            continue;
        }

        if (char === "\\" && i + 1 < input.length) {
            current += input[i + 1];
            hasCurrent = true;
            i += 1;
            continue;
        }

        current += char;
        hasCurrent = true;
    }

    if (hasCurrent) {
        args.push(current);
    }

    return args;
};

export const isValidArgumentName = (name: string): boolean =>
    /^[A-Za-z_]\w*$/.test(name) && !/^\d+$/.test(name) && name !== "ARGUMENTS";

export const parseArgumentNames = (input: string): string[] => {
    const names = parseArguments(input);
    const invalidName = names.find((name) => !isValidArgumentName(name));

    if (invalidName) {
        throw new Error(`Invalid argument name: ${invalidName}`);
    }

    return names;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const substituteArguments = (
    instructions: string,
    rawArguments: string,
    argumentNames: string[] = [],
): string => {
    const args = parseArguments(rawArguments);
    let hasSubstitution = false;
    let usesFullArguments = false;
    let maxConsumedArgumentIndex = -1;
    const namedArgumentPattern = argumentNames.length > 0
        ? `|\\$(${argumentNames.map(escapeRegExp).join("|")})(?![\\[\\w])`
        : "";
    const placeholderPattern = new RegExp(
        `\\$ARGUMENTS\\[(\\d+)\\]|\\$(\\d+)|\\$ARGUMENTS${namedArgumentPattern}`,
        "g",
    );

    const result = instructions.replace(
        placeholderPattern,
        (match: string, ...capturesAndMetadata: unknown[]) => {
            const indexedArgument = capturesAndMetadata[0] as string | undefined;
            const positionalArgument = capturesAndMetadata[1] as string | undefined;
            const namedArgument = argumentNames.length > 0
                ? capturesAndMetadata[2] as string | undefined
                : undefined;

            if (indexedArgument !== undefined) {
                const argumentIndex = Number(indexedArgument);
                const argument = args[argumentIndex];
                if (argument === undefined) {
                    return match;
                }

                hasSubstitution = true;
                maxConsumedArgumentIndex = Math.max(maxConsumedArgumentIndex, argumentIndex);
                return argument;
            }

            if (positionalArgument !== undefined) {
                const argumentIndex = Number(positionalArgument);
                const argument = args[argumentIndex];
                if (argument === undefined) {
                    return match;
                }

                hasSubstitution = true;
                maxConsumedArgumentIndex = Math.max(maxConsumedArgumentIndex, argumentIndex);
                return argument;
            }

            if (namedArgument !== undefined) {
                const argumentIndex = argumentNames.indexOf(namedArgument);
                hasSubstitution = true;
                maxConsumedArgumentIndex = Math.max(maxConsumedArgumentIndex, argumentIndex);
                return args[argumentIndex] ?? "";
            }

            if (match === "$ARGUMENTS") {
                hasSubstitution = true;
                usesFullArguments = true;
                return rawArguments;
            }

            return match;
        },
    );

    const trailingArguments = usesFullArguments
        ? ""
        : args.slice(maxConsumedArgumentIndex + 1).join(" ").trim();
    if (hasSubstitution && trailingArguments.length > 0) {
        return `${result}\nARGUMENTS: ${trailingArguments}`;
    }

    if (!hasSubstitution && rawArguments.trim().length > 0) {
        return `${result}\nARGUMENTS: ${rawArguments}`;
    }

    return result;
};

export const getArgumentHint = (instructions: string, argumentNames: string[] = []): string | undefined => {
    if (argumentNames.length > 0) {
        return argumentNames.map((name) => `<${name}>`).join(" ");
    }

    let maxPositionalIndex = -1;
    for (const match of instructions.matchAll(/\$ARGUMENTS\[(\d+)\]|\$(\d)(?!\d)/g)) {
        maxPositionalIndex = Math.max(maxPositionalIndex, Number(match[1] ?? match[2]));
    }

    if (maxPositionalIndex >= 0) {
        return Array.from({ length: maxPositionalIndex + 1 }, (_, index) => index)
            .map((index) => `<arg${index}>`)
            .join(" ");
    }

    if (/\$ARGUMENTS(?!\[)/.test(instructions)) {
        return "<arguments>";
    }

    return undefined;
};

export const getArgumentHintTokenStates = (argumentHint: string, rawArguments: string) => {
    const tokens = argumentHint.trim().split(/\s+/).filter(Boolean);
    const filledCount = argumentHint === "<arguments>"
        ? Number(rawArguments.trim().length > 0)
        : parseArguments(rawArguments).length;

    return tokens.map((token, index) => ({
        token,
        isFilled: index < filledCount,
    }));
};

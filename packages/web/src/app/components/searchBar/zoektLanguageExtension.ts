import { LanguageSupport, StreamLanguage } from "@codemirror/language";

export const zoekt = () => {
    const zoektLanguage = StreamLanguage.define({
        startState() {
            return {
                inString: false,
                escaped: false
            };
        },
        token(stream, state) {
            // Handle strings
            if (state.inString) {
                if (state.escaped) {
                    state.escaped = false;
                    stream.next();
                    return "string";
                }
                const ch = stream.next();
                if (ch === "\\") {
                    state.escaped = true;
                    return "string";
                } else if (ch === '"') {
                    // End of string
                    state.inString = false;
                    return "string";
                } else {
                    return "string";
                }
            }

            // Skip whitespace
            if (stream.eatSpace()) {
                return null;
            }

            // Negation operator
            if (stream.match(/-/)) {
                return "operator";
            }

            // Parentheses
            if (stream.match("(") || stream.match(")")) {
                return "paren";
            }

            // Check for prefixes first
            // If these match, we return 'keyword'
            if (stream.match(/(archived:|branch:|b:|c:|case:|content:|f:|file:|fork:|public:|r:|repo:|regex:|lang:|sym:|t:|type:)/)) {
                return "keyword";
            }

            // Now try matching a standalone word
            // If the word is "or", return keyword; else nothing special
            if (stream.match(/[A-Za-z0-9_]+/)) {
                const word = stream.current();
                if (word === "or") {
                    return "keyword";
                }
                return null;
            }

            // Double-quoted string start
            if (stream.peek() === '"') {
                stream.next(); // consume opening quote
                state.inString = true;
                return "string";
            }

            // If we reach here, consume a single character and return null
            stream.next();
            return null;
        }
    });

    return new LanguageSupport(zoektLanguage);
};

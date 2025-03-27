import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

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
                    return t.string.toString();
                }
                const ch = stream.next();
                if (ch === "\\") {
                    state.escaped = true;
                    return t.string.toString();
                } else if (ch === '"') {
                    // End of string
                    state.inString = false;
                    return t.string.toString();
                } else {
                    return t.string.toString();
                }
            }

            // Skip whitespace
            if (stream.eatSpace()) {
                return null;
            }

            // Negation operator
            if (stream.match(/-/)) {
                return t.operator.toString();
            }

            // Parentheses
            if (stream.match("(") || stream.match(")")) {
                return t.paren.toString();
            }

            // Check for prefixes first
            // If these match, we return 'keyword'
            if (stream.match(/(archived:|branch:|b:|rev:|c:|case:|content:|f:|file:|fork:|public:|r:|repo:|regex:|lang:|sym:|t:|type:)/)) {
                return t.keyword.toString();
            }

            // Now try matching a standalone word
            // If the word is "or", return keyword; else nothing special
            if (stream.match(/[A-Za-z0-9_]+/)) {
                const word = stream.current();
                if (word === "or") {
                    return t.keyword.toString();
                }
                return null;
            }

            // Double-quoted string start
            if (stream.peek() === '"') {
                stream.next(); // consume opening quote
                state.inString = true;
                return t.string.toString();
            }

            // If we reach here, consume a single character and return null
            stream.next();
            return null;
        }
    });

    return new LanguageSupport(zoektLanguage);
};

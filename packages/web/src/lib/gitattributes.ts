import micromatch from 'micromatch';

// GitAttributes holds parsed .gitattributes rules for overriding language detection.
export interface GitAttributes {
    rules: GitAttributeRule[];
}

interface GitAttributeRule {
    pattern: string;
    attrs: Record<string, string>;
}

// parseGitAttributes parses the content of a .gitattributes file.
// Each non-comment, non-empty line has the form: pattern attr1 attr2=value ...
// Attributes can be:
//   - "linguist-vendored" (set/true), "-linguist-vendored" (unset/false)
//   - "linguist-language=Go"
//   - etc.
export function parseGitAttributes(content: string): GitAttributes {
    const rules: GitAttributeRule[] = [];

    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }

        const fields = line.split(/\s+/);
        if (fields.length < 2) {
            continue;
        }

        const pattern = fields[0];
        const attrs: Record<string, string> = {};

        for (const field of fields.slice(1)) {
            if (field.startsWith('!')) {
                // !attr means unspecified (reset to default)
                attrs[field.slice(1)] = 'unspecified';
            } else if (field.startsWith('-')) {
                // -attr means unset (false)
                attrs[field.slice(1)] = 'false';
            } else {
                const eqIdx = field.indexOf('=');
                if (eqIdx !== -1) {
                    // attr=value
                    attrs[field.slice(0, eqIdx)] = field.slice(eqIdx + 1);
                } else {
                    // attr alone means set (true)
                    attrs[field] = 'true';
                }
            }
        }

        rules.push({ pattern, attrs });
    }

    return { rules };
}

// matchesGitAttributesPattern applies gitattributes pattern rules: a pattern
// without a slash matches the file name at any depth, and any other pattern
// is matched against the full path from the repository root.
// @see https://git-scm.com/docs/gitattributes#_description
function matchesGitAttributesPattern(filePath: string, pattern: string): boolean {
    if (!pattern.includes('/')) {
        const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
        return micromatch.isMatch(fileName, pattern, { dot: true });
    }
    return micromatch.isMatch(filePath, pattern.replace(/^\//, ''), { dot: true });
}

// resolveLanguageFromGitAttributes returns the linguist-language override for
// the given file path based on the parsed .gitattributes rules, or undefined
// if no rule matches. Last matching rule wins, consistent with gitattributes semantics.
export function resolveLanguageFromGitAttributes(filePath: string, gitAttributes: GitAttributes): string | undefined {
    let language: string | undefined;
    for (const rule of gitAttributes.rules) {
        if (matchesGitAttributesPattern(filePath, rule.pattern) && rule.attrs['linguist-language']) {
            language = rule.attrs['linguist-language'];
        }
    }
    return language;
}

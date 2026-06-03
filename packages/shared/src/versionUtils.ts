const SEMVER_REGEX = /^v(\d+)\.(\d+)\.(\d+)$/;

export type Version = {
    major: number;
    minor: number;
    patch: number;
};

export const parseVersion = (version: string): Version | null => {
    const match = version.match(SEMVER_REGEX);
    if (!match) {
        return null;
    }
    return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3]),
    };
};

export const formatVersion = (version: Version): string => {
    return `v${version.major}.${version.minor}.${version.patch}`;
};

/**
 * Returns < 0 if `a < b`, 0 if equal, > 0 if `a > b`.
 */
export const compareVersions = (a: Version, b: Version): number => {
    if (a.major !== b.major) {
        return a.major - b.major;
    }
    if (a.minor !== b.minor) {
        return a.minor - b.minor;
    }
    return a.patch - b.patch;
};

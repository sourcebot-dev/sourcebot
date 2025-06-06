/**
 * Utilities for displaying repository names in a user-friendly way,
 * especially for long GitLab project names with nested groups.
 */

export interface TruncatedRepoDisplay {
    displayText: string;
    fullText: string;
    isTruncated: boolean;
    parts?: string[];
}

/**
 * Intelligently truncates repository names for display in constrained spaces.
 * For GitLab nested groups, prioritizes showing the project name and immediate parent.
 * Always shows at least one parent group + project (if groups exist), even if both need truncation.
 * 
 * Examples:
 * - "very-long-group/another-group/subgroup/my-project" → "subgroup/my-project"
 * - "group/project" → "group/project" (no truncation needed)
 * - "extremely-long-group-name-here/another-extremely-long-group/final-group/my-awesome-project-with-long-name"
 *   → "final-gr…/my-awesome-proj…"
 */
export function createTruncatedRepoDisplay(
    repoName: string,
    maxLength: number = 50,
    showParts: number = 2
): TruncatedRepoDisplay {
    const parts = repoName.split('/');
    const fullText = repoName;

    // If it's short enough, don't truncate
    if (repoName.length <= maxLength) {
        return {
            displayText: repoName,
            fullText,
            isTruncated: false,
            parts
        };
    }

    // For multiple parts, always show at least the last parent + project
    const relevantParts = parts.slice(-showParts);
    let displayText = relevantParts.join('/');

    // If still too long, truncate both parent and project proportionally
    if (displayText.length > maxLength) {
        const projectName = relevantParts[relevantParts.length - 1];
        const parentParts = relevantParts.slice(0, -1);
        const parentPath = parentParts.join('/');
        
        // Reserve space for the slash and ellipsis characters
        const reservedChars = 3; // "/" + "…" for each truncated part
        const availableLength = maxLength - reservedChars;
        
        // Allocate space: give slight preference to project name
        const projectAllocation = Math.max(8, Math.floor(availableLength * 0.6));
        const parentAllocation = availableLength - projectAllocation;
        
        let truncatedProject = projectName;
        let truncatedParent = parentPath;
        
        // Truncate project if needed
        if (projectName.length > projectAllocation) {
            truncatedProject = projectName.substring(0, projectAllocation - 1) + '…';
        }
        
        // Truncate parent if needed
        if (parentPath.length > parentAllocation) {
            // For parent groups, truncate from the right to keep the beginning part
            truncatedParent = parentPath.substring(0, parentAllocation - 1) + '…';
        }
        
        displayText = truncatedParent + '/' + truncatedProject;
    }

    return {
        displayText,
        fullText,
        isTruncated: true,
        parts
    };
}

/**
 * Creates a breadcrumb-style display for repository names with intelligent collapsing.
 * Shows first part, ellipsis, and last N parts for very long paths.
 * 
 * Example: "group1/group2/group3/group4/project" → ["group1", "…", "group4", "project"]
 */
export function createBreadcrumbRepoDisplay(
    repoName: string,
    maxVisibleParts: number = 3
): { parts: string[], isCollapsed: boolean, fullParts: string[] } {
    const fullParts = repoName.split('/');
    
    if (fullParts.length <= maxVisibleParts) {
        return {
            parts: fullParts,
            isCollapsed: false,
            fullParts
        };
    }

    // Show first part, ellipsis, then last (maxVisibleParts - 2) parts
    const visibleEndParts = maxVisibleParts - 2; // Account for first part and ellipsis
    const parts = [
        fullParts[0],
        '…',
        ...fullParts.slice(-visibleEndParts)
    ];

    return {
        parts,
        isCollapsed: true,
        fullParts
    };
}

/**
 * Extracts just the project name from a repository path.
 * Useful for very constrained spaces like carousel items.
 */
export function getProjectName(repoName: string): string {
    const parts = repoName.split('/');
    return parts[parts.length - 1];
}

/**
 * Creates a compact display that shows project name with group context in parentheses.
 * Example: "my-project (from group/subgroup)"
 */
export function createCompactRepoDisplay(
    repoName: string,
    maxLength: number = 40
): TruncatedRepoDisplay {
    const parts = repoName.split('/');
    const projectName = parts[parts.length - 1];
    const fullText = repoName;

    if (parts.length === 1) {
        return createTruncatedRepoDisplay(repoName, maxLength);
    }

    const groupPath = parts.slice(0, -1).join('/');
    const compactFormat = `${projectName} (${groupPath})`;

    if (compactFormat.length <= maxLength) {
        return {
            displayText: compactFormat,
            fullText,
            isTruncated: false,
            parts
        };
    }

    // Try to fit by truncating the group path
    const baseLength = projectName.length + 3; // " ()" = 3 chars
    const availableForGroup = maxLength - baseLength;

    if (availableForGroup > 10) {
        const truncatedGroup = groupPath.length > availableForGroup 
            ? '…' + groupPath.substring(groupPath.length - availableForGroup + 1)
            : groupPath;
        
        return {
            displayText: `${projectName} (${truncatedGroup})`,
            fullText,
            isTruncated: true,
            parts
        };
    }

    // If even that doesn't fit, just show the project name
    return {
        displayText: projectName.length > maxLength 
            ? projectName.substring(0, maxLength - 1) + '…'
            : projectName,
        fullText,
        isTruncated: true,
        parts
    };
} 
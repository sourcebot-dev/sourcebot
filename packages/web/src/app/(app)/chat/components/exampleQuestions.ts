export type ExampleQuestionIcon =
    | "book"
    | "database"
    | "error"
    | "flask"
    | "list"
    | "logs"
    | "package"
    | "search"
    | "settings"
    | "variable";

export interface ExampleQuestion {
    label: string;
    question: string;
    icon: ExampleQuestionIcon;
}

export const exampleQuestions = [
    {
        label: "Entry points",
        question: "Find the main entry points across all repositories.",
        icon: "search",
    },
    {
        label: "Configuration",
        question: "Where is configuration defined and loaded?",
        icon: "settings",
    },
    {
        label: "Testing",
        question: "Find examples of how this code is tested.",
        icon: "flask",
    },
    {
        label: "Error handling",
        question: "Find common error-handling patterns across the codebase.",
        icon: "error",
    },
    {
        label: "Data models",
        question: "Where are the main data models defined?",
        icon: "database",
    },
    {
        label: "TODOs",
        question: "Find TODOs and summarize the unfinished work.",
        icon: "list",
    },
    {
        label: "Dependencies",
        question: "Where are project dependencies declared and configured?",
        icon: "package",
    },
    {
        label: "Environment",
        question: "Where are environment variables read and used?",
        icon: "variable",
    },
    {
        label: "Logging",
        question: "Where and how is logging used?",
        icon: "logs",
    },
    {
        label: "Documentation",
        question: "Find the most useful developer documentation.",
        icon: "book",
    },
] as const satisfies readonly ExampleQuestion[];

export const selectRandomExampleQuestions = (
    count: number,
    random: () => number = Math.random,
): ExampleQuestion[] => {
    const shuffled: ExampleQuestion[] = [...exampleQuestions];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [
            shuffled[swapIndex]!,
            shuffled[index]!,
        ];
    }

    return shuffled.slice(0, Math.max(0, count));
};

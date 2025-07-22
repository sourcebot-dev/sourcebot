import { NewsItem } from "./types";

export const newsData: NewsItem[] = [
    {
        unique_id: "agentic-search",
        header: "Agentic Search",
        sub_header: "Ask Sourcebot to search, summarize, and explain code. Bring your own LLM.",
        url: "https://docs.sourcebot.dev/docs/features/search/agentic-search/overview"
    },
    {
        unique_id: "anonymous-access",
        header: "Anonymous Access",
        sub_header: "We've added the ability to disable the need for users to login to Sourcebot.",
        url: "https://docs.sourcebot.dev/docs/configuration/auth/access-settings"
    },
    {
        unique_id: "member-approval",
        header: "Member Approval",
        sub_header: "We've added a toggle to control whether new users need to be approved.",
        url: "https://docs.sourcebot.dev/docs/configuration/auth/access-settings"
    },
    {
        unique_id: "analytics",
        header: "Analytics Dashboard",
        sub_header: "Understand your team's Sourcebot usage",
        url: "https://docs.sourcebot.dev/docs/features/analytics"
    },
    {
        unique_id: "audit-logs",
        header: "Audit Logs",
        sub_header: "We've added support for audit logs",
        url: "https://docs.sourcebot.dev/docs/configuration/audit-logs"
    },
    {
        unique_id: "file-explorer",
        header: "File Explorer",
        sub_header: "We've added support for a file explorer when browsing files.",
        url: "https://github.com/sourcebot-dev/sourcebot/releases/tag/v4.2.0"
    },
    {
        unique_id: "structured-logging",
        header: "Structured Logging",
        sub_header: "We've added support for structured logging",
        url: "https://docs.sourcebot.dev/docs/configuration/structured-logging"
    },
    {
        unique_id: "code-nav",
        header: "Code Navigation",
        sub_header: "Built in go-to definition and find references",
        url: "https://docs.sourcebot.dev/docs/features/code-navigation"
    },
    {
        unique_id: "sso",
        header: "SSO",
        sub_header: "We've added support for SSO providers",
        url: "https://docs.sourcebot.dev/docs/configuration/auth/overview",
    },
    {
        unique_id: "search-contexts",
        header: "Search Contexts",
        sub_header: "Filter searches by groups of repos",
        url: "https://docs.sourcebot.dev/docs/features/search/search-contexts"
    }
]; 
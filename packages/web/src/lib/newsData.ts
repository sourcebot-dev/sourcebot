import { NewsItem } from "./types";

// Sample news data - replace with your actual data source
export const newsData: NewsItem[] = [
  {
    unique_id: "code-nav",
    header: "Code navigation",
    sub_header: "Built in go-to definition and find references",
    url: "https://docs.sourcebot.dev", // TODO: link to code nav docs
  },
  {
    unique_id: "sso",
    header: "SSO",
    sub_header: "We've added support for SSO providers",
    url: "https://docs.sourcebot.dev/self-hosting/configuration/authentication",
  },
  {
    unique_id: "search-contexts",
    header: "Search contexts",
    sub_header: "Group repos into different search contexts to search against",
    url: "https://docs.sourcebot.dev/docs/search/search-contexts"
  }
]; 
export const MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME = 'sb.mobile-unsupported-splash-screen-dismissed';
export const AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME = 'sb.agentic-search-tutorial-dismissed';
export const OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME = 'sb.optional-providers-link-skipped';

// NOTE: changing SOURCEBOT_GUEST_USER_ID may break backwards compatibility since this value is used
// to detect old guest users in the DB. If you change this value ensure it doesn't break upgrade flows
export const SOURCEBOT_GUEST_USER_ID = '1';
export const SOURCEBOT_GUEST_USER_EMAIL = 'guest@sourcebot.dev';
export const SINGLE_TENANT_ORG_ID = 1;
export const SINGLE_TENANT_ORG_NAME = 'default';

export { SOURCEBOT_SUPPORT_EMAIL } from "@sourcebot/shared/client";
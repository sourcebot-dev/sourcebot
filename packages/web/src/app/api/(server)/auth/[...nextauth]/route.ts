import { handlers } from "@/auth";
// eslint-disable-next-line authz/require-auth-wrapper -- NextAuth's own auth-flow handlers, not user-data endpoints
export const { GET, POST } = handlers;
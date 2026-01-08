import type { User, Account } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";
import { AsyncLocalStorage } from 'node:async_hooks';
import type { UserWithAccounts } from '@sourcebot/db';

const currentUserStorage = new AsyncLocalStorage<UserWithAccounts | undefined>();

export function runWithCurrentUser<T>(user: UserWithAccounts | undefined, fn: () => T): T {
    return currentUserStorage.run(user, fn);
}

export function getCurrentUser(): UserWithAccounts | undefined {
    return currentUserStorage.getStore();
}

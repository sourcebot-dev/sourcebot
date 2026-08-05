import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextRequest } from 'next/server';

const requestStorage = new AsyncLocalStorage<NextRequest>();

export function runWithRequestContext<T>(request: NextRequest, fn: () => T): T {
    return requestStorage.run(request, fn);
}

export function getCurrentRequest(): NextRequest | undefined {
    return requestStorage.getStore();
}

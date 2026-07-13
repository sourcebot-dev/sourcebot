'use client';

import { useNavigationGuard } from 'next-navigation-guard';
import { useEffect, useRef } from 'react';

interface UseUnsavedChangesGuardOptions {
    // Whether there are unsaved changes that should block navigation.
    enabled: boolean;
    // Optional native `window.confirm` used to resolve in-app navigation. Provide
    // this for the lightweight confirm flow; omit it to drive a themed dialog via
    // the returned `active` / `resolve`.
    confirm?: () => boolean;
}

interface UnsavedChangesGuard {
    // True while an in-app navigation is pending a keep/discard decision. Only
    // meaningful in themed-dialog mode (i.e. when `confirm` is not provided).
    active: boolean;
    // Resolve a pending in-app navigation: `true` discards and proceeds, `false`
    // keeps the user on the page.
    resolve: (discard: boolean) => void;
    // Suppress the guard for a deliberate programmatic navigation (e.g. a
    // save-then-redirect, where the form is still "dirty" versus its initial
    // values at the moment we navigate away).
    bypass: () => void;
}

/**
 * Guards against losing unsaved changes when the user navigates away. Centralizes
 * the navigation-guard wiring shared by the chat thread and the skill editor:
 *
 *  - in-app navigation (links, back/forward) is intercepted while `enabled`,
 *  - programmatic `router.refresh()` calls are always allowed through,
 *  - full-page unloads (refresh key, tab close) trigger the native browser prompt.
 *
 * Pass `confirm` for the simple `window.confirm` flow, or omit it and render a
 * themed dialog driven by the returned `active` / `resolve`.
 */
export function useUnsavedChangesGuard({ enabled, confirm }: UseUnsavedChangesGuardOptions): UnsavedChangesGuard {
    const bypassRef = useRef(false);

    const navGuard = useNavigationGuard({
        enabled: ({ type }) => {
            if (bypassRef.current) {
                bypassRef.current = false;
                return false;
            }
            // A "refresh" here means a client-side `router.refresh()` (not the
            // user pressing the refresh key, which is a "beforeunload"); those
            // don't lose unsaved changes. Full-page unloads are handled by the
            // native `beforeunload` listener below, so neither goes through the
            // in-app guard.
            if (type === 'refresh' || type === 'beforeunload') {
                return false;
            }
            return enabled;
        },
        ...(confirm ? { confirm } : {}),
    });

    // One-shot latch so accept()/reject() fire exactly once per activation: the
    // dialog's action buttons resolve the guard, and closing the dialog would
    // otherwise resolve it a second time via onOpenChange.
    const decisionMadeRef = useRef(false);
    useEffect(() => {
        if (navGuard.active) {
            decisionMadeRef.current = false;
        }
    }, [navGuard.active]);

    const resolve = (discard: boolean) => {
        if (decisionMadeRef.current) {
            return;
        }
        decisionMadeRef.current = true;
        if (discard) {
            navGuard.accept();
        } else {
            navGuard.reject();
        }
    };

    // Native prompt for full-page unloads (refresh key, tab close). Browsers
    // won't render a custom dialog here, so this is the unavoidable fallback.
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [enabled]);

    return {
        active: navGuard.active,
        resolve,
        bypass: () => {
            bypassRef.current = true;
        },
    };
}

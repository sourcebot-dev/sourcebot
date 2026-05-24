'use client';

import { ServiceError } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { claimActivationCode } from './actions';

// Lighthouse-side error code that means "the subscription.created webhook hasn't
// minted the activation code yet, retry shortly." Any other lighthouse error
// (session not found, install mismatch, already claimed) is terminal.
// See `lighthouse/lambda/serviceError.ts`.
const ACTIVATION_CODE_NOT_READY = 'ACTIVATION_CODE_NOT_READY';

const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 3_000;
const MAX_TOTAL_MS = 15_000;

type ClaimStatus = 'idle' | 'polling' | 'success' | 'error';

export interface UseClaimActivationCodeReturn {
    status: ClaimStatus;
    activationCode?: string;
    error?: ServiceError;
    attempt: number;
    start: (sessionId: string) => void;
    cancel: () => void;
}

export const useClaimActivationCode = (): UseClaimActivationCodeReturn => {
    const [status, setStatus] = useState<ClaimStatus>('idle');
    const [activationCode, setActivationCode] = useState<string | undefined>();
    const [error, setError] = useState<ServiceError | undefined>();
    const [attempt, setAttempt] = useState(0);

    const cancelledRef = useRef(false);

    const cancel = useCallback(() => {
        cancelledRef.current = true;
    }, []);

    const start = useCallback((sessionId: string) => {
        cancelledRef.current = false;
        const startedAt = Date.now();

        setStatus('polling');
        setActivationCode(undefined);
        setError(undefined);
        setAttempt(0);

        const run = async () => {
            let delay = INITIAL_DELAY_MS;
            let currentAttempt = 0;

            while (!cancelledRef.current) {
                currentAttempt++;
                setAttempt(currentAttempt);

                if (Date.now() - startedAt >= MAX_TOTAL_MS) {
                    setError({
                        statusCode: 408,
                        errorCode: 'CLAIM_POLL_TIMEOUT',
                        message: 'Timed out waiting for the activation code to be issued.',
                    });
                    setStatus('error');
                    return;
                }

                const result = await claimActivationCode(sessionId);
                if (cancelledRef.current) {
                    return;
                }

                if (!isServiceError(result)) {
                    setActivationCode(result.activationCode);
                    setStatus('success');
                    return;
                }

                if (result.errorCode !== ACTIVATION_CODE_NOT_READY) {
                    setError(result);
                    setStatus('error');
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, delay));
                delay = Math.min(delay * 2, MAX_DELAY_MS);
            }
        };

        void run();
    }, []);

    // Cancel any in-flight polling when the component using this hook unmounts.
    useEffect(() => {
        return () => {
            cancelledRef.current = true;
        };
    }, []);

    return {
        status,
        activationCode,
        error,
        attempt,
        start,
        cancel,
    };
};

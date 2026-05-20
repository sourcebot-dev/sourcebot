'use client';

import { ProgressProvider } from '@bprogress/next/app';

export const ProgressBarProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ProgressProvider
            color="var(--highlight)"
            height="2px"
            options={{
                showSpinner: false
            }}
            delay={300}
            shallowRouting
        >
            {children}
        </ProgressProvider>
    );
};

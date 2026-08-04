import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME } from '@/lib/constants';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { McpOAuthStatusToast } from './components/mcpOAuthStatusToast';
import { TutorialDialog } from './components/tutorialDialog';

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
    const isTutorialDismissed = (await cookies()).get(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME)?.value === "true";

    return (
        <>
            <Suspense fallback={null}>
                <McpOAuthStatusToast />
            </Suspense>
            {children}
            <TutorialDialog isOpen={!isTutorialDismissed} />
        </>
    )
}

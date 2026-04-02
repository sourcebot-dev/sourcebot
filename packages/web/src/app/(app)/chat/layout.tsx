import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME } from '@/lib/constants';
import { NavigationGuardProvider } from 'next-navigation-guard';
import { cookies } from 'next/headers';
import { TutorialDialog } from './components/tutorialDialog';

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
    const isTutorialDismissed = (await cookies()).get(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME)?.value === "true";

    return (
        // @note: we use a navigation guard here since we don't support resuming streams yet.
        // @see: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#resuming-ongoing-streams
        <NavigationGuardProvider>
            {children}
            <TutorialDialog isOpen={!isTutorialDismissed} />
        </NavigationGuardProvider>
    )
}
import { NavigationGuardProvider } from 'next-navigation-guard';

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {

    return (
        // @note: we use a navigation guard here since we don't support resuming streams yet.
        // @see: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#resuming-ongoing-streams
        <NavigationGuardProvider>
            <div className="flex flex-col h-screen w-screen">
                {children}
            </div>
        </NavigationGuardProvider>
    )
}
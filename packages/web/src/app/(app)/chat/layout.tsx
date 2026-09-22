import { Suspense } from 'react';
import { McpOAuthStatusToast } from './components/mcpOAuthStatusToast';

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
    return (
        <>
            <Suspense fallback={null}>
                <McpOAuthStatusToast />
            </Suspense>
            {children}
        </>
    )
}

import { NavigationMenu } from "../components/navigationMenu";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ domain: string }>;
}

export default async function Layout(
    props: LayoutProps
) {
    const params = await props.params;
    const { domain } = params;
    const { children } = props;

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
                <div className="w-full max-w-6xl rounded-lg p-6">
                    <div className="container mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
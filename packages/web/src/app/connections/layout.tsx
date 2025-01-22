import { NavigationMenu } from "../components/navigationMenu";

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu />
            <main className="flex-grow flex justify-center p-4">
                <div className="w-full max-w-5xl rounded-lg border p-6">{children}</div>
            </main>
        </div>
    )
}
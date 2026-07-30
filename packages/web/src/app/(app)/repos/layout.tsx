interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout(
    props: LayoutProps
) {
    const { children } = props;

    return (
        <div className="flex flex-col">
            <main className="flex-grow flex justify-center p-4 relative">
                <div className="w-full max-w-6xl rounded-lg p-6">
                    <div className="container mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
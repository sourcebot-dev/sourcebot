import { getReposStats } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout(
    props: LayoutProps
) {
    const { children } = props;

    const repoStats = await getReposStats();
    if (isServiceError(repoStats)) {
        throw new ServiceErrorException(repoStats);
    }

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
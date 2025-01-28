import { redirect } from "next/navigation";
import { GitHubCreationForm, GitLabCreationForm } from "./components/connectionCreationForm";

export default async function NewConnectionPage({
    params
}: { params: { type: string } }) {
    const { type } = params;

    if (type === 'github') {
        return <GitHubCreationForm />;
    }

    if (type === 'gitlab') {
        return <GitLabCreationForm />;
    }

    redirect('/connections');
}
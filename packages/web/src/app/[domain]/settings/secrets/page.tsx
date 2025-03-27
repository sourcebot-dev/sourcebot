import { getSecrets } from "@/actions";
import { SecretsList } from "./components/secretsList";
import { isServiceError } from "@/lib/utils";
import { ImportSecretCard } from "./components/importSecretCard";
import { ServiceErrorException } from "@/lib/serviceError";

interface SecretsPageProps {
    params: {
        domain: string;
    }
}

export default async function SecretsPage({ params: { domain } }: SecretsPageProps) {
    const secrets = await getSecrets(domain);
    if (isServiceError(secrets)) {
        throw new ServiceErrorException(secrets);
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Manage Secrets</h3>
                <p className="text-sm text-muted-foreground">These secrets grant Sourcebot access to private code.</p>
            </div>

            <SecretsList secrets={secrets} />
            <ImportSecretCard className="mt-4" />
        </div>
    )
}
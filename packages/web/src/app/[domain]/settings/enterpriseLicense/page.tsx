import { getLicenseKey, getPlan, SOURCEBOT_UNLIMITED_SEATS } from "@/features/entitlements/server";
import { Button } from "@/components/ui/button";
import { Info, Mail } from "lucide-react";
import { getOrgMembers } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";

interface EnterpriseLicensePageProps {
    params: {
        domain: string;
    }
}

export default async function EnterpriseLicensePage({ params: { domain } }: EnterpriseLicensePageProps) {
    const licenseKey = await getLicenseKey();
    const plan = await getPlan();

    if (!licenseKey) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-lg font-medium">Enterprise License</h3>
                    <p className="text-sm text-muted-foreground">View your license details.</p>
                </div>

                <div className="flex flex-col items-center justify-center p-8 border rounded-md bg-card">
                    <Info className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Enterprise License Found</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                        Check out the <a href="https://docs.sourcebot.dev/self-hosting/license-key" className="text-primary">docs</a> for more information.
                    </p>
                    <div className="mb-8 max-w-md rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                        <p className="text-base text-center">
                            Want to try out Sourcebot's enterprise features? Reach out to us and we'll get back to you within
                            a couple hours with a trial license.
                        </p>
                    </div>
                    <Button asChild>
                        <a href={`https://sourcebot.dev/contact`} target="_blank" rel="noopener noreferrer">
                            <Mail className="h-4 w-4 mr-2" />
                            Contact Us
                        </a>
                    </Button>
                </div>
            </div>
        )
    }

    const members = await getOrgMembers(domain);
    if (isServiceError(members)) {
        throw new ServiceErrorException(members);
    }

    const numMembers = members.length;
    const expiryDate = new Date(licenseKey.expiryDate);
    const isExpired = expiryDate < new Date();
    const seats = licenseKey.seats;
    const isUnlimited = seats === SOURCEBOT_UNLIMITED_SEATS;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-medium">Enterprise License</h3>
                    <p className="text-sm text-muted-foreground">View your license details.</p>
                </div>

                <Button asChild>
                    <a href={`mailto:enterprise@sourcebot.dev?subject=Enterprise License Support - ${licenseKey.id}&body=License ID: ${licenseKey.id}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        Contact Support
                    </a>
                </Button>
            </div>

            <div className="grid gap-6">
                <div className="border rounded-md p-6 bg-card">
                    <h4 className="text-base font-medium mb-4">License Details</h4>

                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">License ID</div>
                            <div className="text-sm font-mono">{licenseKey.id}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">Plan</div>
                            <div className="text-sm font-mono">{plan}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">Seats</div>
                            <div className="text-sm font-mono">
                                {isUnlimited ? 'Unlimited' : `${numMembers} / ${seats}`}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-muted-foreground">Expiry Date</div>
                            <div className={`text-sm font-mono ${isExpired ? 'text-destructive' : ''}`}>
                                {expiryDate.toLocaleDateString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric"
                                })} {isExpired && '(Expired)'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
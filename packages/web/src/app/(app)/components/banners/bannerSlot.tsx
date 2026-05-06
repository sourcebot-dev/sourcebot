import { cookies } from "next/headers";
import { resolveActiveBanner, type BannerContext } from "./bannerResolver";
import { DISMISS_COOKIE_PREFIX, type BannerId } from "./types";

type BannerSlotProps = Omit<BannerContext, 'dismissals' | 'today' | 'now'>;

const KNOWN_BANNER_IDS: BannerId[] = [
    'licenseExpired',
    'invoicePastDue',
    'permissionSync',
    'licenseExpiryHeadsUp',
    'trial',
    'servicePingFailed',
];

export async function BannerSlot(props: BannerSlotProps) {
    const cookieStore = await cookies();
    const dismissals: Partial<Record<BannerId, string>> = {};
    for (const id of KNOWN_BANNER_IDS) {
        const value = cookieStore.get(`${DISMISS_COOKIE_PREFIX}${id}`)?.value;
        if (value) {
            dismissals[id] = value;
        }
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const active = resolveActiveBanner({ ...props, dismissals, today, now });

    if (!active) {
        return null;
    }

    return active.render({
        id: active.id,
        dismissible: active.dismissible,
        role: props.role,
        now,
    })
}

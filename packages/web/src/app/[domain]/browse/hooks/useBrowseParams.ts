import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { getBrowseParamsFromPathParam } from "./utils";

export const useBrowseParams = () => {
    const pathname = usePathname();

    return useMemo(() => {
        const startIndex = pathname.indexOf('/browse/');
        if (startIndex === -1) {
            throw new Error(`Invalid browse pathname: "${pathname}" - expected to contain "/browse/"`);
        }

        const rawPath = pathname.substring(startIndex + '/browse/'.length);
        return getBrowseParamsFromPathParam(rawPath);
    }, [pathname]);
}


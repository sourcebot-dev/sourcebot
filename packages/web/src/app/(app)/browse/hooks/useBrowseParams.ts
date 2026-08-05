import { notFound, usePathname } from "next/navigation";
import { useMemo } from "react";
import { getBrowseParamsFromPathParam } from "./utils";

export const useBrowseParams = () => {
    const pathname = usePathname();

    return useMemo(() => {
        const startIndex = pathname.indexOf('/browse/');
        if (startIndex === -1) {
            notFound();
        }

        const rawPath = pathname.substring(startIndex + '/browse/'.length);
        const browseParams = getBrowseParamsFromPathParam(rawPath);
        if (!browseParams) {
            notFound();
        }

        return browseParams;
    }, [pathname]);
}

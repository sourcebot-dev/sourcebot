'use client';

import { useCallback, useState } from "react";
import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import { DEFAULT_HOME_VIEW, HomeView, resolveHomeView } from "@/features/homeView/homeView";

const COOKIE_NAME = HOME_VIEW_COOKIE_NAME;

function getHomeViewFromCookie(orgDefaultHomeView: HomeView): HomeView {
    if (typeof document === "undefined") {
        return orgDefaultHomeView;
    }
    const cookies = document.cookie.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
    const personalPreference = cookie?.substring(`${COOKIE_NAME}=`.length);
    return resolveHomeView({ personalPreference, orgDefault: orgDefaultHomeView });
}

function setHomeViewCookie(value: HomeView) {
    if (typeof document === "undefined") {
        return;
    }
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export const useHomeView = (orgDefaultHomeView: HomeView = DEFAULT_HOME_VIEW): [HomeView, (value: HomeView) => void] => {
    const [homeView, setHomeViewState] = useState<HomeView>(() => getHomeViewFromCookie(orgDefaultHomeView));

    const setHomeView = useCallback((value: HomeView) => {
        setHomeViewState(value);
        setHomeViewCookie(value);
    }, []);

    return [homeView, setHomeView];
};

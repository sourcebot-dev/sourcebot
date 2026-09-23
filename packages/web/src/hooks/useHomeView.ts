'use client';

import { useCallback, useState } from "react";
import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";

export type HomeView = "search" | "ask";

const COOKIE_NAME = HOME_VIEW_COOKIE_NAME;

function getHomeViewFromCookie(defaultHomeView: HomeView): HomeView {
    if (typeof document === "undefined") {
        return defaultHomeView;
    }
    const cookies = document.cookie.split(';').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
    const value = cookie?.substring(`${COOKIE_NAME}=`.length) as HomeView | undefined;
    return value ?? defaultHomeView;
}

function setHomeViewCookie(value: HomeView) {
    if (typeof document === "undefined") {
        return;
    }
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export const useHomeView = (defaultHomeView: HomeView): [HomeView, (value: HomeView) => void] => {
    const [homeView, setHomeViewState] = useState<HomeView>(() => getHomeViewFromCookie(defaultHomeView));

    const setHomeView = useCallback((value: HomeView) => {
        setHomeViewState(value);
        setHomeViewCookie(value);
    }, []);

    return [homeView, setHomeView];
};

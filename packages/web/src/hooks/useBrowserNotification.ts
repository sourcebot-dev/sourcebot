'use client';

import { useCallback, useEffect, useState } from 'react';

type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationOptions {
    title: string;
    body?: string;
    icon?: string;
    onClick?: () => void;
}

interface UseBrowserNotificationReturn {
    permission: NotificationPermission;
    isSupported: boolean;
    requestPermission: () => Promise<NotificationPermission>;
    showNotification: (options: NotificationOptions) => Notification | null;
}

export function useBrowserNotification(): UseBrowserNotificationReturn {
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;

    const [permission, setPermission] = useState<NotificationPermission>(() => {
        if (!isSupported) return 'denied';
        return Notification.permission as NotificationPermission;
    });

    // Sync permission state if it changes externally
    useEffect(() => {
        if (!isSupported) return;
        setPermission(Notification.permission as NotificationPermission);
    }, [isSupported]);

    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isSupported) return 'denied';

        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermission);
        return result as NotificationPermission;
    }, [isSupported]);

    const showNotification = useCallback((options: NotificationOptions): Notification | null => {
        if (!isSupported || permission !== 'granted') {
            return null;
        }

        const notification = new Notification(options.title, {
            body: options.body,
            icon: options.icon,
        });

        if (options.onClick) {
            notification.onclick = () => {
                options.onClick?.();
                notification.close();
            };
        }

        return notification;
    }, [isSupported, permission]);

    return {
        permission,
        isSupported,
        requestPermission,
        showNotification,
    };
}

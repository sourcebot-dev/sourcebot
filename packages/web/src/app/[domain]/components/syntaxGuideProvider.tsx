'use client';

import { createContext, useContext, useCallback, useState } from 'react';

interface SyntaxGuideContextType {
    isOpen: boolean;
    onOpenChanged: (isOpen: boolean) => void;
}

const SyntaxGuideContext = createContext<SyntaxGuideContextType | null>(null);

export const useSyntaxGuide = () => {
    const context = useContext(SyntaxGuideContext);
    if (!context) {
        throw new Error('useSyntaxGuide must be used within a SyntaxGuideProvider');
    }
    return context;
};

export const SyntaxGuideProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    const onOpenChanged = useCallback((isOpen: boolean) => {
        setIsOpen(isOpen);
    }, []);

    return (
        <SyntaxGuideContext.Provider value={{ isOpen, onOpenChanged }}>
            {children}
        </SyntaxGuideContext.Provider>
    );
}; 
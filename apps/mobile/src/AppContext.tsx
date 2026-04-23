import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSettings, getSettings, saveSettings } from './storage';

type AppContextType = {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>({ fontSizeMultiplier: 1 });

    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        const merged = { ...settings, ...newSettings };
        setSettings(merged);
        await saveSettings(merged);
    };

    return (
        <AppContext.Provider value={{ settings, updateSettings }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}

export const tokens = {
    dark: {
        background: '#0A0A0C',
        surface: '#141416',
        surfaceHighlight: '#1E1E22',
        border: 'rgba(255, 255, 255, 0.08)',
        primary: '#7E6CFA',
        primaryHover: '#6859D9',
        text: '#F2F2F7',
        textSecondary: '#8E8E93',
        textMuted: '#6C6C70',
        danger: '#FF453A',
        success: '#30D158',
        groupColors: {
            purple: '#7E6CFA',
            green: '#30D158',
            yellow: '#FFD60A',
            blue: '#0A84FF',
            pink: '#FF375F',
        }
    },
    light: {
        background: '#F2F2F7',
        surface: '#FFFFFF',
        surfaceHighlight: '#E5E5EA',
        border: 'rgba(0, 0, 0, 0.08)',
        primary: '#5E5CE6',
        primaryHover: '#4B49B8',
        text: '#1C1C1E',
        textSecondary: '#6C6C70',
        textMuted: '#8E8E93',
        danger: '#FF3B30',
        success: '#34C759',
        groupColors: {
            purple: '#5E5CE6',
            green: '#34C759',
            yellow: '#FFCC00',
            blue: '#007AFF',
            pink: '#FF2D55',
        }
    }
};

export type ThemeTokens = typeof tokens.dark;

import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface CardProps extends ViewProps {
    variant?: 'default' | 'elevated' | 'glass';
    padding?: number;
}

export function Card({ style, children, variant = 'default', padding = 16, ...props }: CardProps) {
    const theme = useTheme();

    const baseStyle = {
        backgroundColor: variant === 'glass' ? 'rgba(20, 20, 22, 0.7)' : theme.surface,
        borderRadius: 16,
        padding,
        borderWidth: 1,
        borderColor: theme.border,
    };

    return (
        <View style={[baseStyle, style]} {...props}>
            {children}
        </View>
    );
}

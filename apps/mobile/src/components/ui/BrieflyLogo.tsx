import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

interface BrieflyLogoProps {
    width?: number;
    height?: number;
    size?: number;
    style?: ViewStyle;
}

export function BrieflyLogo({ width, height, size, style }: BrieflyLogoProps) {
    const w = width ?? size ?? 120;
    const h = height ?? size ?? 40;

    return (
        <Image
            source={require('../../../assets/briefly-logo.png')}
            style={[styles.logo, { width: w, height: h }, style]}
            resizeMode="contain"
        />
    );
}

const styles = StyleSheet.create({
    logo: {
        alignSelf: 'center',
    },
});
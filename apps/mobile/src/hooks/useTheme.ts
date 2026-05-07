import { useColorScheme } from 'react-native';
import { tokens, ThemeTokens } from '../theme/tokens';

export function useTheme(): ThemeTokens {
    // Force dark mode for visual parity with primary mockups
    return tokens.dark;
}

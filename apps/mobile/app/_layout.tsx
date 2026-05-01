import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/AppContext';
import { AuthProvider } from '../src/services/AuthContext';

export default function Layout() {
    return (
        <AppProvider>
            <AuthProvider>
                <SafeAreaProvider>
                    <SafeAreaView style={{ flex: 1 }}>
                        <StatusBar style="auto" />
                        <Stack screenOptions={{ headerShown: false }} />
                    </SafeAreaView>
                </SafeAreaProvider>
            </AuthProvider>
        </AppProvider>
    );
}

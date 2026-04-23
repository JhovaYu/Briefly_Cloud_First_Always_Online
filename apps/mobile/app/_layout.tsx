import { Stack } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/AppContext';

export default function Layout() {
    return (
        <AppProvider>
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1 }}>
                    <StatusBar style="auto" />
                    <Stack screenOptions={{ headerShown: false }} />
                </SafeAreaView>
            </SafeAreaProvider>
        </AppProvider>
    );
}

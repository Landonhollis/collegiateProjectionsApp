import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AppDataProvider, useOnboarded } from "../context/AppDataContext";

// Outer frame for the whole app: global styles, fonts, theme (light / dark + status bar), who is signed in, their data.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppDataProvider>
            <RootStack />
          </AppDataProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// The Stack lets settings slide in on top of (tabs) and swipe back. Header is off; we draw our own.
// contentStyle paints behind screens so transitions don't flash white in dark mode.
//
// A screen only exists while its guard is true, so nobody can be on (or go back to) a screen that isn't theirs:
// signing out takes the app's screens away, signing in takes the sign-in screen away. Whoever was on a screen
// that went away lands on index, which sends them to the right one (app/index.tsx is where that's decided).
function RootStack() {
  const { colors } = useTheme();
  const signedIn = useAuth().userId !== null;
  const onboarded = useOnboarded();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}

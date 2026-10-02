import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { AppDataProvider } from "../context/AppDataContext";

// Outer frame for the whole app: global styles, fonts, theme (light / dark + status bar), app data.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppDataProvider>
          <RootStack />
        </AppDataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// The Stack lets settings slide in on top of (tabs) and swipe back. Header is off; we draw our own.
// contentStyle paints behind screens so transitions don't flash white in dark mode.
function RootStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />;
}

import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { Segmented } from "../components/formFields";

const APPEARANCE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { mode, setMode, colors, lift } = useTheme();
  const { email, signOut } = useAuth();
  const { syncNow, restartOnboarding } = useAppData();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutProblem, setSignOutProblem] = useState<string | null>(null);

  /** Uploads anything that's waiting first, so the account is up to date for the user's other devices. */
  async function onSignOut() {
    setSigningOut(true);
    setSignOutProblem(null);
    await syncNow();
    const problem = await signOut(); // on success the root layout takes this screen away
    if (problem) {
      setSignOutProblem(problem);
      setSigningOut(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center px-4">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
          style={lift}
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View className="px-4">
        <Text className="mb-6 mt-3 font-inter-bold text-[32px] leading-[40px] tracking-tight text-ink">Settings</Text>

        <View className="rounded-[20px] bg-surface p-4">
          <Text className="font-inter-semibold text-base text-ink">Appearance</Text>
          <Text className="mb-3 mt-0.5 font-inter text-[13px] text-muted">System follows your phone's light / dark setting.</Text>
          <Segmented options={APPEARANCE_OPTIONS} value={mode} onChange={setMode} />
        </View>

        <View className="mt-4 rounded-[20px] bg-surface p-4">
          <Text className="font-inter-semibold text-base text-ink">Walkthrough</Text>
          <Text className="mb-3 mt-0.5 font-inter text-[13px] text-muted">The ten steps you saw when you first signed in.</Text>
          {/* The root layout takes this screen away once the user is no longer onboarded, and index sends them to the walkthrough. */}
          <Pressable
            className="h-12 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
            onPress={restartOnboarding}
            accessibilityRole="button"
          >
            <Text className="font-inter-semibold text-base text-ink">Show it again</Text>
          </Pressable>
        </View>

        <View className="mt-4 rounded-[20px] bg-surface p-4">
          <Text className="font-inter-semibold text-base text-ink">Account</Text>
          <Text className="mb-3 mt-0.5 font-inter text-[13px] text-muted">{email ?? "Signed in"}</Text>
          <Pressable
            className={`h-12 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70 ${signingOut ? "opacity-40" : ""}`}
            onPress={onSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityState={{ disabled: signingOut }}
          >
            <Text className="font-inter-semibold text-base text-ink">Sign out</Text>
          </Pressable>
          {signOutProblem ? <Text className="mt-2 font-inter-medium text-xs text-danger">{signOutProblem}</Text> : null}
        </View>
      </View>
    </View>
  );
}

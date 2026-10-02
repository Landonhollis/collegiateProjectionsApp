import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
      </View>
    </View>
  );
}

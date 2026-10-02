import { Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

const TITLES: Record<string, string> = { "/cases": "Cases", "/entities": "Entities", "/outcomes": "Outcomes" };

// Custom top bar shown above every tab: the current section as a large title, settings on the right.
// Sits on the canvas (no box) so the screen's cards are the first thing you see. Pads below the notch.
export default function TopBar() {
  const insets = useSafeAreaInsets();
  const { colors, lift } = useTheme();
  const pathname = usePathname();

  return (
    <View className="flex-row items-end bg-canvas px-4 pb-1" style={{ paddingTop: insets.top + 8 }}>
      <Text className="flex-1 font-inter-bold text-[32px] leading-[40px] tracking-tight text-ink" numberOfLines={1}>
        {TITLES[pathname] ?? ""}
      </Text>
      <Pressable
        className="mb-1 h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
        style={lift}
        onPress={() => router.push("/settings")}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="settings-outline" size={19} color={colors.ink} />
      </Pressable>
    </View>
  );
}

import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import CollegiateLogo from "./collegiateLogo";

/** Height of the bar below the notch: 4 padding + 44 buttons + 4 padding + 1 hairline. */
export const TOP_BAR_HEIGHT = 53;

const LOGO_HEIGHT = 16;

// Custom top bar: the Collegiate logo on the left, the page title in the middle, settings on the right. The tabs layout renders one.
// A bar (the `bar` color) with a hairline under it, matching the bottom menu, so it reads as separate from the screen. Pads below the notch.
export default function TopBar({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { colors, lift } = useTheme();

  return (
    <View className="flex-row items-center border-b border-hairline bg-bar px-4 pb-1" style={{ paddingTop: insets.top + 4 }}>
      {/* The two sides are equal width, which keeps the title in the true middle. */}
      <View className="flex-1 flex-row items-center">
        <CollegiateLogo height={LOGO_HEIGHT} color={colors.ink} />
      </View>

      <Text className="px-2 font-inter-bold text-[22px] leading-[28px] tracking-tight text-ink" numberOfLines={1}>
        {title}
      </Text>

      <View className="flex-1 flex-row justify-end">
        <Pressable
          className="h-11 w-11 items-center justify-center rounded-2xl bg-canvas active:opacity-70"
          style={lift}
          onPress={() => router.push("/settings")}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

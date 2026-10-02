import type { ComponentProps } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { useTheme } from "../context/ThemeContext";

type IconName = ComponentProps<typeof Ionicons>["name"];
type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; activeIcon: IconName };

// One button in the bottom menu. TabTrigger passes in isFocused and onPress.
// Active: filled icon in the accent + ink label (accent stays small, per the colors guide).
export default function TabButton({ label, icon, activeIcon, isFocused, style: _triggerStyle, ...pressableProps }: TabButtonProps) {
  // TabTrigger also passes a style of { flexDirection: "row", justifyContent: "space-between" }, which would put
  // the icon beside the label and shrink the button to its content. We ignore it and lay the button out here.
  const { colors } = useTheme();
  return (
    <Pressable
      {...pressableProps}
      style={{ flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 10, paddingBottom: 4 }}
      className="active:opacity-60"
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={label}
    >
      <Ionicons name={isFocused ? activeIcon : icon} size={23} color={isFocused ? colors.accent : colors.muted} />
      <Text className={isFocused ? "font-inter-semibold text-[11px] text-ink" : "font-inter-medium text-[11px] text-muted"}>{label}</Text>
    </Pressable>
  );
}

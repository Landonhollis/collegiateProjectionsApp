import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { useTheme } from "../context/ThemeContext";

type IconName = ComponentProps<typeof Ionicons>["name"];
type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; activeIcon: IconName };

// The bottom menu floats over the bottom of the tab screens: a fully rounded bar with a little room on either
// side and under it, so the screen's content shows around it and scrolls behind it.

/** The bottom menu's outline. */
export const BOTTOM_MENU_BORDER = 1.5;
/** Height of the bottom menu: border + 12 padding + 29 icon + 12 padding + border. */
export const BOTTOM_MENU_HEIGHT = 53 + BOTTOM_MENU_BORDER * 2;
/** Room between the bottom menu and each side of the screen. */
export const BOTTOM_MENU_SIDE = 16;

/**
 * Room between the bottom menu and the bottom of the screen: 12, or on a phone with a home indicator
 * (insetBottom ≈ 34) enough to sit just clear of it.
 */
export function bottomMenuGap(insetBottom: number): number {
  return Math.max(insetBottom - 12, 12);
}

/** Bottom padding a tab screen's scrolling content needs, so its last card can be scrolled clear of the bottom menu. */
export function bottomMenuSpace(insetBottom: number): number {
  return bottomMenuGap(insetBottom) + BOTTOM_MENU_HEIGHT + 16;
}

// One button in the bottom menu: just an icon (the label is only read by screen readers).
// TabTrigger passes in isFocused and onPress. Active: filled icon in ink. The blue marker above the
// current tab is drawn by the tabs layout, because it slides between the buttons.
export default function TabButton({ label, icon, activeIcon, isFocused, style: _triggerStyle, ...pressableProps }: TabButtonProps) {
  // TabTrigger also passes a style of { flexDirection: "row", justifyContent: "space-between" }, which would
  // shrink the button to its content. We ignore it and lay the button out here.
  const { colors } = useTheme();
  return (
    <Pressable
      {...pressableProps}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 }}
      className="active:opacity-60"
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={label}
    >
      <Ionicons name={isFocused ? activeIcon : icon} size={29} color={isFocused ? colors.ink : colors.muted} />
    </Pressable>
  );
}

import { useEffect, useRef, type ComponentProps } from "react";
import { PanResponder, Pressable, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";
import { withAlpha } from "./theme";

// Controls shared by EntityCard and CaseCard, so both cards always look and feel the same.

type IconName = ComponentProps<typeof Ionicons>["name"];

type ActionWellProps = {
  icon: IconName;
  label: string; // read by screen readers, e.g. "Delete"
  onPress: () => void;
  iconSize: number;
  /** Box size in px. Leave out to fill the space it's given (square). */
  size?: number;
  /** Adds a trailing chevron: the action opens another card (Edit). Needs a fixed size. */
  opensCard?: boolean;
  /** Hidden state: outline + soft tint in this color. */
  activeColor?: string;
  emphasis?: boolean; // ink icon instead of muted (the main action)
};

/** One filled action button (icon well) with a lift, per the colors guide. */
export function ActionWell({ icon, label, onPress, iconSize, size, opensCard, activeColor, emphasis }: ActionWellProps) {
  const { scheme, colors, lift, caseBorderWidth } = useTheme();
  const box: ViewStyle =
    size === undefined ? { flex: 1, aspectRatio: 1 } : { height: size, minWidth: size, paddingHorizontal: opensCard ? 12 : 0 };
  // Always has its border so the well doesn't change size; it only shows in the active (hidden) state.
  // 1.5px in dark mode, and thicker in light mode like every other case-color outline.
  const borderWidth = 1.5 * caseBorderWidth;
  const state: ViewStyle = activeColor
    ? { borderColor: activeColor, backgroundColor: withAlpha(activeColor, scheme === "dark" ? 0.22 : 0.12) }
    : { borderColor: "transparent" };
  const iconColor = activeColor ?? (emphasis ? colors.ink : colors.muted);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      className="flex-row items-center justify-center gap-1 rounded-[11px] bg-inset active:opacity-60"
      // No lift while active: it reads as pressed in, and the dark-mode lift's top edge would cover the outline.
      style={[box, { borderWidth }, state, activeColor ? null : lift]}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
      {opensCard ? <Ionicons name="chevron-forward" size={iconSize * 0.75} color={colors.muted} /> : null}
    </Pressable>
  );
}

type GripHandleProps = {
  onPickUp: () => void;
  /** While held: how far the finger has moved since the touch began. */
  onMove: (dx: number, dy: number) => void;
  onPutDown: () => void;
  barWidth: number;
  align?: "end" | "center";
};

const HOLD_MS = 120; // a short hold, so a quick scroll over the grip doesn't pick the card up
const SCROLL_SLOP = 8; // moving this far before the hold is up means it's a scroll, not a pick-up

/** The "grab here" spot. Hold to pick the card up, then drag; let go to put it down. */
export function GripHandle({ onPickUp, onMove, onPutDown, barWidth, align = "end" }: GripHandleProps) {
  const { colors } = useTheme();
  const bar: ViewStyle = { height: 2.5, borderRadius: 2, backgroundColor: colors.edge };

  // The responder is made once, so it reads the latest callbacks through a ref.
  const latest = useRef({ onPickUp, onMove, onPutDown });
  latest.current = { onPickUp, onMove, onPutDown };
  const held = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function end() {
    cancelHold();
    if (!held.current) return;
    held.current = false;
    latest.current.onPutDown();
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        holdTimer.current = setTimeout(() => {
          held.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          latest.current.onPickUp();
        }, HOLD_MS);
      },
      onPanResponderMove: (_, g) => {
        if (held.current) latest.current.onMove(g.dx, g.dy);
        else if (Math.abs(g.dx) > SCROLL_SLOP || Math.abs(g.dy) > SCROLL_SLOP) cancelHold();
      },
      // Once the card is picked up, nothing else (like the scroll view) may take the touch.
      onPanResponderTerminationRequest: () => !held.current,
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    }),
  ).current;

  // Don't leave a timer running if the card goes away mid-touch.
  useEffect(() => cancelHold, []);

  return (
    <View
      {...responder.panHandlers}
      hitSlop={10}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Hold and drag to reorder"
      className={`justify-center ${align === "end" ? "items-end" : "items-center"}`}
    >
      <View style={{ gap: 4, alignItems: align === "end" ? "flex-end" : "center" }}>
        <View style={[bar, { width: barWidth }]} />
        <View style={[bar, { width: barWidth }]} />
        <View style={[bar, { width: barWidth * 0.7 }]} />
      </View>
    </View>
  );
}

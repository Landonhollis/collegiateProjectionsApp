import { useRef } from "react";
import { Animated, PanResponder, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../context/ThemeContext";

const EDGE_WIDTH = 14; // invisible strip along the left edge that also catches the swipe
const TAB_WIDTH = 22;
const TAB_HEIGHT = 64;
const OPEN_DISTANCE = 40; // drag this far right to open
const MAX_PULL = 56; // how far the tab follows your finger

// A small tab on the left edge with an arrow pointing in: pull it (or swipe from the edge) to open a
// side menu. The tab follows your finger a little so it feels like you're pulling it out. Tapping it also opens.
export default function EdgePullTab({ onOpen, label }: { onOpen: () => void; label: string }) {
  const { colors, lift } = useTheme();
  const pull = useRef(new Animated.Value(0)).current;
  // The responder is made once, so it reads the latest onOpen through a ref.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dx > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => pull.setValue(Math.max(0, Math.min(MAX_PULL, g.dx))),
      onPanResponderRelease: (_, g) => {
        const tapped = Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5;
        if (tapped || g.dx > OPEN_DISTANCE || g.vx > 0.5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenRef.current();
        }
        Animated.spring(pull, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(pull, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <>
      {/* Swipe strip: the full height of the left edge */}
      <View {...responder.panHandlers} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: EDGE_WIDTH }} />

      {/* The visible tab, a little below the middle */}
      <Animated.View
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          lift,
          {
            position: "absolute",
            left: 0,
            top: "42%",
            width: TAB_WIDTH,
            height: TAB_HEIGHT,
            borderTopRightRadius: 14,
            borderBottomRightRadius: 14,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ translateX: pull }],
          },
        ]}
      >
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Animated.View>
    </>
  );
}

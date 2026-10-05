import { useEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type PanResponderGestureState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { TOP_BAR_HEIGHT } from "./TopBar";
import { BOTTOM_MENU_HEIGHT, bottomMenuGap } from "./TabButton";

/** One row of the menu. `count` (when above 0) shows in a small pill on the right. */
export type SideMenuRow = { key: string; label: string; count?: number };

type SideMenuProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  selected: string; // row key
  onSelect: (key: string) => void;
  /** The rows, in sections. No headings: a line is drawn between sections. */
  sections: SideMenuRow[][];
  /** What the menu lists, for screen readers: "Open entity types" / "Close entity types". */
  name: string;
};

const GAP = 8; // between the open panel and the left edge of the screen
const OVERLAP = 6; // how far the panel pokes over the top bar and the bottom menu
const PEEK = 8; // how much of the closed panel's right edge always shows
const EDGE_WIDTH = 14; // invisible strip along the left edge that also catches the pull
const TAB_WIDTH = 14;
const TAB_HEIGHT = 44;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Side menu of a tab screen: a rounded, outlined panel listing what the screen can show.
// Picking a row switches the screen to it. Used through EntityTypesMenu (entities).
//
// It is always on screen. Closed, it sits off the left edge with a few px of its right side and a small
// tab showing. The tab is part of the panel, so pulling the tab pulls the real menu out under your finger.
//   open:  pull the tab (or swipe in from the left edge), or tap the tab
//   close: swipe the panel left, push the tab back, tap the tab, or tap the dimmed area
// One animated value (x) moves the panel and fades the dimmed area, whether a finger or an animation drives it.
// Drawn by the tabs layout, not the tab screen, so it can float over the top bar and the bottom menu.
export default function SideMenu({ visible, onVisibleChange, selected, onSelect, sections, name }: SideMenuProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(screenWidth * 0.8, 320);
  const closedX = PEEK - GAP - width; // only the last PEEK px of the panel left on screen
  const x = useRef(new Animated.Value(closedX)).current;
  const dragStartX = useRef(closedX);

  // The responders are made once, so they read the latest values through a ref.
  const latest = useRef({ closedX, visible, onVisibleChange });
  latest.current = { closedX, visible, onVisibleChange };

  function slideTo(open: boolean) {
    Animated.timing(x, { toValue: open ? 0 : latest.current.closedX, duration: open ? 220 : 180, useNativeDriver: true }).start();
  }

  // Follow `visible` (the picker bar, a row tap and the dimmed area all just change it).
  useEffect(() => {
    slideTo(visible);
  }, [visible, closedX]);

  // Android back button closes the open menu.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onVisibleChange(false);
      return true;
    });
    return () => sub.remove();
  }, [visible, onVisibleChange]);

  /** Finger down: the panel stops where it is and follows the finger from there. */
  function startDrag() {
    dragStartX.current = latest.current.visible ? 0 : latest.current.closedX;
    x.stopAnimation((value) => {
      dragStartX.current = value;
    });
  }

  function moveDrag(g: PanResponderGestureState) {
    x.setValue(clamp(dragStartX.current + g.dx, latest.current.closedX, 0));
  }

  /** Finger up: finish opening or closing, whichever the drag was heading for. A tap on the tab switches. */
  function endDrag(g: PanResponderGestureState, tapSwitches: boolean) {
    const { closedX: closed, visible: wasOpen } = latest.current;
    const tapped = Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5;
    let open: boolean;
    if (tapped) open = tapSwitches ? !wasOpen : wasOpen;
    else if (g.vx > 0.5) open = true;
    else if (g.vx < -0.5) open = false;
    else open = dragStartX.current + g.dx > closed / 2; // past halfway out
    settle(open);
  }

  function settle(open: boolean) {
    const { visible: wasOpen } = latest.current;
    if (open && !wasOpen) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (open !== wasOpen) latest.current.onVisibleChange(open);
    else slideTo(open); // no change of state, so slide back ourselves
  }

  // The tab and the edge strip: take the touch straight away.
  const handle = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: startDrag,
      onPanResponderMove: (_, g) => moveDrag(g),
      onPanResponderRelease: (_, g) => endDrag(g, true),
      onPanResponderTerminate: () => settle(latest.current.visible),
    }),
  ).current;

  // The panel itself: only claims clearly-horizontal leftward moves, so the list still scrolls and rows still tap.
  const panelSwipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: startDrag,
      onPanResponderMove: (_, g) => moveDrag(g),
      onPanResponderRelease: (_, g) => endDrag(g, false),
      onPanResponderTerminate: () => settle(latest.current.visible),
    }),
  ).current;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {/* Dimmed area: fades in as the panel comes out. Tap it to close. */}
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: "black",
          opacity: x.interpolate({ inputRange: [closedX, 0], outputRange: [0, 0.4] }),
        }}
      >
        <Pressable className="flex-1" onPress={() => onVisibleChange(false)} accessibilityLabel="Close menu" />
      </Animated.View>

      {/* The panel plus its tab. It's wider than the panel so the tab sits inside it and can be touched. */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: GAP,
          top: insets.top + TOP_BAR_HEIGHT - OVERLAP,
          bottom: bottomMenuGap(insets.bottom) + BOTTOM_MENU_HEIGHT - OVERLAP,
          width: width + TAB_WIDTH,
          transform: [{ translateX: x }],
        }}
      >
        <View
          {...panelSwipe.panHandlers}
          // Closed, the rows are off screen, so screen readers skip them.
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
          className="flex-1 overflow-hidden rounded-[24px] border border-edge bg-surface"
          style={{ width }}
        >
          <ScrollView contentContainerClassName="py-3">
            {sections.map((section, sectionIndex) => (
              <View key={sectionIndex}>
                {sectionIndex > 0 ? <View className="mx-5 my-3 h-0.5 rounded-full bg-edge" /> : null}
                {section.map((row) => {
                  const isSelected = row.key === selected;
                  const count = row.count ?? 0;
                  return (
                    <Pressable
                      key={row.key}
                      className={`mx-3 mb-0.5 h-12 flex-row items-center rounded-2xl px-3 active:bg-inset ${isSelected ? "bg-accent-tint" : ""}`}
                      onPress={() => {
                        onSelect(row.key);
                        onVisibleChange(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={count > 0 ? `${row.label}, ${count}` : row.label}
                    >
                      <Text
                        className={`flex-1 text-base ${isSelected ? "font-inter-semibold text-accent-ink" : "font-inter text-ink"}`}
                        numberOfLines={1}
                      >
                        {row.label}
                      </Text>
                      {count > 0 ? (
                        <View className="mr-2 min-w-[24px] items-center rounded-full bg-inset px-2 py-0.5">
                          <Text className="font-inter-semibold text-xs text-muted">{count}</Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={isSelected ? colors.accentInk : colors.edge} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* The tab. It overlaps the panel's right border by 1px and has no left border, so the two read as one shape. */}
        <View
          {...handle.panHandlers}
          hitSlop={{ top: 12, bottom: 12, right: 12 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={visible ? `Close ${name}` : `Open ${name}`}
          style={{
            position: "absolute",
            left: width - 1,
            top: "42%",
            width: TAB_WIDTH,
            height: TAB_HEIGHT,
            borderWidth: 1,
            borderLeftWidth: 0,
            borderColor: colors.edge,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={visible ? "chevron-back" : "chevron-forward"} size={12} color={colors.muted} />
        </View>
      </Animated.View>

      {/* Swipe strip down the left edge, so a pull that starts beside the tab also brings the menu out. */}
      {!visible ? (
        <View
          {...handle.panHandlers}
          style={{
            position: "absolute",
            left: 0,
            width: EDGE_WIDTH,
            top: insets.top + TOP_BAR_HEIGHT,
            bottom: bottomMenuGap(insets.bottom) + BOTTOM_MENU_HEIGHT,
          }}
        />
      ) : null}
    </View>
  );
}

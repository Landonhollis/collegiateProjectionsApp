import { useEffect, useRef, useState } from "react";
import { Animated, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";
import { router, usePathname } from "expo-router";
import { Tabs, TabList, TabTrigger } from "expo-router/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TabButton, { BOTTOM_MENU_BORDER, BOTTOM_MENU_SIDE, bottomMenuGap } from "../../components/TabButton";
import TopBar from "../../components/TopBar";
import EntityTypesMenu from "../../components/entityTypesMenu";
import { EntityMenuProvider, useEntityMenu } from "../../context/EntityMenuContext";
import { useTheme } from "../../context/ThemeContext";
import { TabPagerProvider, useTabPager, type TabName } from "../../context/TabPagerContext";
import CasesScreen from "./cases";
import EntitiesScreen from "./entities";
import OutcomesScreen from "./outcomes";

/** The tabs, left to right. This is the order you swipe through them in. */
const TABS: { name: TabName; href: "/cases" | "/entities" | "/outcomes"; title: string; Screen: () => React.JSX.Element }[] = [
  { name: "cases", href: "/cases", title: "Cases", Screen: CasesScreen },
  { name: "entities", href: "/entities", title: "Entities", Screen: EntitiesScreen },
  { name: "outcomes", href: "/outcomes", title: "Outcomes", Screen: OutcomesScreen },
];

const MENU_PADDING = 12; // left and right of the bottom menu's buttons
const MARKER_WIDTH = 32; // the blue bar above the current tab's icon
const MARKER_HEIGHT = 4;

// Headless tabs: the tab logic comes from expo-router, every visual is ours.
// Top bar, then the tab screens side by side in a pager you can swipe, with the bottom menu floating over their bottom edge.
// The bars stay put while the screens slide; they just switch to the tab that's showing.
// A blue marker in the bottom menu sits above the current tab's icon and slides along with the swipe.
// Swiping past the first or last tab bounces back (iOS) or stretches (Android).
// On the entities tab, its side menu is drawn last so it floats over the top bar and the bottom menu.
export default function TabsLayout() {
  return (
    <EntityMenuProvider>
      <TabPagerProvider>
        <TabsFrame />
      </TabPagerProvider>
    </EntityMenuProvider>
  );
}

function TabsFrame() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { groupKey, setGroupKey, menuOpen, setMenuOpen } = useEntityMenu();
  const { swipeLocked } = useTabPager();
  const { colors, lift, scheme } = useTheme();

  // The route says which tab we're on (-1 while another screen, like settings, is on top).
  const routePage = TABS.findIndex((tab) => tab.href === pathname);

  // `page` = the tab that's showing (during a swipe: the one filling more than half the screen).
  // The ref holds the same number for the scroll handler, which must not wait for a render.
  const [page, setPage] = useState(Math.max(routePage, 0));
  const pageRef = useRef(page);
  const startOffset = useRef({ x: page * width, y: 0 }).current;
  const pager = useRef<ScrollView>(null);
  const fingerSwiping = useRef(false); // false while the pager is sliding by itself after a tab press
  // How far the pager is scrolled, in px. The pager writes it natively on every scroll; the marker reads it.
  const scrollX = useRef(new Animated.Value(page * width)).current;

  function showPage(next: number) {
    pageRef.current = next;
    setPage(next);
  }

  // The route changed without a swipe (a bottom menu press, a "Go to cases" button): slide to that tab.
  useEffect(() => {
    if (routePage === -1 || routePage === pageRef.current) return;
    fingerSwiping.current = false;
    showPage(routePage);
    pager.current?.scrollTo({ x: routePage * width, animated: true });
  }, [routePage]);

  // The screen got wider or narrower (rotation): stay on the same tab.
  useEffect(() => {
    pager.current?.scrollTo({ x: pageRef.current * width, animated: false });
  }, [width]);

  /** While a finger swipes: once the next tab fills more than half the screen, it becomes the current tab. */
  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!fingerSwiping.current) return;
    const next = Math.min(TABS.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (next === pageRef.current) return;
    showPage(next);
    router.navigate(TABS[next].href); // keeps the route and the bottom menu in step
  }

  // The marker is centered over button 0 when the pager is at tab 0, over the last button at the last tab,
  // and in between it moves in step with the pager. It stops at the ends (clamp) while the pager bounces.
  const buttonWidth = (width - BOTTOM_MENU_SIDE * 2 - BOTTOM_MENU_BORDER * 2 - MENU_PADDING * 2) / TABS.length;
  const firstMarkerX = MENU_PADDING + (buttonWidth - MARKER_WIDTH) / 2;
  const markerX = scrollX.interpolate({
    inputRange: [0, (TABS.length - 1) * width],
    outputRange: [firstMarkerX, firstMarkerX + (TABS.length - 1) * buttonWidth],
    extrapolate: "clamp",
  });

  const tab = TABS[page];

  return (
    <Tabs>
      <TopBar title={tab.title} />

      {/* Every tab screen stays mounted, one screen-width each. Paging snaps to one screen at a time. */}
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        style={{ flex: 1 }}
        contentOffset={startOffset}
        scrollEnabled={!swipeLocked}
        // Pulling past the first or last tab bounces back, which shows there's nothing further that way.
        bounces
        alwaysBounceHorizontal
        overScrollMode="always"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true, listener: onPagerScroll })}
        onScrollBeginDrag={() => {
          fingerSwiping.current = true;
        }}
      >
        {TABS.map(({ name, Screen }, index) => (
          <View
            key={name}
            style={{ width }}
            // Screen readers only see the tab that's showing.
            accessibilityElementsHidden={index !== page}
            importantForAccessibility={index === page ? "auto" : "no-hide-descendants"}
          >
            <Screen />
          </View>
        ))}
      </Animated.ScrollView>

      <TabList asChild>
        {/* Explicit row style: TabList's own default is space-between, which pushes the end buttons to the screen edges. */}
        {/* Floats over the bottom of the tab screens (they scroll behind it): fully rounded, with room on either side and under it. */}
        <View
          className="rounded-full bg-bar"
          // One plain style object, not an array: TabList (asChild) throws on an array of styles.
          style={{
            ...(scheme === "light" ? lift : null), // the dark-mode lift is a top edge, which a rounded bar's own border already gives
            // A clear outline, so the bar stands apart from the screen scrolling behind it.
            borderWidth: BOTTOM_MENU_BORDER,
            borderColor: colors.edge,
            position: "absolute",
            left: BOTTOM_MENU_SIDE,
            right: BOTTOM_MENU_SIDE,
            bottom: bottomMenuGap(insets.bottom),
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: MENU_PADDING,
          }}
        >
          <TabTrigger name="cases" href="/cases" asChild>
            <TabButton label="Cases" icon="folder-open-outline" activeIcon="folder-open" />
          </TabTrigger>
          <TabTrigger name="entities" href="/entities" asChild>
            <TabButton label="Entities" icon="grid-outline" activeIcon="grid" />
          </TabTrigger>
          <TabTrigger name="outcomes" href="/outcomes" asChild>
            <TabButton label="Outcomes" icon="trending-up-outline" activeIcon="trending-up" />
          </TabTrigger>
          {/* The marker: floats at the top of the bottom menu, above the icons. Touches pass through it.
                It has to be in here: Tabs only finds the buttons when TabList is its direct child, so TabList can't be wrapped. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 3,
              width: MARKER_WIDTH,
              height: MARKER_HEIGHT,
              borderRadius: MARKER_HEIGHT / 2,
              backgroundColor: colors.accent,
              transform: [{ translateX: markerX }],
            }}
          />
        </View>
      </TabList>
      {tab.name === "entities" ? (
        <EntityTypesMenu visible={menuOpen} onVisibleChange={setMenuOpen} selected={groupKey} onSelect={setGroupKey} />
      ) : null}
    </Tabs>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Pressable,
  ScrollView as RNScrollView,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../context/AppDataContext";
import { TabPagerProvider } from "../context/TabPagerContext";
import { useTheme } from "../context/ThemeContext";
import { monthCount } from "../Engines/coahe";
import { entityTypeOf, makeCaseId, masterEngine } from "../Engines/masterEngine";
import { outcomeSeries } from "../Engines/outcomes";
import { ENTITY_TYPE_LABELS } from "../TypesAndVariables/entityTypeLabels";
import { OUTCOME_LABELS } from "../TypesAndVariables/outcomeLabels";
import { INVESTING } from "../TypesAndVariables/presetVars";
import CaseCard from "../components/caseCard";
import { money } from "../components/chartMaths";
import { incomeForm } from "../components/(editEntityCards)/entityForms";
import { useEntityCard } from "../components/(editEntityCards)/useEntityCard";
import EntityCard from "../components/entityCard";
import { entitySummary } from "../components/entitySummary";
import {
  AgeField,
  CaseDropdown,
  ColorDropdown,
  Field,
  NumberField,
  SectionLabel,
  Segmented,
  TextField,
  ageInMonths,
  ageLabel,
  parseAgeWindow,
  parseDollars,
  parseRequiredAge,
} from "../components/formFields";
import OutcomeChart from "../components/outcomeChart";
import OutcomesDropdown from "../components/outcomesDropdown";
import PopupLayer from "../components/popupLayer";
import { FLOATING_ROW_HEIGHT, FLOATING_ROW_SPACE, FLOATING_ROW_TOP, FloatingRow } from "../components/screenParts";
import TabButton, { BOTTOM_MENU_BORDER, BOTTOM_MENU_SIDE, bottomMenuGap, bottomMenuSpace } from "../components/TabButton";
import { CASE_COLORS } from "../components/theme";
import TopBar from "../components/TopBar";
import type { Age, Case, Entity, FilingStatus, OutcomeKey, OutcomeSeries } from "../TypesAndVariables/types";

// Onboarding: a walkthrough of the app's basic flow, in ten steps.
//
// It is a look-alike of the real app: the same top bar, the three screens side by side, the bottom menu, all drawn
// with the real cards and bars. But it is a picture: nothing in it can be pressed, except the one thing the current
// step asks for.
//
// The guide is drawn so that it can't be mistaken for part of the app (the user's call): a callout, which is a box
// filled in the accent color with one side pushed out into a point, and a thick curved arrow growing out of that
// point to the thing to press. It always floats over the app, popups included, and never takes up room inside one.
//
// What the user makes here is real. The case and the income are saved through the same operations the real app uses
// (saveCase, saveEntity), so they are in the app, beside the example cases, when the walkthrough ends.
//
// Everything is in this one file and the real screens are not touched. To change the walkthrough, start at STEPS.
//
// It doesn't navigate anywhere itself: finishing or skipping marks the user as onboarded, the root layout takes this
// screen away, and app/index.tsx sends them to their cases.

// ── the steps ────────────────────────────────────────────────────────────────
type Step =
  | "addCase" // 1  tap the plus on Cases
  | "saveCase" // 2  the new case popup: tap Save
  | "swipeToEntities" // 3  swipe to Entities
  | "addIncome" // 4  tap the plus on Entities (Income)
  | "fillIncome" // 5 + 6  the new income popup: type a salary and ages, one box at a time, then tap Add
  | "swipeToOutcomes" // 7  swipe to Outcomes
  | "openOutcomes" // 8  tap the outcomes bar
  | "pickOutcome" // 9  pick one from the list
  | "dragChart" // 10  drag the line on the chart
  | "done"; //  finished: one button into the real app

const STEP_COUNT = 10;

/** What the callout says on each step outside the two popups (they carry their own words, beside their own code). */
const STEPS: Record<Exclude<Step, "saveCase" | "fillIncome">, { number: number; title: string; text?: string }> = {
  addCase: {
    number: 1,
    title: "These are your cases",
    text: "A case is one version of your future. We made two examples for you. Tap the green plus to make your own.",
  },
  swipeToEntities: {
    number: 3,
    title: "Your case is in the list",
    text: "It's empty for now. Swipe left to go to Entities and put something in it.",
  },
  addIncome: {
    number: 4,
    title: "Entities fill in a case",
    text: "An entity is one piece of a case: a job, rent, food, a car. This screen is showing Income. Tap the green plus to add one to your case.",
  },
  swipeToOutcomes: {
    number: 7,
    title: "Your case has an income",
    text: "Swipe left again to go to Outcomes and see where it takes you.",
  },
  openOutcomes: {
    number: 8,
    title: "How each case plays out",
    text: "One line per case, in its color. The bar at the top says what you're looking at. Tap it to see what else there is.",
  },
  pickOutcome: { number: 9, title: "Pick one", text: "Each of these shows your cases in a different way. Tap any of them." },
  // The chart steps are one line, at the top, so the numbers under the chart stay in view.
  dragChart: { number: 10, title: "Drag across the chart and watch the numbers under it" },
  done: { number: 10, title: "That's the app: cases, entities, outcomes" },
};

/** The three screens, left to right, like the real tabs. */
const PAGES = [
  { title: "Cases", icon: "folder-open-outline", activeIcon: "folder-open" },
  { title: "Entities", icon: "grid-outline", activeIcon: "grid" },
  { title: "Outcomes", icon: "trending-up-outline", activeIcon: "trending-up" },
] as const;

const noop = () => {};
/** The cards' grips do nothing here. */
const NO_DRAG = { onDragStart: noop, onDragMove: noop, onDragEnd: noop };

type Size = { width: number; height: number };
type Point = { x: number; y: number };
/** A rectangle on a layer, in px from the layer's top left corner. */
type Rect = { left: number; top: number; width: number; height: number };
const NO_SIZE: Size = { width: 0, height: 0 };

export default function OnboardingScreen() {
  return (
    // The chart tells the tab pager when a finger is on it. There are no real tabs here, but it still needs the provider.
    <TabPagerProvider>
      <Walkthrough />
    </TabPagerProvider>
  );
}

function Walkthrough() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, lift } = useTheme();
  const { cases, entities, startingAge, completeOnboarding } = useAppData();

  const [step, setStep] = useState<Step>("addCase");
  const [page, setPage] = useState(0); // the screen that's showing: 0 cases, 1 entities, 2 outcomes
  const [outcomeKey, setOutcomeKey] = useState<OutcomeKey>("netWorth");
  /** The size of the area under the top bar, which is the layer the callouts and targets are placed on. */
  const [area, setArea] = useState<Size>(NO_SIZE);
  const pager = useRef<ScrollView>(null);
  // How far the pager is scrolled, in px. The bottom menu's marker follows it, as in the real app.
  const scrollX = useRef(new Animated.Value(0)).current;

  const swiping = step === "swipeToEntities" || step === "swipeToOutcomes";
  const chartLive = step === "dragChart" || step === "done";

  /** While a finger swipes: the top bar and the bottom menu switch once the next screen fills more than half. */
  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.min(PAGES.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width)));
    if (next !== page) setPage(next);
  }

  /** The swipe has come to rest on a screen. */
  function onPagerRest(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const landed = Math.round(e.nativeEvent.contentOffset.x / width);
    if (step === "swipeToEntities" && landed === 1) setStep("addIncome");
    else if (step === "swipeToOutcomes" && landed === 2) setStep("openOutcomes");
    else if (step === "swipeToOutcomes" && landed !== 1) pager.current?.scrollTo({ x: width, animated: true }); // the wrong way: back to Entities
  }

  /** The plus on the floating row: the same place on Cases and Entities. */
  const plus: Rect = {
    left: area.width - 16 - FLOATING_ROW_HEIGHT,
    top: FLOATING_ROW_TOP,
    width: FLOATING_ROW_HEIGHT,
    height: FLOATING_ROW_HEIGHT,
  };
  /** The outcomes screen's floating bar. */
  const bar: Rect = { left: 16, top: FLOATING_ROW_TOP, width: area.width - 32, height: FLOATING_ROW_HEIGHT };
  /** Where the outcomes list ends: it opens just under the bar, seven rows of 48 (components/outcomesDropdown.tsx). */
  const listBottom = bar.top + bar.height + 6 + 7 * 48 + 2;

  /** The callout for this step: where its box goes, which side its point is on, and where its arrow ends. */
  function callout(): ReactNode {
    if (step === "saveCase" || step === "fillIncome" || area.width === 0) return null; // the popups draw their own
    const words = { ...STEPS[step], area, onSkip: completeOnboarding };
    const W = area.width;
    const H = area.height;
    switch (step) {
      case "addCase":
      case "addIncome":
        // Under the cards, pointing right, with the arrow curving up the right edge into the plus.
        return <Callout {...words} left={16} width={W - 16 - 100} top={H * 0.46} point="right" arrowTo={under(plus)} />;
      case "swipeToEntities":
      case "swipeToOutcomes":
        // Pointing right, at where the user is going (the next screen is to the right), with a short straight arrow.
        // Not the way the finger moves: the user's call.
        return <Callout {...words} left={16} width={W - 16 - 116} top={H * 0.56} point="right" arrowLength={64} />;
      case "openOutcomes":
        return (
          <Callout
            {...words}
            left={16}
            width={W - 16 - 130}
            top={H * 0.5}
            point="right"
            arrowTo={{ x: W - 68, y: bar.top + bar.height + ARROW_GAP }}
          />
        );
      case "pickOutcome":
        // Under the open list, with the arrow going up into it. (The list is a popup over this; it has no dim, so this shows.)
        return (
          <Callout
            {...words}
            left={16}
            width={W - 16 - 130}
            top={Math.min(listBottom + 56, H - 170)}
            point="right"
            arrowTo={{ x: W - 68, y: listBottom + ARROW_GAP }}
          />
        );
      case "dragChart":
        // Over the floating bar, with the arrow curving down into the chart.
        return (
          <Callout {...words} left={16} width={W - 16 - 96} top={4} point="right" arrowTo={{ x: W - 44, y: FLOATING_ROW_SPACE + 96 }} />
        );
      case "done":
        return <Callout {...words} left={16} width={W - 16 - 96} top={4} point="right" />;
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <View pointerEvents="none">
        <TopBar title={PAGES[page].title} />
      </View>

      <View className="flex-1" onLayout={(e) => setArea(sizeOf(e))}>
        {/* The three screens. They can only be swiped on the two swipe steps. */}
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          style={{ flex: 1 }}
          scrollEnabled={swiping}
          bounces
          alwaysBounceHorizontal
          overScrollMode="always"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
            listener: onPagerScroll,
          })}
          onMomentumScrollEnd={onPagerRest}
        >
          <View style={{ width }} pointerEvents="none">
            <CasesPicture cases={cases} entities={entities} startingAge={startingAge} />
          </View>
          <View style={{ width }} pointerEvents="none">
            <EntitiesPicture cases={cases} entities={entities} width={width} />
          </View>
          {/* The chart is the one part of a screen that's really used, on the last step. */}
          <View style={{ width }} pointerEvents={chartLive ? "auto" : "none"}>
            <OutcomesPicture
              ready={page === 2}
              cases={cases}
              entities={entities}
              startingAge={startingAge}
              outcomeKey={outcomeKey}
              listOpen={step === "pickOutcome"}
              onDrag={() => setStep("done")}
            />
          </View>
        </Animated.ScrollView>

        {/* Where to press, and the only thing that can be pressed. */}
        {step === "addCase" ? <Target spot={plus} label="New case" onPress={() => setStep("saveCase")} /> : null}
        {step === "addIncome" ? <Target spot={plus} label="Add income" onPress={() => setStep("fillIncome")} /> : null}
        {step === "openOutcomes" ? <Target spot={bar} label="Choose an outcome" onPress={() => setStep("pickOutcome")} /> : null}
        {swiping ? <SlideHint top="34%" /> : null}
        {step === "dragChart" ? <SlideHint top={FLOATING_ROW_SPACE + 150} bothWays /> : null}

        {callout()}
      </View>

      <BottomMenuPicture page={page} scrollX={scrollX} width={width} bottom={bottomMenuGap(insets.bottom)} />

      {/* The way out, once every step is done. It sits where the bottom menu is, which isn't in use here. */}
      {step === "done" ? (
        <Pressable
          className="h-14 flex-row items-center justify-center gap-1.5 rounded-full bg-accent active:opacity-80"
          style={[lift, { position: "absolute", left: BOTTOM_MENU_SIDE, right: BOTTOM_MENU_SIDE, bottom: bottomMenuGap(insets.bottom) }]}
          onPress={completeOnboarding}
          accessibilityRole="button"
        >
          <Text className="font-inter-bold text-[17px] text-onAccent">Start using the app</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
        </Pressable>
      ) : null}

      {/* Closing a popup without saving goes back a step, so the plus can be tapped again. */}
      {step === "saveCase" ? (
        <NewCasePopup onSaved={() => setStep("swipeToEntities")} onBack={() => setStep("addCase")} onSkip={completeOnboarding} />
      ) : null}
      {step === "fillIncome" ? (
        <NewIncomePopup onSaved={() => setStep("swipeToOutcomes")} onBack={() => setStep("addIncome")} onSkip={completeOnboarding} />
      ) : null}
      {step === "pickOutcome" ? (
        <OutcomesDropdown
          selected={outcomeKey}
          onClose={() => setStep("openOutcomes")}
          onPick={(key) => {
            setOutcomeKey(key);
            setStep("dragChart");
          }}
        />
      ) : null}
    </View>
  );
}

// ── the three screens, as pictures ───────────────────────────────────────────
// Each is laid out like its real screen (app/(tabs)/…) with the real cards and bars. Whoever draws them turns touches off.

function CasesPicture({ cases, entities, startingAge }: { cases: Case[]; entities: Entity[]; startingAge: Age }) {
  const { colors } = useTheme();
  const sorted = [...cases].sort((a, b) => a.caseIndex - b.caseIndex);
  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingTop: FLOATING_ROW_SPACE, paddingHorizontal: 16, gap: 12 }}>
        {sorted.map((c) => (
          <CaseCard
            key={c.caseId}
            caseName={c.caseName}
            caseColor={c.caseColor}
            isHidden={c.isHidden}
            entityCount={entities.filter((e) => e.caseId === c.caseId).length}
            isExpanded={false}
            onToggleExpanded={noop}
            onDelete={noop}
            onToggleHidden={noop}
            onEdit={noop}
            {...NO_DRAG}
          />
        ))}
      </View>
      <FloatingRow onAdd={noop} addLabel="New case" onPressBar={noop} barLabel="Starting age">
        <Ionicons name="person-outline" size={19} color={colors.ink} />
        <Text className="ml-2.5 flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
          Starting age
        </Text>
        <Text className="mr-1.5 font-inter-semibold text-sm text-muted">{ageLabel(startingAge)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </FloatingRow>
    </View>
  );
}

/** The entities screen on its Income group. */
function EntitiesPicture({ cases, entities, width }: { cases: Case[]; entities: Entity[]; width: number }) {
  const { colors } = useTheme();
  const incomes = entities.filter((e) => entityTypeOf(e.entityId) === "income");
  const gap = 12;
  const cardWidth = (width - 16 * 2 - gap) / 2;
  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-row flex-wrap" style={{ paddingTop: FLOATING_ROW_SPACE, paddingHorizontal: 16, gap }}>
        {incomes.map((e) => {
          const c = cases.find((x) => x.caseId === e.caseId);
          if (!c) throw new Error(`Entity "${e.entityId}" has caseId "${e.caseId}", which matches no case`);
          return (
            <View key={e.entityId} style={{ width: cardWidth }}>
              <EntityCard
                entityName={e.name}
                entityType={ENTITY_TYPE_LABELS.income}
                facts={entitySummary("income", e.inputs)}
                caseName={c.caseName}
                caseColor={c.caseColor}
                isHidden={e.isHidden}
                onDelete={noop}
                onToggleHidden={noop}
                onEdit={noop}
                {...NO_DRAG}
              />
            </View>
          );
        })}
      </View>
      <FloatingRow onAdd={noop} addLabel="Add income" onPressBar={noop} barLabel="Showing Income">
        <View className="flex-1 flex-row items-center justify-center gap-1.5">
          <Text className="shrink font-inter-bold text-[22px] leading-7 text-ink" numberOfLines={1}>
            {ENTITY_TYPE_LABELS.income}
          </Text>
          {/* Says the bar opens a list to choose from. */}
          <Ionicons name="chevron-down" size={22} color={colors.ink} />
        </View>
      </FloatingRow>
    </View>
  );
}

/** 543 (months) → "45 years 3 months". */
function longAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years} ${years === 1 ? "year" : "years"} ${months} ${months === 1 ? "month" : "months"}`;
}

type CaseLine = { caseId: string; caseName: string; caseColor: string; series: OutcomeSeries };

type OutcomesPictureProps = {
  /** The engine only runs once this screen has been reached. */
  ready: boolean;
  cases: Case[];
  entities: Entity[];
  startingAge: Age;
  outcomeKey: OutcomeKey;
  listOpen: boolean;
  /** The line on the chart was moved. */
  onDrag: () => void;
};

/** The outcomes screen: the real chart, with each case's number at the chosen age under it. Cases the engine can't run are left out. */
function OutcomesPicture({ ready, cases, entities, startingAge, outcomeKey, listOpen, onDrag }: OutcomesPictureProps) {
  const { colors, caseBorderWidth } = useTheme();
  const insets = useSafeAreaInsets();
  const [pickedMonth, setPickedMonth] = useState<number | null>(null); // null = the oldest age

  const histories = useMemo(() => {
    if (!ready) return [];
    const sorted = [...cases].sort((a, b) => a.caseIndex - b.caseIndex);
    return masterEngine({ startingAge, cases: sorted, entities }).computedCases;
  }, [ready, startingAge, cases, entities]);

  const months = Math.max(0, ...histories.map((c) => (c.chartOfAccountsHistory ? monthCount(c.chartOfAccountsHistory) : 0)));
  const lines = useMemo(() => {
    const out: CaseLine[] = [];
    for (const c of histories) {
      if (!c.chartOfAccountsHistory) continue;
      out.push({
        caseId: c.caseId,
        caseName: c.caseName,
        caseColor: c.caseColor,
        series: outcomeSeries(c.chartOfAccountsHistory, outcomeKey, months),
      });
    }
    return out;
  }, [histories, outcomeKey, months]);

  const selectedMonth = Math.min(pickedMonth ?? months - 1, months - 1);

  return (
    <View className="flex-1 bg-canvas">
      {months > 0 ? (
        // Scrolls like the real screen (once touches are on), so every case's number can be reached.
        <RNScrollView
          contentContainerStyle={{
            paddingTop: FLOATING_ROW_SPACE,
            paddingHorizontal: 16,
            paddingBottom: bottomMenuSpace(insets.bottom),
            gap: 12,
          }}
          alwaysBounceVertical
        >
          <View className="rounded-2xl bg-surface px-2 pb-1 pt-3">
            <OutcomeChart
              lines={lines}
              months={months}
              startingAge={startingAge}
              selectedMonth={selectedMonth}
              onSelectMonth={(month) => {
                setPickedMonth(month);
                onDrag();
              }}
            />
          </View>
          <View className="mt-1 px-1">
            <Text className="font-inter-semibold text-base text-ink">{OUTCOME_LABELS[outcomeKey]} at</Text>
            <Text className="font-inter-bold text-xl text-ink">age {longAge(ageInMonths(startingAge) + selectedMonth)}</Text>
          </View>
          {lines.map((c) => (
            <View
              key={c.caseId}
              className="h-14 flex-row items-center rounded-2xl border bg-surface px-4"
              style={{ borderWidth: caseBorderWidth, borderColor: c.caseColor }}
            >
              <View className="mr-2.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.caseColor }} />
              <Text className="mr-3 flex-1 font-inter-medium text-base text-ink" numberOfLines={1}>
                {c.caseName}
              </Text>
              <Text className="font-inter-semibold text-base text-ink">{money(c.series[selectedMonth])}</Text>
            </View>
          ))}
        </RNScrollView>
      ) : null}
      <FloatingRow onPressBar={noop} barLabel={`Showing ${OUTCOME_LABELS[outcomeKey]}`}>
        <Ionicons name="menu" size={22} color={colors.ink} />
        <Text className="ml-3 flex-1 font-inter-bold text-lg text-ink" numberOfLines={1}>
          {OUTCOME_LABELS[outcomeKey]}
        </Text>
        <Ionicons name={listOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </FloatingRow>
    </View>
  );
}

/** The floating bottom menu, drawn like the real one (app/(tabs)/_layout.tsx). Its marker follows the swipe. */
function BottomMenuPicture({ page, scrollX, width, bottom }: { page: number; scrollX: Animated.Value; width: number; bottom: number }) {
  const { colors, lift, scheme } = useTheme();
  const menuPadding = 12;
  const markerWidth = 32;
  const buttonWidth = (width - BOTTOM_MENU_SIDE * 2 - BOTTOM_MENU_BORDER * 2 - menuPadding * 2) / PAGES.length;
  const firstMarkerX = menuPadding + (buttonWidth - markerWidth) / 2;
  const markerX = scrollX.interpolate({
    inputRange: [0, (PAGES.length - 1) * width],
    outputRange: [firstMarkerX, firstMarkerX + (PAGES.length - 1) * buttonWidth],
    extrapolate: "clamp",
  });
  return (
    <View
      pointerEvents="none"
      className="rounded-full bg-bar"
      style={[
        scheme === "light" ? lift : null,
        {
          borderWidth: BOTTOM_MENU_BORDER,
          borderColor: colors.edge,
          position: "absolute",
          left: BOTTOM_MENU_SIDE,
          right: BOTTOM_MENU_SIDE,
          bottom,
          flexDirection: "row",
          justifyContent: "space-around",
          paddingHorizontal: menuPadding,
        },
      ]}
    >
      {PAGES.map((p, i) => (
        <TabButton key={p.title} label={p.title} icon={p.icon} activeIcon={p.activeIcon} isFocused={i === page} />
      ))}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 3,
          width: markerWidth,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.accent,
          transform: [{ translateX: markerX }],
        }}
      />
    </View>
  );
}

// ── the guide: callout, target, hints ────────────────────────────────────────
// Everything here is placed on a "layer": the area under the top bar, or a popup's own area. Places are in px from
// the layer's top left corner.

const POINT_DEPTH = 22; // how far a callout's pointed side sticks out
const CORNER = 18; // a callout's rounded corners
const ARROW_WIDTH = 9; // the arrow's shaft
const HEAD_LENGTH = 22; // the arrowhead, base to tip
const HEAD_HALF_WIDTH = 14;
const ARROW_GAP = 8; // between the arrowhead's tip and what it points at
const PADDING = 14; // inside a callout

function sizeOf(e: LayoutChangeEvent): Size {
  return { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
}
function rectOf(e: LayoutChangeEvent): Rect {
  const { x, y, width, height } = e.nativeEvent.layout;
  return { left: x, top: y, width, height };
}
/** Where an arrow coming up from below should end to point at this. */
function under(spot: Rect): Point {
  return { x: spot.left + spot.width / 2, y: spot.top + spot.height + ARROW_GAP };
}
/** Where an arrow coming down from above should end to point at this. */
function above(spot: Rect): Point {
  return { x: spot.left + spot.width / 2, y: spot.top - ARROW_GAP };
}

/** A value that runs 0 → 1 over and over, for the hints that keep moving. */
function useLoop(durationMs: number): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: durationMs, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return value;
}

type CalloutProps = {
  /** The layer it floats on. */
  area: Size;
  /** The box, not counting its point. Its height is whatever the words need. */
  left: number;
  width: number;
  /** Give one: where the box's top is, or where its bottom is. */
  top?: number;
  bottom?: number;
  /** The side that's pushed out into a point. The arrow grows out of it. */
  point: "left" | "right";
  /** Where the arrowhead's tip ends. The arrow leaves the point sideways and curves to arrive straight up or straight down. */
  arrowTo?: Point;
  /** Instead of arrowTo: a straight arrow this long, carrying on the way the point points. */
  arrowLength?: number;
  number: number;
  title: string;
  text?: string;
  onSkip: () => void;
  /** A button under the words, for a step that's finished by typing (so there's nothing to tap to move on). */
  next?: { enabled: boolean; onPress: () => void };
};

/**
 * The guide's voice: a box in the accent color with one side pushed out into a point, and a thick arrow growing out
 * of the point. It is drawn with Skia as one filled shape and one arrow, in one color, so the two read as one thing.
 * The words are normal Text laid over the box.
 */
function Callout(props: CalloutProps) {
  const { colors } = useTheme();
  const { area, left, width, point, arrowTo, arrowLength } = props;
  const [height, setHeight] = useState(0); // measured from the words; nothing is drawn until it's known
  const top = props.top ?? (props.bottom ?? 0) - height;

  const shapes = useMemo(() => {
    if (height === 0) return null;
    const right = left + width;
    const bottom = top + height;
    const middle = top + height / 2;
    const dir = point === "right" ? 1 : -1;
    const flat = point === "right" ? left : right; // the side with the rounded corners
    const sharp = point === "right" ? right : left; // the side that's pushed out
    const tip: Point = { x: sharp + dir * POINT_DEPTH, y: middle };

    // The box: along the top to the pointed side, out to the tip and back, then round the two corners of the flat side.
    const box = Skia.Path.Make();
    box.moveTo(flat + dir * CORNER, top);
    box.lineTo(sharp, top);
    box.lineTo(tip.x, tip.y);
    box.lineTo(sharp, bottom);
    box.lineTo(flat + dir * CORNER, bottom);
    box.quadTo(flat, bottom, flat, bottom - CORNER);
    box.lineTo(flat, top + CORNER);
    box.quadTo(flat, top, flat + dir * CORNER, top);
    box.close();

    if (!arrowTo && !arrowLength) return { box, shaft: null, head: null };

    // The arrow starts a little inside the point, so there's no seam between the two.
    const start: Point = { x: tip.x - dir * 10, y: tip.y };
    const shaft = Skia.Path.Make();
    shaft.moveTo(start.x, start.y);
    let end: Point;
    let heading: Point; // the way the arrow is going when it arrives (a unit vector)
    if (arrowTo) {
      end = arrowTo;
      const goingUp = end.y < start.y;
      heading = { x: 0, y: goingUp ? -1 : 1 };
      // How far each end of the curve is "pulled": more for a longer arrow, so the bend stays round.
      const pull = Math.min(120, Math.max(26, Math.hypot(end.x - start.x, end.y - start.y) * 0.45));
      const base: Point = { x: end.x, y: end.y - heading.y * HEAD_LENGTH };
      shaft.cubicTo(start.x + dir * pull, start.y, base.x, base.y - heading.y * pull, base.x, base.y);
    } else {
      end = { x: tip.x + dir * (arrowLength ?? 0), y: tip.y };
      heading = { x: dir, y: 0 };
      shaft.lineTo(end.x - heading.x * HEAD_LENGTH, end.y);
    }

    // The head: a triangle with its tip on `end`, pointing the way the arrow is going.
    const base: Point = { x: end.x - heading.x * HEAD_LENGTH, y: end.y - heading.y * HEAD_LENGTH };
    const across: Point = { x: -heading.y * HEAD_HALF_WIDTH, y: heading.x * HEAD_HALF_WIDTH };
    const head = Skia.Path.Make();
    head.moveTo(end.x, end.y);
    head.lineTo(base.x + across.x, base.y + across.y);
    head.lineTo(base.x - across.x, base.y - across.y);
    head.close();
    return { box, shaft, head };
  }, [left, top, width, height, point, arrowTo?.x, arrowTo?.y, arrowLength]);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {shapes && area.width > 0 ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}>
          <Canvas style={{ width: area.width, height: area.height }}>
            <Path path={shapes.box} color={colors.accent} />
            {/* A stroke in the same color rounds off the box's sharp corners. */}
            <Path path={shapes.box} color={colors.accent} style="stroke" strokeWidth={4} strokeJoin="round" />
            {shapes.shaft ? (
              <Path path={shapes.shaft} color={colors.accent} style="stroke" strokeWidth={ARROW_WIDTH} strokeCap="round" />
            ) : null}
            {shapes.head ? <Path path={shapes.head} color={colors.accent} /> : null}
            {shapes.head ? <Path path={shapes.head} color={colors.accent} style="stroke" strokeWidth={4} strokeJoin="round" /> : null}
          </Canvas>
        </View>
      ) : null}

      {/* The words, over the box. Only Skip and Next take touches; the rest lets them through. */}
      <View
        pointerEvents="box-none"
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={{ position: "absolute", left, top, width, padding: PADDING, opacity: height > 0 ? 1 : 0 }}
      >
        <View className="flex-row items-center">
          <Text className="flex-1 font-inter-bold text-[11px] uppercase tracking-widest text-onAccent">
            Step {props.number} of {STEP_COUNT}
          </Text>
          <Pressable
            onPress={props.onSkip}
            hitSlop={12}
            className="active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel="Skip the walkthrough"
          >
            <Text className="font-inter-semibold text-[13px] text-onAccent underline">Skip</Text>
          </Pressable>
        </View>
        {/* How far along: a dark bar on a faint track. */}
        <View className="mb-2 mt-1.5 h-1 flex-row overflow-hidden rounded-full bg-onAccent/20">
          <View className="rounded-full bg-onAccent" style={{ flex: props.number }} />
          <View style={{ flex: STEP_COUNT - props.number }} />
        </View>
        <Text className="font-inter-bold text-[17px] leading-[22px] text-onAccent">{props.title}</Text>
        {props.text ? <Text className="mt-1 font-inter-medium text-sm leading-5 text-onAccent">{props.text}</Text> : null}
        {props.next ? (
          <Pressable
            className={`mt-2.5 h-10 flex-row items-center justify-center gap-1 self-start rounded-full bg-onAccent px-5 active:opacity-80 ${props.next.enabled ? "" : "opacity-30"}`}
            onPress={props.next.onPress}
            disabled={!props.next.enabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !props.next.enabled }}
          >
            <Text className="font-inter-bold text-sm text-accent">Next</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A ring around the thing to press, with a second ring pulsing out from it. */
function Ring({ spot }: { spot: Rect }) {
  const { colors } = useTheme();
  const beat = useLoop(1300);
  const pulse = {
    opacity: beat.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0, 0] }),
    transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
  };
  const fill: ViewStyle = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, borderColor: colors.accent };
  return (
    <View pointerEvents="none" style={[{ position: "absolute" }, spot]}>
      <View style={[fill, { borderWidth: 2.5 }]} />
      {/* Animated views get plain styles, not classes. */}
      <Animated.View style={[fill, { borderWidth: 3 }, pulse]} />
    </View>
  );
}

/** The one place that can be pressed on this step: an invisible button laid exactly over the real one in the picture, ringed. */
function Target({ spot, label, onPress }: { spot: Rect; label: string; onPress: () => void }) {
  return (
    <>
      <Ring spot={spot} />
      <Pressable style={[{ position: "absolute" }, spot]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} />
    </>
  );
}

/** A hand sliding across the screen: right to left for "swipe", or back and forth for "drag the chart". */
function SlideHint({ top, bothWays }: { top: ViewStyle["top"]; bothWays?: boolean }) {
  const { colors } = useTheme();
  const slide = useLoop(bothWays ? 2400 : 1500);
  const x = bothWays
    ? slide.interpolate({ inputRange: [0, 0.5, 1], outputRange: [70, -70, 70] })
    : slide.interpolate({ inputRange: [0, 0.75, 1], outputRange: [70, -70, -70] });
  const opacity = bothWays ? 1 : slide.interpolate({ inputRange: [0, 0.12, 0.7, 0.9, 1], outputRange: [0, 1, 1, 0, 0] });
  return (
    <View pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}>
      <Animated.View style={{ opacity, transform: [{ translateX: x }] }}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Ionicons name="hand-left-outline" size={30} color={colors.onAccent} />
        </View>
      </Animated.View>
    </View>
  );
}

/** Boxes that are shown filled in but can't be changed on this step. */
function Locked({ children }: { children: ReactNode }) {
  return (
    <View pointerEvents="none" style={{ opacity: 0.55 }}>
      {children}
    </View>
  );
}

// ── the two popups ───────────────────────────────────────────────────────────
// Each is its real popup's layout, drawn again here on the real PopupLayer, so that the guide can float over it:
// a popup is a Modal, and only what is inside the Modal can be drawn on top of it. The popup's own area is the layer.
type PopupProps = { onSaved: () => void; onBack: () => void; onSkip: () => void };

/** The right-hand button of a popup's two-button row (Cancel is 1 wide, this one 1.4, with 12 between), 56 tall. */
function mainButton(card: Rect, sidePadding: number, bottomPadding: number): Rect {
  const width = ((card.width - sidePadding * 2 - 12) * 1.4) / 2.4;
  return { left: card.left + card.width - sidePadding - width, top: card.top + card.height - bottomPadding - 56, width, height: 56 };
}

/** Step 2. The new case popup (laid out like components/editCaseCard.tsx), already filled in: all there is to do is Save. */
function NewCasePopup({ onSaved, onBack, onSkip }: PopupProps) {
  const { cases, saveCase } = useAppData();
  const { colors, lift, caseBorderWidth } = useTheme();
  // Filled in once, when the popup opens. Like a real new case: the first color no other case uses yet.
  const [name] = useState(`Life case ${cases.length + 1}`);
  const [color] = useState(CASE_COLORS.find((c) => !cases.some((x) => x.caseColor === c.hex))?.hex ?? CASE_COLORS[0].hex);
  const [area, setArea] = useState<Size>(NO_SIZE);
  const [card, setCard] = useState<Rect | null>(null);

  function save() {
    const nextIndex = cases.length === 0 ? 0 : Math.max(...cases.map((c) => c.caseIndex)) + 1; // new cases go last
    saveCase({ caseId: makeCaseId(), caseName: name, caseColor: color, caseIndex: nextIndex, isHidden: false });
    onSaved();
  }

  const saveButton = card ? mainButton(card, 20, 20) : null;

  return (
    <PopupLayer onClose={onBack} style={{ paddingHorizontal: 16 }}>
      <View
        className="w-full max-w-[520px] overflow-hidden rounded-[28px] border bg-canvas"
        style={{ borderWidth: caseBorderWidth, borderColor: color }}
        onLayout={(e) => setCard(rectOf(e))}
      >
        <View className="p-5">
          <View className="mb-4 flex-row items-center">
            <Text className="flex-1 font-inter-bold text-[24px] tracking-tight text-ink">New case</Text>
            <Pressable
              onPress={onBack}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <Locked>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Name" value={name} onChange={noop} />
              </View>
              <View className="flex-1">
                <ColorDropdown value={color} onChange={noop} />
              </View>
            </View>
          </Locked>

          <View className="flex-row gap-3">
            <Pressable
              className="h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
              onPress={onBack}
              accessibilityRole="button"
            >
              <Text className="font-inter-semibold text-[17px] text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              className="h-14 flex-[1.4] flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent active:opacity-80"
              style={lift}
              onPress={save}
              accessibilityRole="button"
            >
              <Text className="font-inter-bold text-[17px] text-onAccent">Save</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* The guide, floating over the popup's area: under the card, with the arrow curving up into Save. */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        onLayout={(e) => setArea(sizeOf(e))}
      >
        {card && saveButton && area.width > 0 ? (
          <>
            <Ring spot={saveButton} />
            <Callout
              area={area}
              left={card.left}
              width={under(saveButton).x - 44 - POINT_DEPTH - card.left}
              top={card.top + card.height + 64}
              point="right"
              arrowTo={under(saveButton)}
              number={2}
              title="It's filled in for you. Tap Save."
              text="A case has a name and a color. The color is its line on the chart later."
              onSkip={onSkip}
            />
          </>
        ) : null}
      </View>
    </PopupLayer>
  );
}

const FILING_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
];
const TAX_OPTIONS: { value: "calculated" | "rate"; label: string }[] = [
  { value: "calculated", label: "Work it out" },
  { value: "rate", label: "My own rate" },
];

/** The boxes the user fills in, in order, then the Add button. One at a time. */
type IncomeStop = "salary" | "startAge" | "endAge" | "add";
const INCOME_STOPS: IncomeStop[] = ["salary", "startAge", "endAge", "add"];
const INCOME_WORDS: Record<IncomeStop, string> = {
  salary: "Tap this box and type what you expect to earn in a year",
  startAge: "Now the age you'll start earning it",
  endAge: "And the age you'll stop",
  add: "Everything else is filled in for you. Tap Add.",
};
/** A box's label sits this far above the box itself (the label line and the gap under it). */
const LABEL_HEIGHT = 26;
/** How far under the top of the popup's scrolling part the current box is put. */
const BOX_PEEK = 8;

/**
 * Steps 5 and 6. The new income popup: the real income form, the same boxes as the real income card
 * (components/(editEntityCards)/editIncomeCard.tsx), and the real popup frame's layout (components/editEntityCard.tsx).
 * It saves through the same hook as the real card, into the case just made (the one used last).
 *
 * The user is taken through it one box at a time: salary, start age, end age, then Add. For each one the popup scrolls
 * itself to put that box at the top (the user can't scroll it), the arrow points at it, and "Next" moves on once what's
 * typed is valid. Every other box is shown as it starts out, locked.
 */
function NewIncomePopup({ onSaved, onBack, onSkip }: PopupProps) {
  const card = useEntityCard({ entityEditType: "add", onClose: onSaved }, "income", incomeForm);
  const { text: t, set, frame } = card;
  const { cases } = useAppData();
  const { colors, lift, caseBorderWidth } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const caseColor = cases.find((c) => c.caseId === frame.caseId)?.caseColor;

  const [stop, setStop] = useState<IncomeStop>("salary");
  const [area, setArea] = useState<Size>(NO_SIZE);
  const [popup, setPopup] = useState<Rect | null>(null); // the popup's card on the layer
  const [headerHeight, setHeaderHeight] = useState(0);
  /** How far down the scrolling part each box starts. */
  const [boxTops, setBoxTops] = useState<Partial<Record<IncomeStop, number>>>({});
  const body = useRef<RNScrollView>(null);

  // The real card lets the ages stay blank ("now" and "never ends"). Here both are asked for.
  const filled: Record<IncomeStop, boolean> = {
    salary: parseDollars(t.salary) !== null,
    startAge: parseRequiredAge(t.startAge) !== null,
    endAge: parseRequiredAge(t.endAge) !== null && parseAgeWindow(t.startAge, t.endAge) !== null,
    add: frame.canSubmit,
  };

  // Bring the current box to the top of the scrolling part.
  const boxTop = boxTops[stop];
  useEffect(() => {
    if (boxTop !== undefined) body.current?.scrollTo({ y: Math.max(0, boxTop - BOX_PEEK), animated: true });
  }, [stop, boxTop]);

  /** Wraps one of the boxes to fill in: it can only be typed in on its own stop, and reports where it is. */
  function fillBox(which: IncomeStop, box: ReactNode) {
    return (
      <View
        pointerEvents={stop === which ? "auto" : "none"}
        onLayout={(e) => {
          const y = e.nativeEvent.layout.y;
          setBoxTops((tops) => (tops[which] === y ? tops : { ...tops, [which]: y }));
        }}
      >
        {box}
      </View>
    );
  }

  // Where the guide goes. On a box: over the popup's title, pointing left, the arrow hooking down into the box.
  // On Add: over the bottom of the scrolling part, pointing right, the arrow curving down into the button.
  const addButton = popup ? mainButton(popup, 20, 12) : null;
  const boxSpot: Rect | null =
    popup && headerHeight > 0
      ? { left: popup.left + 20, top: popup.top + headerHeight + BOX_PEEK + LABEL_HEIGHT, width: popup.width - 40, height: 56 }
      : null;

  return (
    <PopupLayer onClose={onBack} style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}>
      <View
        className="w-[80%] max-w-[520px] overflow-hidden rounded-[28px] border bg-canvas"
        style={{ maxHeight: screenHeight * 0.6, flexShrink: 1, borderWidth: caseBorderWidth, borderColor: caseColor ?? "transparent" }}
        onLayout={(e) => setPopup(rectOf(e))}
      >
        <View
          className="flex-row items-start px-5 pb-4 pt-5"
          style={{ borderBottomWidth: caseColor ? caseBorderWidth : 1, borderBottomColor: caseColor ?? colors.hairline }}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View className="flex-1 pr-3">
            <Text className="font-inter-semibold text-[13px] text-muted">{frame.typeLabel}</Text>
            <Text className="mt-1 font-inter-bold text-[26px] leading-[32px] tracking-tight text-ink" numberOfLines={2}>
              New {frame.typeLabel.toLowerCase()}
            </Text>
          </View>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-full bg-inset active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {/* The popup scrolls itself from box to box; a finger can't scroll it. */}
        <RNScrollView
          ref={body}
          style={{ flexShrink: 1 }}
          contentContainerClassName="px-5 pb-4 pt-5"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={false}
        >
          <Locked>
            <TextField label="Name" value={frame.entityName} onChange={noop} />
            <CaseDropdown cases={cases} caseId={frame.caseId} onChange={noop} />
            <View className="mb-5 mt-1 flex-row items-center gap-3">
              <Text className="font-inter-semibold text-xs uppercase tracking-widest text-muted">Details</Text>
              <View className="h-px flex-1 bg-hairline" />
            </View>
          </Locked>

          {fillBox(
            "salary",
            <NumberField label="Salary" hint="per year, before tax" kind="dollars" value={t.salary} onChange={set("salary")} />,
          )}
          <Locked>
            <NumberField label="Yearly raise" hint="after inflation" kind="signedPercent" value={t.raisePct} onChange={noop} />
            <Field label="Filing status">
              <Segmented options={FILING_OPTIONS} value={t.filingStatus} onChange={noop} />
            </Field>
          </Locked>
          {fillBox("startAge", <AgeField label="Start age" value={t.startAge} onChange={set("startAge")} />)}
          {fillBox(
            "endAge",
            <AgeField
              label="End age"
              value={t.endAge}
              onChange={set("endAge")}
              error={parseRequiredAge(t.endAge) !== null && !filled.endAge ? "Must be after the start age" : undefined}
            />,
          )}

          <Locked>
            <SectionLabel>Giving and retirement</SectionLabel>
            <NumberField label="Charity and Tithing" hint="of pay, optional" kind="percent" value={t.charityPct} onChange={noop} />
            <NumberField
              label="Retirement savings"
              hint="of pay, before tax, optional"
              kind="percent"
              value={t.retirementPct}
              onChange={noop}
            />
            <NumberField
              label="Retirement return"
              hint="yearly, blank = average"
              kind="returnPercent"
              placeholder={String(INVESTING.defaultRealReturnPct)}
              value={t.retirementReturnPct}
              onChange={noop}
            />
            <SectionLabel>Income tax</SectionLabel>
            <Field label="Federal + state tax">
              <Segmented options={TAX_OPTIONS} value={t.taxMode} onChange={noop} />
            </Field>
          </Locked>
        </RNScrollView>

        <View className="flex-row gap-3 border-t border-hairline bg-surface px-5 py-3">
          <Pressable
            className="h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
            onPress={onBack}
            accessibilityRole="button"
          >
            <Text className="font-inter-semibold text-[17px] text-ink">Cancel</Text>
          </Pressable>
          {/* Add only works on the last stop. */}
          <Pressable
            className={`h-14 flex-[1.4] flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent active:opacity-80 ${stop === "add" && frame.canSubmit ? "" : "opacity-40"}`}
            style={stop === "add" && frame.canSubmit ? lift : undefined}
            onPress={frame.onSubmit}
            disabled={stop !== "add" || !frame.canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: stop !== "add" || !frame.canSubmit }}
          >
            <Text className="font-inter-bold text-[17px] text-onAccent">Add</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
          </Pressable>
        </View>
      </View>

      {/* The guide, floating over the popup's area. */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        onLayout={(e) => setArea(sizeOf(e))}
      >
        {popup && area.width > 0 && stop !== "add" && boxSpot ? (
          <>
            <Ring spot={boxSpot} />
            <Callout
              area={area}
              left={popup.left + 96}
              width={popup.width - 96 + 8}
              bottom={popup.top + headerHeight - 4}
              point="left"
              arrowTo={{ x: popup.left + 48, y: boxSpot.top - ARROW_GAP }}
              number={5}
              title={INCOME_WORDS[stop]}
              onSkip={onSkip}
              next={{ enabled: filled[stop], onPress: () => setStop(INCOME_STOPS[INCOME_STOPS.indexOf(stop) + 1]) }}
            />
          </>
        ) : null}
        {popup && area.width > 0 && stop === "add" && addButton ? (
          <>
            <Ring spot={addButton} />
            <Callout
              area={area}
              left={popup.left - 8}
              width={above(addButton).x - 44 - POINT_DEPTH - (popup.left - 8)}
              bottom={addButton.top - 46}
              point="right"
              arrowTo={above(addButton)}
              number={6}
              title={INCOME_WORDS.add}
              onSkip={onSkip}
            />
          </>
        ) : null}
      </View>
    </PopupLayer>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../../context/AppDataContext";
import { bottomMenuSpace } from "../../components/TabButton";
import { useTheme } from "../../context/ThemeContext";
import { monthCount } from "../../Engines/coahe";
import { entityTypeOf, masterEngine } from "../../Engines/masterEngine";
import { outcomeSeries } from "../../Engines/outcomes";
import { ENTITY_TYPE_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import { OUTCOME_LABELS } from "../../TypesAndVariables/outcomeLabels";
import { money } from "../../components/chartMaths";
import { ageInMonths } from "../../components/formParsing";
import OutcomeChart from "../../components/outcomeChart";
import OutcomesDropdown from "../../components/outcomesDropdown";
import { EmptyState, FLOATING_ROW_SPACE, FloatingRow } from "../../components/screenParts";
import type { Age, Case, ComputedCase, Entity, OutcomeKey, OutcomeSeries } from "../../TypesAndVariables/types";

/** The engine's results, plus the data they were worked out from (to tell when they're out of date). */
type Projection = { startingAge: Age; cases: Case[]; entities: Entity[]; computedCases: ComputedCase[] };

/** One case's numbers for the outcome that's showing: series[month]. */
type CaseSeries = { caseId: string; caseName: string; caseColor: string; series: OutcomeSeries };

/** Engine messages start with where they came from ("[entityEngines] …"); the user only needs the rest. */
function plainMessage(message: string): string {
  return message.replace(/^\[\w+\]\s*/, "");
}

/** 543 (months) → "45 years 3 months". */
function longAge(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years} ${years === 1 ? "year" : "years"} ${months} ${months === 1 ? "month" : "months"}`;
}

// Outcomes tab: one outcome at a time (net worth, expenses per month, …) for every case that isn't hidden.
// A chart with one line per case, a line you drag to pick an age, and each case's number at that age below it.
// Tapping the floating bar (the chart's title) drops down the list of outcomes to switch to.
//
// The numbers are only worked out while this tab is showing, and only when the data has changed since last time:
// every tab screen stays mounted (so they can be swiped between), and running the engine on every edit made on the
// other tabs slowed the whole app down. Until they're ready, a spinner shows in place of the chart.
export default function OutcomesScreen() {
  const { startingAge, cases, entities } = useAppData();
  const { colors } = useTheme();
  const [outcomeKey, setOutcomeKey] = useState<OutcomeKey>("netWorth");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const label = OUTCOME_LABELS[outcomeKey];
  const isShowing = usePathname() === "/outcomes";

  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Every change makes a new array / object, so "the same ones" means nothing has changed.
  const upToDate =
    projection !== null && projection.startingAge === startingAge && projection.cases === cases && projection.entities === entities;

  useEffect(() => {
    if (!isShowing || upToDate) return;
    // A moment later, not right now, so the spinner is on screen before the engine starts.
    const timer = setTimeout(() => {
      try {
        // Every case that isn't hidden, in the order of the cases screen. Histories are never stored, only held here.
        const sorted = [...cases].sort((a, b) => a.caseIndex - b.caseIndex);
        const { computedCases } = masterEngine({ startingAge, cases: sorted, entities });
        setProjection({ startingAge, cases, entities, computedCases });
      } catch (e: unknown) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isShowing, upToDate, startingAge, cases, entities]);

  // masterEngine only throws on broken linking (a bug). Thrown here so it shows up instead of failing silently.
  if (error) throw new Error(`Outcomes: ${error.message}`);

  return (
    <View className="flex-1 bg-canvas">
      {/* The chart and rows fill this whole area; the outcome picker floats over its top. */}
      <View className="flex-1">
        {projection !== null && upToDate ? (
          <OutcomesView projection={projection} outcomeKey={outcomeKey} />
        ) : (
          <View className="flex-1 items-center justify-center" accessibilityLabel="Working out your outcomes">
            <ActivityIndicator color={colors.muted} />
          </View>
        )}

        {/* Floats so the chart scrolls under it: the outcome that's showing (opens the outcomes dropdown). No plus here. */}
        <FloatingRow onPressBar={() => setDropdownOpen(true)} barLabel={`Showing ${label}. Change`}>
          <Ionicons name="menu" size={22} color={colors.ink} />
          <Text className="ml-3 flex-1 font-inter-bold text-lg text-ink" numberOfLines={1}>
            {label}
          </Text>
          <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        </FloatingRow>
      </View>

      {dropdownOpen ? (
        <OutcomesDropdown
          selected={outcomeKey}
          onClose={() => setDropdownOpen(false)}
          onPick={(key) => {
            setOutcomeKey(key);
            setDropdownOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * One outcome for every case that computed: the chart, then each case's number at the selected age.
 * outcomeSeries turns each case's history into that outcome's numbers, month by month.
 */
function OutcomesView({ projection, outcomeKey }: { projection: Projection; outcomeKey: OutcomeKey }) {
  const { startingAge, cases, entities, computedCases } = projection;
  const { caseBorderWidth } = useTheme();
  const insets = useSafeAreaInsets();

  const failed = computedCases.filter((c) => c.error !== null);

  // Cases can have different lengths, so every series is made as long as the longest one: past a case's last month
  // nothing more happens in it, so its balances stay where they are and its per-month numbers are 0.
  const months = Math.max(0, ...computedCases.map((c) => (c.chartOfAccountsHistory ? monthCount(c.chartOfAccountsHistory) : 0)));
  const shown = useMemo(() => {
    const out: CaseSeries[] = [];
    for (const c of computedCases) {
      if (!c.chartOfAccountsHistory) continue; // failed: it has an error card instead
      out.push({
        caseId: c.caseId,
        caseName: c.caseName,
        caseColor: c.caseColor,
        series: outcomeSeries(c.chartOfAccountsHistory, outcomeKey, months),
      });
    }
    return out;
  }, [computedCases, outcomeKey, months]);

  // The month the chart's line is on. It starts at the oldest age (null = not moved yet).
  const [pickedMonth, setPickedMonth] = useState<number | null>(null);
  const selectedMonth = Math.min(pickedMonth ?? months - 1, months - 1);
  const selectedAge = ageInMonths(startingAge) + selectedMonth;

  function emptyState() {
    if (failed.length > 0) return null; // the error cards say what's wrong
    if (cases.length === 0) {
      return (
        <EmptyState
          icon="folder-open-outline"
          title="Make a case first"
          message="Outcomes show what happens in each of your cases. Make one, then add entities to it."
          action={{ label: "Go to cases", onPress: () => router.navigate("/cases") }}
        />
      );
    }
    if (computedCases.length === 0) {
      return (
        <EmptyState
          icon="eye-off-outline"
          title="Every case is hidden"
          message="Hidden cases are left out of outcomes. Unhide one to see it here."
          action={{ label: "Go to cases", onPress: () => router.navigate("/cases") }}
        />
      );
    }
    return (
      <EmptyState
        icon="trending-up-outline"
        title="Nothing to project yet"
        message="Your cases have no entities showing. Add some to see how each case plays out."
        action={{ label: "Go to entities", onPress: () => router.navigate("/entities") }}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: FLOATING_ROW_SPACE,
        paddingBottom: bottomMenuSpace(insets.bottom),
        paddingHorizontal: 16,
        gap: 12,
      }}
      alwaysBounceVertical
      overScrollMode="always"
    >
      {failed.length > 0 ? <FailedCases failed={failed} entities={entities} /> : null}
      {months === 0 ? (
        emptyState()
      ) : (
        <>
          <View className="rounded-2xl bg-surface px-2 pb-1 pt-3">
            <OutcomeChart
              lines={shown}
              months={months}
              startingAge={startingAge}
              selectedMonth={selectedMonth}
              onSelectMonth={setPickedMonth}
            />
          </View>

          {/* Each case's number where the chart's line is. */}
          <View className="mt-1 flex-row items-baseline px-1">
            <View className="flex-1">
              <Text className="font-inter-semibold text-base text-ink">{OUTCOME_LABELS[outcomeKey]} at</Text>
              <Text className="font-inter-bold text-xl text-ink">age {longAge(selectedAge)}</Text>
            </View>
            <Text className="font-inter text-sm text-muted">Drag the chart to change</Text>
          </View>
          {shown.map((c) => (
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
        </>
      )}
    </ScrollView>
  );
}

/** One card per case the engine couldn't run: which case, which entity, and why. */
function FailedCases({ failed, entities }: { failed: ComputedCase[]; entities: Entity[] }) {
  const { colors, caseBorderWidth } = useTheme();
  return (
    <View className="gap-3">
      {failed.map((c) => {
        const entity = entities.find((e) => e.entityId === c.error?.entityId);
        return (
          <View
            key={c.caseId}
            className="rounded-2xl border bg-surface px-4 py-3"
            style={{ borderWidth: caseBorderWidth, borderColor: c.caseColor }}
          >
            <View className="flex-row items-center">
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text className="ml-2 flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
                {c.caseName} can't be projected
              </Text>
            </View>
            {entity ? (
              <Text className="mt-1.5 font-inter-medium text-[15px] text-ink">
                {entity.name} ({ENTITY_TYPE_LABELS[entityTypeOf(entity.entityId)]})
              </Text>
            ) : null}
            <Text className="mt-1 font-inter text-[15px] leading-[21px] text-muted">{plainMessage(c.error?.message ?? "")}</Text>
          </View>
        );
      })}
    </View>
  );
}

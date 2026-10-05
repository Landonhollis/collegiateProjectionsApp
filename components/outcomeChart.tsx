import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import { Canvas, Circle, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useTheme } from "../context/ThemeContext";
import { useTabPager } from "../context/TabPagerContext";
import { ageInMonths } from "./formParsing";
import { ageTicks, shortDollars, yAxisFor } from "./chartMaths";
import type { Age, OutcomeSeries } from "../TypesAndVariables/types";

/** One line on the chart: a case's color and its number for every month. */
export type ChartLine = { caseId: string; caseColor: string; series: OutcomeSeries };

type OutcomeChartProps = {
  lines: ChartLine[];
  /** How many months every series holds (they are all the same length). At least 1. */
  months: number;
  startingAge: Age; // the age at month 0
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
};

const HEIGHT = 250; // the drawing, without the age labels under it
const Y_LABELS_WIDTH = 50; // room on the left for the dollar labels
const PAD_TOP = 10;
const PAD_RIGHT = 12; // so a dot at the last month isn't cut off
const PAD_BOTTOM = 8;
const X_LABELS_HEIGHT = 22;
const X_LABEL_WIDTH = 36;

// The outcomes chart: one line per case (in its case color), month by month.
//   x: every month in the data, from the starting age to the oldest age. Labelled in years of age.
//   y: from 0 to the largest value (and below 0 when the data goes there). Labelled in short dollars.
// Every line runs the whole width: the screen makes every case's series as long as the longest case.
// A vertical line marks the selected month, with a dot where it crosses each case's line.
// Drag anywhere on the chart to move it (swiping between tabs is off while a finger is on the chart).
//
// Skia draws the lines, the grid and the selector on one canvas. The labels are normal Text around it.
export default function OutcomeChart({ lines, months, startingAge, selectedMonth, onSelectMonth }: OutcomeChartProps) {
  const { colors } = useTheme();
  const { setSwipeLocked } = useTabPager();
  const [width, setWidth] = useState(0); // measured; nothing is drawn until it's known

  const lastMonth = months - 1;
  const plotLeft = Y_LABELS_WIDTH;
  const plotWidth = Math.max(0, width - Y_LABELS_WIDTH - PAD_RIGHT);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const yAxis = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const line of lines) {
      for (const value of line.series) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    return yAxisFor(min, max);
  }, [lines]);

  const xOf = (month: number) => plotLeft + (lastMonth > 0 ? month / lastMonth : 0) * plotWidth;
  const yOf = (value: number) => PAD_TOP + ((yAxis.max - value) / (yAxis.max - yAxis.min)) * plotHeight;

  // The lines only change with the data or the size, not while the selector moves.
  const paths = useMemo(() => {
    if (plotWidth === 0) return [];
    return lines.map((line) => {
      const path = Skia.Path.Make();
      for (let month = 0; month <= lastMonth; month++) {
        if (month === 0) path.moveTo(xOf(0), yOf(line.series[0]));
        else path.lineTo(xOf(month), yOf(line.series[month]));
      }
      return { caseId: line.caseId, caseColor: line.caseColor, path };
    });
  }, [lines, lastMonth, plotWidth, yAxis]);
  const dotted = plotWidth > 0 ? lines : []; // nothing is drawn until the width is known

  // The responder is made once, so it reads the latest values through a ref.
  const latest = useRef({ plotLeft, plotWidth, lastMonth, selectedMonth, onSelectMonth });
  latest.current = { plotLeft, plotWidth, lastMonth, selectedMonth, onSelectMonth };
  const touchStartX = useRef(0);

  /** Move the selector to the month under this x (clamped to the ends). */
  function selectAt(x: number) {
    const now = latest.current;
    if (now.plotWidth === 0) return;
    const along = Math.min(1, Math.max(0, (x - now.plotLeft) / now.plotWidth));
    const month = Math.round(along * now.lastMonth);
    if (month !== now.selectedMonth) now.onSelectMonth(month);
  }

  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        setSwipeLocked(true); // the chart is inside the tab pager, which would swipe to the next tab
        touchStartX.current = e.nativeEvent.locationX;
        selectAt(touchStartX.current);
      },
      onPanResponderMove: (_, g) => selectAt(touchStartX.current + g.dx),
      onPanResponderRelease: () => setSwipeLocked(false),
      onPanResponderTerminate: () => setSwipeLocked(false),
    }),
  ).current;
  useEffect(() => () => setSwipeLocked(false), []);

  const selectedX = xOf(selectedMonth);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: HEIGHT }}>
        <Canvas style={{ width, height: HEIGHT }}>
          {/* Grid: a faint line per dollar label, a stronger one at $0. */}
          {yAxis.ticks.map((tick) => (
            <Line
              key={tick}
              p1={vec(plotLeft, yOf(tick))}
              p2={vec(plotLeft + plotWidth, yOf(tick))}
              color={tick === 0 ? colors.edge : colors.hairline}
              strokeWidth={1}
            />
          ))}
          {paths.map((p) => (
            <Path key={p.caseId} path={p.path} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={p.caseColor} />
          ))}
          {/* The selector, then a dot (ringed in the background color) where it crosses each line. */}
          <Line p1={vec(selectedX, PAD_TOP)} p2={vec(selectedX, PAD_TOP + plotHeight)} color={colors.ink} strokeWidth={1.5} />
          {dotted.map((line) => (
            <Circle key={`ring-${line.caseId}`} cx={selectedX} cy={yOf(line.series[selectedMonth])} r={6} color={colors.surface} />
          ))}
          {dotted.map((line) => (
            <Circle key={`dot-${line.caseId}`} cx={selectedX} cy={yOf(line.series[selectedMonth])} r={4} color={line.caseColor} />
          ))}
        </Canvas>

        {/* Dollar labels, each centered on its grid line. */}
        {yAxis.ticks.map((tick) => (
          <Text
            key={tick}
            className="font-inter text-[11px] text-muted"
            style={{ position: "absolute", left: 0, width: Y_LABELS_WIDTH - 6, top: yOf(tick) - 8, textAlign: "right" }}
            numberOfLines={1}
          >
            {shortDollars(tick)}
          </Text>
        ))}

        {/* Catches the finger anywhere on the chart. It has no children, so the touch's x is measured from its left edge. */}
        <View
          {...drag.panHandlers}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Selected age. Drag left or right to change it."
        />
      </View>

      {/* Age labels, each centered under its birthday. */}
      <View style={{ height: X_LABELS_HEIGHT }}>
        {plotWidth > 0
          ? ageTicks(ageInMonths(startingAge), months).map((tick) => (
              <Text
                key={tick.years}
                className="font-inter text-[11px] text-muted"
                style={{
                  position: "absolute",
                  top: 4,
                  left: xOf(tick.month) - X_LABEL_WIDTH / 2,
                  width: X_LABEL_WIDTH,
                  textAlign: "center",
                }}
              >
                {tick.years}
              </Text>
            ))
          : null}
      </View>
      {/* Names the x-axis, centered under the lines (not under the dollar labels). */}
      <Text
        className="pb-1 font-inter-semibold text-sm text-ink"
        style={{ marginLeft: plotLeft, marginRight: PAD_RIGHT, textAlign: "center" }}
      >
        Age
      </Text>
    </View>
  );
}

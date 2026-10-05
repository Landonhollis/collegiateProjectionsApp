import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, ScrollView, View } from "react-native";
import { useTabPager } from "../context/TabPagerContext";

/** What a card's grip calls while it's being dragged. Pass these to the card. */
export type DragHandlers = {
  onDragStart: () => void;
  /** dx / dy = how far the finger has moved since the touch began. */
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: () => void;
};

type ReorderableGridProps<T> = {
  data: T[];
  keyOf: (item: T) => string;
  columns: number;
  gap: number;
  /** Cells are as tall as they are wide. Otherwise the height is measured from the cards, which must all be the same height. */
  square?: boolean;
  paddingTop: number;
  paddingBottom: number;
  paddingHorizontal: number;
  renderItem: (item: T, drag: DragHandlers) => ReactNode;
  /** Called once when a card is dropped in a new place, with every key in the new order. */
  onReorder: (keys: string[]) => void;
  /** Shown instead of the grid when data is empty. */
  empty: ReactNode;
  /**
   * One card's extra panel (lists only: columns = 1). It is drawn under that card, with its top `overlap` px tucked
   * behind the card, and the cards after it move down to make room. It closes while a card is being dragged.
   */
  expanded?: { key: string; overlap: number; content: ReactNode } | null;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// A scrolling grid (or list, with columns = 1) whose cards can be dragged into a new order, like app icons
// on a phone's home screen. Hold a card's grip, drag it, and the other cards slide out of the way.
//
// How it works:
//   • Every cell is the same size, so a card's place is just maths: slot number → x / y.
//   • Each card is absolutely positioned and moved with an animated x / y (kept per key, so a card keeps
//     its position object when the order changes).
//   • While dragging, `dragOrder` is a working copy of the order. The dragged card follows the finger;
//     whenever it's over a different slot the working order changes and the other cards spring to their new slots.
//   • On drop, onReorder gets the new order. The parent saves it, and data comes back in that order.
// Scrolling is turned off during a drag (otherwise the list would scroll under the finger), and so is swiping between tabs.
//
// The one exception to "every cell is the same size" is the expanded panel: the cards after it are all pushed down
// by the same amount (its measured height, less the part tucked behind its card), so a place is still just maths.
export default function ReorderableGrid<T>(props: ReorderableGridProps<T>) {
  const { data, keyOf, columns, gap } = props;
  const [width, setWidth] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null); // the card being dragged
  const [dragOrder, setDragOrder] = useState<string[] | null>(null); // working order during a drag

  const positions = useRef(new Map<string, Animated.ValueXY>()).current;
  const slotOf = useRef(new Map<string, number>()).current; // the slot each card is at, or heading to
  const drag = useRef<{ key: string; startX: number; startY: number; order: string[] } | null>(null);
  const lastCellSize = useRef("");
  const lastPush = useRef("");
  const [panel, setPanel] = useState<{ key: string; height: number } | null>(null); // the expanded panel, once measured
  const { setSwipeLocked } = useTabPager();

  const dataKeys = data.map(keyOf);
  const order = dragOrder ?? dataKeys;
  const cellWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 0;
  const cellHeight = props.square ? cellWidth : measuredHeight;
  const ready = cellWidth > 0 && cellHeight > 0;
  const rows = Math.ceil(order.length / columns);

  // The expanded panel. Closed while dragging, so the slots are plain rows again and the drag maths stays simple.
  if (props.expanded && columns !== 1) throw new Error("ReorderableGrid: an expanded panel needs columns = 1");
  const expanded = props.expanded && dragOrder === null ? props.expanded : null;
  const expandedIndex = expanded ? order.indexOf(expanded.key) : -1;
  const panelHeight = expanded && panel?.key === expanded.key ? panel.height : 0; // 0 until it's measured
  /** How far the cards after the expanded one are pushed down. */
  const push = expanded && expandedIndex !== -1 ? Math.max(0, panelHeight - expanded.overlap) : 0;
  const gridHeight = rows > 0 ? rows * cellHeight + (rows - 1) * gap + push : 0;

  function slotXY(index: number): { x: number; y: number } {
    const pushed = expandedIndex !== -1 && index > expandedIndex ? push : 0;
    return { x: (index % columns) * (cellWidth + gap), y: Math.floor(index / columns) * (cellHeight + gap) + pushed };
  }

  /** The card's animated position. A card seen for the first time starts in its slot (no slide-in). */
  function positionOf(key: string, index: number): Animated.ValueXY {
    let position = positions.get(key);
    if (!position) {
      position = new Animated.ValueXY(slotXY(index));
      positions.set(key, position);
      slotOf.set(key, index);
    }
    return position;
  }

  // After every render: send each card whose slot changed to its new slot.
  useEffect(() => {
    if (!ready) return;
    const cellSize = `${cellWidth}x${cellHeight}`;
    const resized = lastCellSize.current !== cellSize;
    lastCellSize.current = cellSize;
    // A panel opened, closed or changed height: the cards after it slide to make or take back the room.
    const pushNow = `${expandedIndex}:${push}`;
    const pushChanged = lastPush.current !== pushNow;
    lastPush.current = pushNow;

    order.forEach((key, index) => {
      if (key === activeKey) return; // follows the finger instead
      if (slotOf.get(key) === index && !resized && !pushChanged) return;
      slotOf.set(key, index);
      const position = positionOf(key, index);
      if (resized)
        position.setValue(slotXY(index)); // new cell size: jump, don't slide
      else Animated.spring(position, { toValue: slotXY(index), useNativeDriver: true, friction: 9, tension: 80 }).start();
    });

    // Forget cards that were deleted.
    for (const key of [...positions.keys()]) {
      if (!order.includes(key)) {
        positions.delete(key);
        slotOf.delete(key);
      }
    }
  });

  // Don't leave tab swiping locked if the grid goes away mid-drag.
  useEffect(() => () => setSwipeLocked(false), []);

  function startDrag(key: string) {
    if (!ready || drag.current) return;
    const index = order.indexOf(key);
    if (index === -1) throw new Error(`ReorderableGrid: no card with key "${key}"`);
    const start = slotXY(index);
    drag.current = { key, startX: start.x, startY: start.y, order: [...order] };
    slotOf.set(key, -1); // so it springs into its slot when dropped
    setActiveKey(key);
    setSwipeLocked(true);
    setDragOrder([...order]);
  }

  function moveDrag(dx: number, dy: number) {
    const d = drag.current;
    if (!d) return;
    const x = d.startX + dx;
    const y = d.startY + dy;
    positionOf(d.key, 0).setValue({ x, y });

    // Which slot is the card over now?
    const lastRow = Math.ceil(d.order.length / columns) - 1;
    const column = clamp(Math.round(x / (cellWidth + gap)), 0, columns - 1);
    const row = clamp(Math.round(y / (cellHeight + gap)), 0, lastRow);
    const target = Math.min(row * columns + column, d.order.length - 1);
    if (target === d.order.indexOf(d.key)) return;

    const next = d.order.filter((k) => k !== d.key);
    next.splice(target, 0, d.key);
    d.order = next;
    setDragOrder(next);
  }

  function endDrag() {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setActiveKey(null);
    setSwipeLocked(false);
    setDragOrder(null);
    const moved = d.order.some((key, i) => key !== dataKeys[i]);
    if (moved) props.onReorder(d.order);
  }

  return (
    <ScrollView
      // Bounce even when the cards don't fill the screen, so the empty part still feels scrollable.
      style={{ flex: 1 }}
      alwaysBounceVertical
      overScrollMode="always"
      scrollEnabled={activeKey === null}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: props.paddingTop,
        paddingBottom: props.paddingBottom,
        paddingHorizontal: props.paddingHorizontal,
      }}
    >
      {data.length === 0 ? (
        props.empty
      ) : (
        // Hidden until the cell size is known, so cards never flash in the wrong place.
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: gridHeight, opacity: ready ? 1 : 0 }}>
          {/* The expanded panel. Drawn first so the cards sit on top of it: its top is tucked behind its own card,
              and the cards below cover it until they have slid out of the way. */}
          {expanded && expandedIndex !== -1 && ready ? (
            <View
              key={expanded.key}
              onLayout={(e) => {
                const height = e.nativeEvent.layout.height;
                if (panel?.key !== expanded.key || Math.abs(height - panel.height) > 0.5) setPanel({ key: expanded.key, height });
              }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: slotXY(expandedIndex).y + cellHeight - expanded.overlap,
                opacity: panelHeight > 0 ? 1 : 0, // hidden until measured, when the cards below start to move
              }}
            >
              <SlideOut>{expanded.content}</SlideOut>
            </View>
          ) : null}
          {cellWidth > 0
            ? data.map((item) => {
                const key = keyOf(item);
                return (
                  <Animated.View
                    key={key}
                    onLayout={
                      props.square
                        ? undefined
                        : (e) => {
                            const height = e.nativeEvent.layout.height;
                            if (height > 0 && Math.abs(height - measuredHeight) > 0.5) setMeasuredHeight(height);
                          }
                    }
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: cellWidth,
                      zIndex: key === activeKey ? 1 : 0, // the dragged card rides above the others
                      transform: positionOf(key, order.indexOf(key)).getTranslateTransform(),
                    }}
                  >
                    {props.renderItem(item, { onDragStart: () => startDrag(key), onDragMove: moveDrag, onDragEnd: endDrag })}
                  </Animated.View>
                );
              })
            : null}
        </View>
      )}
    </ScrollView>
  );
}

/** Slides its children down into place as they appear, so the panel looks like it comes out from under its card. */
function SlideOut({ children }: { children: ReactNode }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={{ opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

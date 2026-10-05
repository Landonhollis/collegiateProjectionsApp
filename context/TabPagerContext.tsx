import { createContext, useContext, useState, type ReactNode } from "react";

// What the tab screens tell the tabs layout.
// The layout draws the pager you swipe between tabs with; the tab screens sit inside it.
// A screen says when swiping between tabs must stop (while a card is being dragged).

export type TabName = "cases" | "entities" | "outcomes";

type TabPager = {
  swipeLocked: boolean;
  setSwipeLocked: (locked: boolean) => void;
};

const TabPagerContext = createContext<TabPager | null>(null);

export function TabPagerProvider({ children }: { children: ReactNode }) {
  const [swipeLocked, setSwipeLocked] = useState(false);
  return <TabPagerContext.Provider value={{ swipeLocked, setSwipeLocked }}>{children}</TabPagerContext.Provider>;
}

export function useTabPager(): TabPager {
  const pager = useContext(TabPagerContext);
  if (!pager) throw new Error("useTabPager must be used inside TabPagerProvider");
  return pager;
}

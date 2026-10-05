import { createContext, useContext, useState, type ReactNode } from "react";

// Which entity group the entities screen is showing, and whether the entity types menu is open.
// It lives above the tab screens because the menu is drawn by the tabs layout (so it can lay over the
// top bar and the bottom menu) while the entities screen is what reads and opens it.

type EntityMenu = {
  /** Key of the entity group that's showing (see ENTITY_GROUPS). */
  groupKey: string;
  setGroupKey: (groupKey: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
};

const EntityMenuContext = createContext<EntityMenu | null>(null);

export function EntityMenuProvider({ children }: { children: ReactNode }) {
  const [groupKey, setGroupKey] = useState("existingHome");
  const [menuOpen, setMenuOpen] = useState(false);
  return <EntityMenuContext.Provider value={{ groupKey, setGroupKey, menuOpen, setMenuOpen }}>{children}</EntityMenuContext.Provider>;
}

export function useEntityMenu(): EntityMenu {
  const menu = useContext(EntityMenuContext);
  if (!menu) throw new Error("useEntityMenu must be used inside EntityMenuProvider");
  return menu;
}

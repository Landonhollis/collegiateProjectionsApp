import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Case, Entity } from "../TypesAndVariables/types";

// Loads the cases and entities arrays from phone storage on app start and holds them for the whole app.
// Every change goes through the functions below, which update the app and save to the phone.

const CASES_KEY = "cases";
const ENTITIES_KEY = "entities";

type AppData = {
  cases: Case[];
  entities: Entity[];
  setCases: (cases: Case[]) => void;
  setEntities: (entities: Entity[]) => void;
  /** Adds the entity, or replaces the one with the same entityId (keeps its place in the order). */
  saveEntity: (entity: Entity) => void;
  deleteEntity: (entityId: string) => void;
  toggleEntityHidden: (entityId: string) => void;
  /** Adds the case, or replaces the one with the same caseId. */
  saveCase: (c: Case) => void;
  /** Removes the case AND its entities (an entity can't exist without its case). */
  deleteCase: (caseId: string) => void;
  toggleCaseHidden: (caseId: string) => void;
};

const AppDataContext = createContext<AppData | null>(null);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCases(json: string | null): Case[] {
  if (json === null) return []; // nothing saved yet
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Saved cases is not an array");
  return data.map((item, i) => {
    if (
      !isObject(item) ||
      typeof item.caseId !== "string" ||
      typeof item.caseName !== "string" ||
      typeof item.caseColor !== "string" ||
      typeof item.caseIndex !== "number" ||
      typeof item.isHidden !== "boolean"
    ) {
      throw new Error(`Saved case ${i} must have caseId, caseName, caseColor, caseIndex and isHidden`);
    }
    return {
      ...item,
      caseId: item.caseId,
      caseName: item.caseName,
      caseColor: item.caseColor,
      caseIndex: item.caseIndex,
      isHidden: item.isHidden,
    };
  });
}

function parseEntities(json: string | null): Entity[] {
  if (json === null) return []; // nothing saved yet
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Saved entities is not an array");
  return data.map((item, i) => {
    if (
      !isObject(item) ||
      typeof item.entityId !== "string" ||
      typeof item.caseId !== "string" ||
      typeof item.name !== "string" ||
      typeof item.isHidden !== "boolean" ||
      !isObject(item.inputs)
    ) {
      throw new Error(`Saved entity ${i} must have entityId, caseId, name, isHidden and inputs`);
    }
    return { entityId: item.entityId, caseId: item.caseId, name: item.name, isHidden: item.isHidden, inputs: item.inputs };
  });
}

function findEntityIndex(entities: Entity[], entityId: string): number {
  const index = entities.findIndex((e) => e.entityId === entityId);
  if (index === -1) throw new Error(`No entity with entityId "${entityId}"`);
  return index;
}

function findCaseIndex(cases: Case[], caseId: string): number {
  const index = cases.findIndex((c) => c.caseId === caseId);
  if (index === -1) throw new Error(`No case with caseId "${caseId}"`);
  return index;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [cases, setCasesState] = useState<Case[]>([]);
  const [entities, setEntitiesState] = useState<Entity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CASES_KEY), AsyncStorage.getItem(ENTITIES_KEY)])
      .then(([casesJson, entitiesJson]) => {
        setCasesState(parseCases(casesJson));
        setEntitiesState(parseEntities(entitiesJson));
        setIsLoaded(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  // Errors from async loading/saving are thrown here so they show up instead of failing silently.
  if (error) throw new Error(`App data: ${error.message}`);
  if (!isLoaded) return null; // screens only render once the data is in

  function setCases(next: Case[]) {
    setCasesState(next);
    AsyncStorage.setItem(CASES_KEY, JSON.stringify(next)).catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }

  function setEntities(next: Entity[]) {
    setEntitiesState(next);
    AsyncStorage.setItem(ENTITIES_KEY, JSON.stringify(next)).catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }

  function saveEntity(entity: Entity) {
    const index = entities.findIndex((e) => e.entityId === entity.entityId);
    if (index === -1) setEntities([...entities, entity]);
    else setEntities(entities.map((e, i) => (i === index ? entity : e)));
  }

  function deleteEntity(entityId: string) {
    const index = findEntityIndex(entities, entityId);
    setEntities(entities.filter((_, i) => i !== index));
  }

  function toggleEntityHidden(entityId: string) {
    const index = findEntityIndex(entities, entityId);
    setEntities(entities.map((e, i) => (i === index ? { ...e, isHidden: !e.isHidden } : e)));
  }

  function saveCase(c: Case) {
    const index = cases.findIndex((x) => x.caseId === c.caseId);
    if (index === -1) setCases([...cases, c]);
    else setCases(cases.map((x, i) => (i === index ? c : x)));
  }

  function deleteCase(caseId: string) {
    const index = findCaseIndex(cases, caseId);
    setCases(cases.filter((_, i) => i !== index));
    setEntities(entities.filter((e) => e.caseId !== caseId));
  }

  function toggleCaseHidden(caseId: string) {
    const index = findCaseIndex(cases, caseId);
    setCases(cases.map((x, i) => (i === index ? { ...x, isHidden: !x.isHidden } : x)));
  }

  return (
    <AppDataContext.Provider
      value={{
        cases,
        entities,
        setCases,
        setEntities,
        saveEntity,
        deleteEntity,
        toggleEntityHidden,
        saveCase,
        deleteCase,
        toggleCaseHidden,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error("useAppData must be used inside AppDataProvider");
  return data;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Age, Case, Entity } from "../TypesAndVariables/types";

// Loads the starting age and the cases and entities arrays from phone storage on app start and holds them for the whole app.
// Every change goes through the functions below, which update the app and save to the phone.

const CASES_KEY = "cases";
const ENTITIES_KEY = "entities";
const STARTING_AGE_KEY = "startingAge";
/** Used until the user sets their own, so the starting age is never empty. */
const DEFAULT_STARTING_AGE: Age = { years: 20, months: 0 };

type AppData = {
  /** The user's age today: where every case's projection starts. 20 years 0 months until the user sets it. */
  startingAge: Age;
  setStartingAge: (age: Age) => void;
  cases: Case[];
  entities: Entity[];
  setCases: (cases: Case[]) => void;
  setEntities: (entities: Entity[]) => void;
  /** Adds the entity, or replaces the one with the same entityId (keeps its place in the order). */
  saveEntity: (entity: Entity) => void;
  deleteEntity: (entityId: string) => void;
  toggleEntityHidden: (entityId: string) => void;
  /**
   * Puts these entities in this order. They may be only some of the entities (e.g. one type):
   * they swap among the places they already hold in the list, and every other entity stays where it is.
   */
  reorderEntities: (entityIds: string[]) => void;
  /** Adds the case, or replaces the one with the same caseId. */
  saveCase: (c: Case) => void;
  /** Removes the case AND its entities (an entity can't exist without its case). */
  deleteCase: (caseId: string) => void;
  toggleCaseHidden: (caseId: string) => void;
  /** Sets the display order: caseIndex becomes each case's place in this list. Must name every case once. */
  reorderCases: (caseIds: string[]) => void;
};

const AppDataContext = createContext<AppData | null>(null);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Throws unless it's whole years ≥ 0 and months 0–11 (the same rule the engines use). */
function checkStartingAge(value: unknown): Age {
  if (
    !isObject(value) ||
    typeof value.years !== "number" ||
    typeof value.months !== "number" ||
    !Number.isInteger(value.years) ||
    !Number.isInteger(value.months) ||
    value.years < 0 ||
    value.months < 0 ||
    value.months > 11
  ) {
    throw new Error("Starting age must be whole years (0 or more) and months 0–11");
  }
  return { years: value.years, months: value.months };
}

function parseStartingAge(json: string | null): Age {
  if (json === null) return DEFAULT_STARTING_AGE; // not set yet
  return checkStartingAge(JSON.parse(json));
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
  const [startingAge, setStartingAgeState] = useState<Age>(DEFAULT_STARTING_AGE);
  const [cases, setCasesState] = useState<Case[]>([]);
  const [entities, setEntitiesState] = useState<Entity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CASES_KEY), AsyncStorage.getItem(ENTITIES_KEY), AsyncStorage.getItem(STARTING_AGE_KEY)])
      .then(([casesJson, entitiesJson, startingAgeJson]) => {
        setStartingAgeState(parseStartingAge(startingAgeJson));
        setCasesState(parseCases(casesJson));
        setEntitiesState(parseEntities(entitiesJson));
        setIsLoaded(true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  // Errors from async loading/saving are thrown here so they show up instead of failing silently.
  if (error) throw new Error(`App data: ${error.message}`);
  if (!isLoaded) return null; // screens only render once the data is in

  function setStartingAge(next: Age) {
    const age = checkStartingAge(next);
    setStartingAgeState(age);
    AsyncStorage.setItem(STARTING_AGE_KEY, JSON.stringify(age)).catch((e: unknown) =>
      setError(e instanceof Error ? e : new Error(String(e))),
    );
  }

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

  function reorderEntities(entityIds: string[]) {
    if (new Set(entityIds).size !== entityIds.length) throw new Error("reorderEntities: an entityId is listed twice");
    const moving = entityIds.map((id) => entities[findEntityIndex(entities, id)]);
    // Walk the list; each time we reach one of the moving entities' places, drop in the next one in the new order.
    let next = 0;
    setEntities(entities.map((e) => (entityIds.includes(e.entityId) ? moving[next++] : e)));
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

  function reorderCases(caseIds: string[]) {
    if (caseIds.length !== cases.length || new Set(caseIds).size !== caseIds.length) {
      throw new Error("reorderCases: must list every case exactly once");
    }
    const placeOf = new Map(caseIds.map((id, i) => [id, i]));
    setCases(
      cases.map((c) => {
        const place = placeOf.get(c.caseId);
        if (place === undefined) throw new Error(`reorderCases: case "${c.caseId}" is missing from the new order`);
        return { ...c, caseIndex: place };
      }),
    );
  }

  return (
    <AppDataContext.Provider
      value={{
        startingAge,
        setStartingAge,
        cases,
        entities,
        setCases,
        setEntities,
        saveEntity,
        deleteEntity,
        toggleEntityHidden,
        reorderEntities,
        saveCase,
        deleteCase,
        toggleCaseHidden,
        reorderCases,
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

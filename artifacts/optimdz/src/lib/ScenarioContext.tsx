import React, { createContext, useContext, useState, useCallback } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";

export interface Scenario {
  id: string;
  name: string;
  savedAt: string; // ISO string
  input: ProblemInput;
  result: SolveResult;
}

interface ScenarioContextValue {
  scenarios: Scenario[];
  saveScenario: (name: string, input: ProblemInput, result: SolveResult) => void;
  deleteScenario: (id: string) => void;
  clearAll: () => void;
}

const LS_KEY = "optimdz_scenarios";

function load(): Scenario[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Scenario[];
  } catch {
    return [];
  }
}

function persist(scenarios: Scenario[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(scenarios));
  } catch {
    // quota exceeded — silently ignore
  }
}

const ScenarioContext = createContext<ScenarioContextValue | undefined>(undefined);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(load);

  const saveScenario = useCallback((name: string, input: ProblemInput, result: SolveResult) => {
    const next: Scenario = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || "Scénario sans nom",
      savedAt: new Date().toISOString(),
      input,
      result,
    };
    setScenarios((prev) => {
      const updated = [next, ...prev];
      persist(updated);
      return updated;
    });
  }, []);

  const deleteScenario = useCallback((id: string) => {
    setScenarios((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setScenarios([]);
    persist([]);
  }, []);

  return (
    <ScenarioContext.Provider value={{ scenarios, saveScenario, deleteScenario, clearAll }}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenarios() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenarios must be used inside ScenarioProvider");
  return ctx;
}

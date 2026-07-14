// ── Assignment Problem History — localStorage persistence ────────────────────
// Mirrors TransportHistoryContext.tsx exactly (separate from Simplex's
// PostgreSQL-backed history). Storage key: "optimdz_assignment_problems"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { AssignmentProblem } from "./AssignmentContext";
import type { HungarianResult } from "./hungarianAlgorithm";

export type AssignmentSectorKey = "industry" | "trade" | "services" | "agriculture" | "custom";

export interface SavedAssignmentProblem {
  id:       string;
  name:     string;
  sector:   AssignmentSectorKey;
  savedAt:  string;
  problem:  AssignmentProblem;
  result:   HungarianResult;
}

const STORAGE_KEY  = "optimdz_assignment_problems";
const MAX_PROBLEMS = 50;

function genId(): string {
  return `ap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const SECTOR_NAME_FR: Record<AssignmentSectorKey, string> = {
  industry:    "Industrie",
  trade:       "Commerce",
  services:    "Services",
  agriculture: "Agriculture",
  custom:      "Personnalisé",
};
const SECTOR_NAME_AR: Record<AssignmentSectorKey, string> = {
  industry:    "صناعة",
  trade:       "تجارة",
  services:    "خدمات",
  agriculture: "فلاحة",
  custom:      "مخصص",
};

export function generateAssignmentProjectName(sector: AssignmentSectorKey, lang: string): string {
  const now = new Date();
  if (lang === "ar") {
    const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                       "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    return `توزيع ${SECTOR_NAME_AR[sector]} — ${now.getDate()} ${monthsAr[now.getMonth()]} ${now.getFullYear()}`;
  }
  return `Affectation ${SECTOR_NAME_FR[sector]} — ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function load(): SavedAssignmentProblem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAssignmentProblem[]) : [];
  } catch {
    return [];
  }
}

function persist(problems: SavedAssignmentProblem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(problems)); } catch { /* quota */ }
}

interface AssignmentHistoryState {
  problems:       SavedAssignmentProblem[];
  addProblem:     (problem: AssignmentProblem, result: HungarianResult, sector: AssignmentSectorKey, lang: string) => string;
  deleteProblem:  (id: string) => void;
  renameProblem:  (id: string, name: string) => void;
  clearAll:       () => void;
}

const Ctx = createContext<AssignmentHistoryState | undefined>(undefined);

export function AssignmentHistoryProvider({ children }: { children: React.ReactNode }) {
  const [problems, setProblems] = useState<SavedAssignmentProblem[]>(() => load());

  useEffect(() => { persist(problems); }, [problems]);

  const addProblem = useCallback(
    (problem: AssignmentProblem, result: HungarianResult, sector: AssignmentSectorKey, lang: string): string => {
      const saved: SavedAssignmentProblem = {
        id: genId(),
        name: generateAssignmentProjectName(sector, lang),
        sector,
        savedAt: new Date().toISOString(),
        problem,
        result,
      };
      setProblems(prev => [saved, ...prev].slice(0, MAX_PROBLEMS));
      return saved.id;
    },
    []
  );

  const deleteProblem = useCallback((id: string) => {
    setProblems(prev => prev.filter(p => p.id !== id));
  }, []);

  const renameProblem = useCallback((id: string, name: string) => {
    setProblems(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, []);

  const clearAll = useCallback(() => { setProblems([]); }, []);

  return (
    <Ctx.Provider value={{ problems, addProblem, deleteProblem, renameProblem, clearAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAssignmentHistory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAssignmentHistory must be used inside AssignmentHistoryProvider");
  return ctx;
}

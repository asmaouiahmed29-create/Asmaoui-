import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";

export type SectorKey = "industry" | "trade" | "services" | "agriculture" | "custom";

export interface SavedProject {
  id: string;
  name: string;
  sector: SectorKey;
  savedAt: string;
  input: ProblemInput;
  result: SolveResult;
}

const STORAGE_KEY = "optimdz_projects";
const MAX_PROJECTS = 100;

function genId() {
  return `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const SECTOR_NAME_AR: Record<SectorKey, string> = {
  industry:    "صناعي",
  trade:       "تجاري",
  services:    "خدماتي",
  agriculture: "فلاحي",
  custom:      "مخصص",
};
const SECTOR_NAME_FR: Record<SectorKey, string> = {
  industry:    "Industrie",
  trade:       "Commerce",
  services:    "Services",
  agriculture: "Agriculture",
  custom:      "Personnalisé",
};

export function generateProjectName(sector: SectorKey, lang: string): string {
  const now = new Date();
  if (lang === "ar") {
    const day = now.getDate();
    const monthsAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const month = monthsAr[now.getMonth()];
    return `مشروع ${SECTOR_NAME_AR[sector]} — ${day} ${month} ${now.getFullYear()}`;
  } else {
    return `Projet ${SECTOR_NAME_FR[sector]} — ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  }
}

function load(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  } catch {
    return [];
  }
}

function save(projects: SavedProject[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // quota exceeded — silently skip
  }
}

export function estimateStorageKB(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    return Math.round((raw.length * 2) / 1024);
  } catch {
    return 0;
  }
}

interface ProjectHistoryState {
  projects: SavedProject[];
  addProject: (input: ProblemInput, result: SolveResult, sector: SectorKey, lang: string) => void;
  deleteProject: (id: string) => void;
  clearAll: () => void;
  renameProject: (id: string, name: string) => void;
}

const Ctx = createContext<ProjectHistoryState | undefined>(undefined);

export function ProjectHistoryProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<SavedProject[]>(() => load());

  useEffect(() => { save(projects); }, [projects]);

  const addProject = useCallback(
    (input: ProblemInput, result: SolveResult, sector: SectorKey, lang: string) => {
      const project: SavedProject = {
        id: genId(),
        name: generateProjectName(sector, lang),
        sector,
        savedAt: new Date().toISOString(),
        input,
        result,
      };
      setProjects((prev) => {
        const next = [project, ...prev].slice(0, MAX_PROJECTS);
        return next;
      });
    },
    []
  );

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setProjects([]);
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  return (
    <Ctx.Provider value={{ projects, addProject, deleteProject, clearAll, renameProject }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProjectHistory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjectHistory must be used inside ProjectHistoryProvider");
  return ctx;
}

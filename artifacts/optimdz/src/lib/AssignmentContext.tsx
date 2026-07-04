import React, { createContext, useContext, useState } from "react";

export interface AssignmentProblem {
  name: string;
  sector: string;
  objectiveType: "minimize" | "maximize";
  resources: Array<{ name: string }>;
  tasks: Array<{ name: string }>;
  costs: number[][];
  forbidden: boolean[][];
}

interface AssignmentState {
  problem: AssignmentProblem | null;
  setProblem: (p: AssignmentProblem) => void;
  clear: () => void;
}

const AssignmentContext = createContext<AssignmentState | undefined>(undefined);

export function AssignmentProvider({ children }: { children: React.ReactNode }) {
  const [problem, setProblem] = useState<AssignmentProblem | null>(null);
  const clear = () => setProblem(null);
  return (
    <AssignmentContext.Provider value={{ problem, setProblem, clear }}>
      {children}
    </AssignmentContext.Provider>
  );
}

export function useAssignmentState() {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("useAssignmentState must be used within AssignmentProvider");
  return ctx;
}

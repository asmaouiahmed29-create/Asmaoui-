import React, { createContext, useContext, useState } from "react";

export interface TransportSource {
  name: string;
  supply: number;
}

export interface TransportDestination {
  name: string;
  demand: number;
}

export interface TransportProblem {
  name: string;
  sector: string;
  objectiveType: "minimize" | "maximize";
  sources: TransportSource[];
  destinations: TransportDestination[];
  costs: number[][];
}

interface TransportState {
  problem: TransportProblem | null;
  setProblem: (p: TransportProblem) => void;
  clear: () => void;
}

const TransportContext = createContext<TransportState | undefined>(undefined);

export function TransportProvider({ children }: { children: React.ReactNode }) {
  const [problem, setProblem] = useState<TransportProblem | null>(null);
  const clear = () => setProblem(null);
  return (
    <TransportContext.Provider value={{ problem, setProblem, clear }}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransportState() {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error("useTransportState must be used within TransportProvider");
  return ctx;
}

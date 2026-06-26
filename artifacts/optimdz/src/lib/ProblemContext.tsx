import React, { createContext, useContext, useState } from "react";
import type { ProblemInput, SolveResult } from "@workspace/api-client-react";

interface ProblemState {
  input: ProblemInput | null;
  result: SolveResult | null;
  setInputAndResult: (input: ProblemInput, result: SolveResult) => void;
  clear: () => void;
}

const ProblemContext = createContext<ProblemState | undefined>(undefined);

export function ProblemProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState<ProblemInput | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);

  const setInputAndResult = (newInput: ProblemInput, newResult: SolveResult) => {
    setInput(newInput);
    setResult(newResult);
  };

  const clear = () => {
    setInput(null);
    setResult(null);
  };

  return (
    <ProblemContext.Provider value={{ input, result, setInputAndResult, clear }}>
      {children}
    </ProblemContext.Provider>
  );
}

export function useProblemState() {
  const context = useContext(ProblemContext);
  if (context === undefined) {
    throw new Error("useProblemState must be used within a ProblemProvider");
  }
  return context;
}

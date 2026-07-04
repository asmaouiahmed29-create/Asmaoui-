import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ProblemProvider } from "@/lib/ProblemContext";
import { ScenarioProvider } from "@/lib/ScenarioContext";
import { TransportProvider } from "@/lib/TransportContext";
import { TransportHistoryProvider } from "@/lib/TransportHistoryContext";
import { Layout } from "@/components/Layout";
import { TransportLayout } from "@/components/TransportLayout";

import PlatformHome from "@/pages/PlatformHome";
import Home from "@/pages/Home";
import History from "@/pages/History";
import Solve from "@/pages/Solve";
import Results from "@/pages/Results";
import ScenarioCompare from "@/pages/ScenarioCompare";

import TransportHome     from "@/pages/transportation/Home";
import TransportSolve    from "@/pages/transportation/Solve";
import TransportSolution from "@/pages/transportation/Solution";
import TransportOptimize from "@/pages/transportation/Optimize";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();

  return (
    <Switch>
      {/* Platform landing — has its own nav, no Layout wrapper */}
      <Route path="/" component={PlatformHome} />

      {/* All module routes share a catch-all route; layout is chosen by path prefix */}
      <Route>
        {location.startsWith("/transport") ? (
          <TransportHistoryProvider>
            <TransportProvider>
              <TransportLayout>
                <Switch>
                  <Route path="/transport"           component={TransportHome} />
                  <Route path="/transport/solve"     component={TransportSolve} />
                  <Route path="/transport/solution"  component={TransportSolution} />
                  <Route path="/transport/optimize"  component={TransportOptimize} />
                  <Route component={NotFound} />
                </Switch>
              </TransportLayout>
            </TransportProvider>
          </TransportHistoryProvider>
        ) : (
          <Layout>
            <Switch>
              <Route path="/simplex" component={Home} />
              <Route path="/simplex/solve" component={Solve} />
              <Route path="/simplex/results" component={Results} />
              <Route path="/simplex/history" component={History} />
              <Route path="/simplex/scenarios" component={ScenarioCompare} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ProblemProvider>
          <ScenarioProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ScenarioProvider>
        </ProblemProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

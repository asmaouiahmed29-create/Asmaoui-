import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { LanguageProvider } from "@/lib/LanguageContext";
import { ProblemProvider } from "@/lib/ProblemContext";
import { ScenarioProvider } from "@/lib/ScenarioContext";
import { Layout } from "@/components/Layout";

import Home from "@/pages/Home";
import History from "@/pages/History";
import Solve from "@/pages/Solve";
import Results from "@/pages/Results";
import ScenarioCompare from "@/pages/ScenarioCompare";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/solve" component={Solve} />
        <Route path="/results" component={Results} />
        <Route path="/history" component={History} />
        <Route path="/scenarios" component={ScenarioCompare} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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

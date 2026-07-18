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
import { AssignmentProvider } from "@/lib/AssignmentContext";
import { AssignmentHistoryProvider } from "@/lib/AssignmentHistoryContext";
import { Layout } from "@/components/Layout";
import { TransportLayout } from "@/components/TransportLayout";
import { AssignmentLayout } from "@/components/AssignmentLayout";

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

import AssignmentHome     from "@/pages/assignment/Home";
import AssignmentSolve    from "@/pages/assignment/Solve";
import AssignmentSolution from "@/pages/assignment/Solution";

import PertCpm from "@/pages/pert-cpm/PertCpm";
import { PertLayout } from "@/components/PertLayout";
import ProjectFeasibilityHome from "@/pages/project-feasibility/ProjectFeasibilityHome";
import ProjectFeasibility from "@/pages/project-feasibility/ProjectFeasibility";
import InvestmentAppraisal from "@/pages/project-feasibility/InvestmentAppraisal";
import SensitivityAnalysis from "@/pages/project-feasibility/SensitivityAnalysis";
import InvestmentComparison from "@/pages/project-feasibility/InvestmentComparison";
import { ProjectFeasibilityLayout } from "@/components/ProjectFeasibilityLayout";
import KpiDashboardHome   from "@/pages/kpi-dashboard/KpiDashboardHome";
import ManualKpiTracking  from "@/pages/kpi-dashboard/ManualKpiTracking";
import { KpiDashboardLayout } from "@/components/KpiDashboardLayout";

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
        ) : location.startsWith("/assignment") ? (
          <AssignmentHistoryProvider>
            <AssignmentProvider>
              <AssignmentLayout>
                <Switch>
                  <Route path="/assignment"           component={AssignmentHome} />
                  <Route path="/assignment/solve"     component={AssignmentSolve} />
                  <Route path="/assignment/solution"  component={AssignmentSolution} />
                  <Route component={NotFound} />
                </Switch>
              </AssignmentLayout>
            </AssignmentProvider>
          </AssignmentHistoryProvider>
        ) : location.startsWith("/pert-cpm") ? (
          <PertLayout>
            <Switch>
              <Route path="/pert-cpm" component={PertCpm} />
              <Route component={NotFound} />
            </Switch>
          </PertLayout>
        ) : location.startsWith("/project-feasibility") ? (
          <ProjectFeasibilityLayout>
            <Switch>
              <Route path="/project-feasibility"                        component={ProjectFeasibilityHome} />
              <Route path="/project-feasibility/breakeven"             component={ProjectFeasibility} />
              <Route path="/project-feasibility/investment-appraisal"  component={InvestmentAppraisal} />
              <Route path="/project-feasibility/sensitivity-analysis" component={SensitivityAnalysis} />
              <Route path="/project-feasibility/comparison"          component={InvestmentComparison} />
              <Route component={NotFound} />
            </Switch>
          </ProjectFeasibilityLayout>
        ) : location.startsWith("/kpi-dashboard") ? (
          <KpiDashboardLayout>
            <Switch>
              <Route path="/kpi-dashboard"          component={KpiDashboardHome} />
              <Route path="/kpi-dashboard/tracking" component={ManualKpiTracking} />
              <Route component={NotFound} />
            </Switch>
          </KpiDashboardLayout>
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

import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check auth status on mount
    apiRequest("GET", "/api/auth/status").then((res: any) => {
      return res.json();
    }).then((data: any) => {
      setAuthenticated(data.authenticated);
    }).catch(() => {
      setAuthenticated(false);
    });
  }, []);

  if (authenticated === null) {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {authenticated ? (
          <Router />
        ) : (
          <Login onLoginSuccess={() => setAuthenticated(true)} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

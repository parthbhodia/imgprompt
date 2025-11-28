import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Get base path from import.meta.env.BASE_URL (set by Vite)
// This will be '/' for local dev and '/repository-name/' for GitHub Pages
// React Router basename should not have trailing slash
const getBasename = () => {
  const base = import.meta.env.BASE_URL || '/';
  // Remove trailing slash for React Router
  const basename = base === '/' ? '/' : base.replace(/\/$/, '');
  
  // Debug log (remove in production if needed)
  if (import.meta.env.DEV) {
    console.log('Base URL:', import.meta.env.BASE_URL);
    console.log('Basename:', basename);
  }
  
  return basename;
};

const basename = getBasename();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

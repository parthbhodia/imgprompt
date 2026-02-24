import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./contexts/AuthContext";
import { LikesProvider } from "./contexts/LikesContext";
import { ProtectedRoute } from "./components/admin/ProtectedRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPrompts from "./pages/admin/AdminPrompts";
import AdminPromptForm from "./pages/admin/AdminPromptForm";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminPlatforms from "./pages/admin/AdminPlatforms";
import AdminUsers from "./pages/admin/AdminUsers";
import Favorites from "./pages/Favorites";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

// Get base path from import.meta.env.BASE_URL (set by Vite)
const getBasename = () => {
  const base = import.meta.env.BASE_URL || '/';
  const basename = base === '/' ? '/' : base.replace(/\/$/, '');
  if (import.meta.env.DEV) {
    console.log('Base URL:', import.meta.env.BASE_URL);
    console.log('Basename:', basename);
  }
  return basename;
};

const basename = getBasename();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LikesProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <Routes>
            {/* Public site */}
            <Route path="/" element={<Index />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/profile" element={<Profile />} />

            {/* Admin – login (public) */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Admin – protected routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/prompts"
              element={
                <ProtectedRoute allowedRoles={["admin", "editor"]}>
                  <AdminLayout>
                    <AdminPrompts />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/prompts/new"
              element={
                <ProtectedRoute allowedRoles={["admin", "editor"]}>
                  <AdminLayout>
                    <AdminPromptForm />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/prompts/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "editor"]}>
                  <AdminLayout>
                    <AdminPromptForm />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute allowedRoles={["admin", "editor"]}>
                  <AdminLayout>
                    <AdminCategories />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/platforms"
              element={
                <ProtectedRoute allowedRoles={["admin", "editor"]}>
                  <AdminLayout>
                    <AdminPlatforms />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout>
                    <AdminUsers />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </LikesProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

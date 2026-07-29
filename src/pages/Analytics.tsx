import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAnalytics, type AnalyticsData } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Sparkles,
  ArrowLeft,
  ImageIcon,
  Coins,
  TrendingUp,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";

export default function Analytics() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const token = session?.access_token ?? null;

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getAnalytics(token)
      .then(setData)
      .catch(() => toast.error("Could not load analytics."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <main className="min-h-screen bg-background">
        {/* Nav */}
        <nav className="sticky top-0 z-50 backdrop-blur-lg bg-background/70 border-b border-border/40">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <Sparkles className="w-5 h-5 text-primary" />
              ImgPrompt
            </Link>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-primary" />
              Your Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Insights about your image generations.
            </p>
          </div>

          {/* Not signed in */}
          {!user && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
              <LogIn className="w-16 h-16 text-muted-foreground/40" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Sign in to see your analytics</h2>
                <p className="text-muted-foreground text-sm">
                  Your generation history is saved to your account.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {user && loading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
                ))}
              </div>
              <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />
            </div>
          )}

          {/* Analytics content */}
          {user && !loading && data && (
            <div className="space-y-8">
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={<ImageIcon className="w-5 h-5 text-primary" />}
                  label="Total Images"
                  value={data.total_generations.toLocaleString()}
                />
                <StatCard
                  icon={<Coins className="w-5 h-5 text-amber-500" />}
                  label="Credits Used"
                  value={data.credits_used.toLocaleString()}
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                  label="Active Days"
                  value={data.generations_by_day.length.toLocaleString()}
                />
              </div>

              {/* Bar chart */}
              {data.generations_by_day.length > 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
                  <h2 className="text-base font-semibold mb-4">Generations per Day</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.generations_by_day}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + "T00:00:00");
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString()}
                        formatter={(v: number) => [v, "images"]}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-10 text-center text-muted-foreground text-sm">
                  No generation data yet. Start creating to see your activity chart!
                </div>
              )}

              {/* Top prompts */}
              {data.top_prompts.length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-6 space-y-3">
                  <h2 className="text-base font-semibold">Recent Prompts</h2>
                  <ul className="space-y-2">
                    {data.top_prompts.map((p, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="shrink-0 text-muted-foreground font-mono text-xs mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground/80 leading-relaxed line-clamp-2">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no data */}
          {user && !loading && data && data.total_generations === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground/40" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No data yet</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Generate your first image to start tracking your analytics.
                </p>
              </div>
              <Button className="gap-2" onClick={() => navigate("/")}>
                <Sparkles className="w-4 h-4" />
                Start Creating
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

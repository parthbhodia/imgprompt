import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { FileText, Tags, Globe, Users, Loader2 } from "lucide-react";

interface Stats {
  prompts: number;
  categories: number;
  platforms: number;
  users: number;
}

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [prompts, categories, platforms, users] = await Promise.all([
        supabase.from("prompts").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("platforms").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        prompts: prompts.count ?? 0,
        categories: categories.count ?? 0,
        platforms: platforms.count ?? 0,
        users: users.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Prompts", value: stats?.prompts, icon: <FileText className="w-6 h-6" />, color: "text-blue-500" },
    { label: "Categories", value: stats?.categories, icon: <Tags className="w-6 h-6" />, color: "text-emerald-500" },
    { label: "Platforms", value: stats?.platforms, icon: <Globe className="w-6 h-6" />, color: "text-violet-500" },
    { label: "Users", value: stats?.users, icon: <Users className="w-6 h-6" />, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}!
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-muted ${c.color}`}>
                {c.icon}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold">{c.value}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

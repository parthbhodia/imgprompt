import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

interface PromptListItem {
  id: number;
  title: string;
  slug: string;
  featured: boolean;
  category: { name: string } | null;
  slides: { id: number }[];
  prompt_platforms: { platform: { name: string } }[];
}

const AdminPrompts = () => {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PromptListItem | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompts")
      .select(
        `id, title, slug, featured,
         category:categories(name),
         slides(id),
         prompt_platforms(platform:platforms(name))`
      )
      .order("id", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setPrompts((data ?? []) as unknown as PromptListItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("prompts")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Deleted "${deleteTarget.title}"`);
      setPrompts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const toggleFeatured = async (prompt: PromptListItem) => {
    const newFeaturedStatus = !prompt.featured;
    const { error } = await supabase
      .from("prompts")
      .update({ featured: newFeaturedStatus })
      .eq("id", prompt.id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${prompt.title} ${newFeaturedStatus ? 'added to' : 'removed from'} featured`);
      setPrompts((prev) => 
        prev.map((p) => 
          p.id === prompt.id ? { ...p, featured: newFeaturedStatus } : p
        )
      );
    }
  };

  const filtered = prompts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Prompts</h1>
          <p className="text-muted-foreground mt-1">
            {prompts.length} prompt{prompts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button onClick={() => navigate("/admin/prompts/new")} className="gap-2">
          <Plus className="w-4 h-4" />
          New Prompt
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead className="text-center">Slides</TableHead>
                <TableHead className="text-center">Featured</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No prompts found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/admin/prompts/${p.id}`}
                        className="hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {p.category?.name ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.prompt_platforms.map((pp) => (
                          <Badge key={pp.platform.name} variant="outline" className="text-xs">
                            {pp.platform.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{p.slides.length}</TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleFeatured(p)}
                        className="p-1 rounded hover:bg-muted transition-colors mx-auto block"
                        title={p.featured ? "Remove from featured" : "Add to featured"}
                      >
                        <Star 
                          className={`w-4 h-4 transition-colors ${
                            p.featured 
                              ? "text-amber-500 fill-amber-500" 
                              : "text-muted-foreground hover:text-amber-400"
                          }`} 
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/prompts/${p.id}`)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo; and all its
              slides. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPrompts;

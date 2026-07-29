import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMyGenerations, searchGenerations, type GenerationRecord, type SearchResult } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Download, Share2, Wand2, LogIn, ImageOff, ArrowLeft, Copy, Check, Edit, RefreshCw, Zap, Search, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Creations() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGen, setSelectedGen] = useState<GenerationRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = session?.access_token ?? null;

  // Load all generations on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getMyGenerations(token)
      .then((res) => setGenerations(res.generations))
      .catch(() => toast.error("Could not load your creations."))
      .finally(() => setLoading(false));
  }, [token]);

  // Debounced semantic search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim() || !token) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await searchGenerations(token, searchQuery.trim());
        setSearchResults(results);
      } catch {
        toast.error("Search failed.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery, token]);

  const handleDownload = (gen: GenerationRecord) => {
    const link = document.createElement("a");
    link.href = gen.image_url;
    link.download = `vibeimg-${Date.now()}.webp`;
    link.click();
  };

  const handleShare = async (gen: GenerationRecord) => {
    if (navigator.share) {
      await navigator.share({ title: "ImgPrompt", text: gen.content, url: gen.image_url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(gen.image_url);
      toast.success("Image link copied!");
    }
  };

  const handleCopyPrompt = async (gen: GenerationRecord) => {
    try {
      await navigator.clipboard.writeText(gen.content);
      setCopiedId(gen.id);
      toast.success("Prompt copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy prompt.");
    }
  };

  // Edit in Chat - opens chat with image and prompt
  const handleEditInChat = (gen: GenerationRecord) => {
    setSelectedGen(null);
    // Store both image URL and prompt in localStorage for chat to pick up
    localStorage.setItem("creations_edit_in_chat", JSON.stringify({
      imageUrl: gen.image_url,
      prompt: gen.content,
      mode: "edit", // or "remix"
    }));
    navigate("/?editImage=true");
    toast.success("Opening in chat...");
  };

  // Navigate to chat with image as reference (for img2img)
  const handleUseAsReference = (gen: GenerationRecord) => {
    setSelectedGen(null);
    localStorage.setItem("creations_reference_image", JSON.stringify({
      url: gen.image_url,
      prompt: gen.content,
    }));
    navigate("/");
    toast.success("Image loaded. Upload it in the chat to use as reference.");
  };

  // Remix with same prompt
  const handleRemix = (gen: GenerationRecord) => {
    setSelectedGen(null);
    navigate(`/?chatPrompt=${encodeURIComponent(gen.content + ", different variation, remix")}`);
  };

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

        <div className="container mx-auto px-4 py-10 max-w-7xl">
          {/* Header */}
          <div className="mb-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <Wand2 className="w-7 h-7 text-primary" />
                  Your Creations
                </h1>
                <p className="text-muted-foreground mt-1">
                  Click any image to edit, remix, or use as reference.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => navigate("/analytics")}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            </div>

            {/* Search bar — only show when signed in and has generations */}
            {user && !loading && generations.length > 0 && (
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search your images semantically…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Not signed in */}
          {!user && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
              <ImageOff className="w-16 h-16 text-muted-foreground/40" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Sign in to see your creations</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Your generated images are saved to your account.
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {user && loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {user && !loading && generations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
              <ImageOff className="w-16 h-16 text-muted-foreground/40" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No creations yet</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Generate your first image in the AI chat to see it here.
                </p>
              </div>
              <Button className="gap-2" onClick={() => navigate("/")}>
                <Sparkles className="w-4 h-4" />
                Start Creating
              </Button>
            </div>
          )}

          {/* Search results */}
          {user && searchQuery && (
            <div className="mb-8">
              {searching && (
                <p className="text-sm text-muted-foreground mb-4 animate-pulse">Searching…</p>
              )}
              {!searching && searchResults !== null && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </p>
                  {searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <Search className="w-10 h-10 text-muted-foreground/40" />
                      <p className="text-muted-foreground text-sm">No images found matching your search.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {searchResults.map((r, i) => (
                        <div
                          key={i}
                          className="group relative rounded-2xl overflow-hidden cursor-pointer border border-border/40 hover:border-primary/50 transition-all hover:shadow-lg"
                          onClick={() => setSelectedGen({ id: String(i), session_id: "", content: r.prompt, image_url: r.image_url, created_at: "" })}
                        >
                          <img src={r.image_url} alt={r.prompt} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                            <p className="text-white text-xs line-clamp-3">{r.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Creations Grid — hidden while searching */}
          {user && !loading && generations.length > 0 && !searchQuery && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {generations.length} image{generations.length !== 1 ? "s" : ""} generated
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {generations.map((gen) => (
                  <div
                    key={gen.id}
                    className="group relative rounded-2xl overflow-hidden cursor-pointer border border-border/40 hover:border-primary/50 transition-all hover:shadow-lg"
                    onClick={() => setSelectedGen(gen)}
                  >
                    <img
                      src={gen.image_url}
                      alt={gen.content}
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 gap-2">
                      <p className="text-white text-xs line-clamp-3 leading-relaxed font-medium">
                        {gen.content || "No prompt"}
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEditInChat(gen); }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary/80 hover:bg-primary text-white text-xs font-medium transition-colors"
                          title="Edit in Chat"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDownload(gen); }}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleShare(gen); }}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Date badge */}
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white/80">
                        {new Date(gen.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedGen && (
        <Dialog open={!!selectedGen} onOpenChange={() => setSelectedGen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Your Creation</DialogTitle>
              <DialogDescription>
                Generated on {new Date(selectedGen.created_at).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Image */}
              <div>
                <img
                  src={selectedGen.image_url}
                  alt={selectedGen.content}
                  className="w-full rounded-xl object-cover max-h-80"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4">
                {/* Prompt display */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Prompt Used</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg leading-relaxed">
                    {selectedGen.content || "No prompt recorded"}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 mt-auto">
                  {/* Edit in Chat */}
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-primary to-accent"
                    onClick={() => handleEditInChat(selectedGen)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit in Chat
                  </Button>

                  {/* Remix */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleRemix(selectedGen)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Remix as Variation
                  </Button>

                  {/* Use as Reference */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleUseAsReference(selectedGen)}
                  >
                    <Zap className="w-4 h-4" />
                    Use as Reference
                  </Button>

                  {/* Utility buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyPrompt(selectedGen)}
                      className="gap-1"
                    >
                      {copiedId === selectedGen.id
                        ? <Check className="w-4 h-4 text-green-500" />
                        : <Copy className="w-4 h-4" />}
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(selectedGen)}
                      className="gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShare(selectedGen)}
                      className="gap-1"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Footer />
    </>
  );
}

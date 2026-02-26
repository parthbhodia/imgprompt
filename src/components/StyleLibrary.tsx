import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Palette, Search, Heart, Copy, ExternalLink, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllStyles,
  getStyleCategories,
  searchStyles,
  getStyleDetail,
  type LoRAStyle,
  type StyleDetailResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface StyleLibraryProps {
  onStyleSelected?: (styleId: string, trigger: string) => void;
}

export function StyleLibrary({ onStyleSelected }: StyleLibraryProps) {
  const { session, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState<LoRAStyle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleDetailResponse | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !session) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [stylesData, categoriesData] = await Promise.all([
          getAllStyles(session.access_token),
          getStyleCategories(session.access_token),
        ]);
        setStyles(stylesData.styles);
        setCategories(categoriesData.categories);

        // Load favorites from localStorage
        const saved = localStorage.getItem("favorite_styles");
        if (saved) {
          setFavorites(new Set(JSON.parse(saved)));
        }
      } catch (e) {
        toast.error("Failed to load styles");
      } finally {
        setLoading(false);
      }
    };

    if (open) loadData();
  }, [open, user, session]);

  const filteredStyles = styles.filter(style => {
    const matchesSearch = !searchQuery ||
      style.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      style.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      style.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || style.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleStyleClick = async (styleId: string) => {
    if (!session) return;

    try {
      const detail = await getStyleDetail(session.access_token, styleId);
      setSelectedStyle(detail);
    } catch (e) {
      toast.error("Failed to load style details");
    }
  };

  const toggleFavorite = (styleId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(styleId)) {
      newFavorites.delete(styleId);
    } else {
      newFavorites.add(styleId);
    }
    setFavorites(newFavorites);
    localStorage.setItem("favorite_styles", JSON.stringify(Array.from(newFavorites)));
  };

  const handleUseStyle = (style: LoRAStyle) => {
    onStyleSelected?.(style.id, style.trigger_word);
    setOpen(false);
    toast.success(`Added "${style.name}" style to your prompt!`);
  };

  if (!user || !session) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Open style library"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Styles</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Style Library</SheetTitle>
          <SheetDescription>
            Browse curated LoRA styles and support artists
          </SheetDescription>
        </SheetHeader>

        {selectedStyle ? (
          // Detail View
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              {/* Back Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStyle(null)}
              >
                ← Back to Styles
              </Button>

              {/* Style Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{selectedStyle.style.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedStyle.style.description}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(selectedStyle.style.id)}
                    className="text-xl"
                  >
                    {favorites.has(selectedStyle.style.id) ? "❤️" : "🤍"}
                  </button>
                </div>

                {/* Category & Tags */}
                <div className="flex flex-wrap gap-2">
                  <Badge className="capitalize">
                    {selectedStyle.style.category}
                  </Badge>
                  {selectedStyle.style.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Trigger Word */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Trigger Word</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded border font-mono text-sm">
                    {selectedStyle.style.trigger_word}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedStyle.style.trigger_word);
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Artist Credit */}
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  🎨 Artist Credit
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedStyle.with_credit.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </p>
                {selectedStyle.style.artist_url && (
                  <a
                    href={selectedStyle.style.artist_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Support the Artist
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Recommended Settings */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Recommended Settings</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/30 p-3 rounded">
                    <p className="text-muted-foreground text-xs">Strength</p>
                    <p className="font-mono font-bold">
                      {(selectedStyle.style.recommended_strength * 100).toFixed(0)}%
                    </p>
                  </div>
                  {selectedStyle.style.recommended_cfg && (
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-muted-foreground text-xs">CFG</p>
                      <p className="font-mono font-bold">
                        {selectedStyle.style.recommended_cfg}
                      </p>
                    </div>
                  )}
                  {selectedStyle.style.recommended_steps && (
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-muted-foreground text-xs">Steps</p>
                      <p className="font-mono font-bold">
                        {selectedStyle.style.recommended_steps}
                      </p>
                    </div>
                  )}
                  {selectedStyle.style.recommended_sampler && (
                    <div className="bg-muted/30 p-3 rounded">
                      <p className="text-muted-foreground text-xs">Sampler</p>
                      <p className="font-mono font-bold text-xs">
                        {selectedStyle.style.recommended_sampler}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Negative Tags */}
              {selectedStyle.style.negative_tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Negative Tags (Avoid)</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedStyle.style.negative_tags.map(tag => (
                      <Badge key={tag} variant="destructive" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Use Button */}
              <Button
                onClick={() => handleUseStyle(selectedStyle.style)}
                className="w-full gap-2"
                size="lg"
              >
                <Palette className="w-4 h-4" />
                Use This Style
              </Button>
            </div>
          </ScrollArea>
        ) : (
          // List View
          <>
            {/* Search */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search styles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Categories */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className="capitalize"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Styles List */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                </div>
              ) : filteredStyles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No styles found
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {filteredStyles.map(style => (
                    <button
                      key={style.id}
                      onClick={() => handleStyleClick(style.id)}
                      className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{style.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {style.description}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(style.id);
                          }}
                          className="text-lg shrink-0"
                        >
                          {favorites.has(style.id) ? "❤️" : "🤍"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {style.category}
                          </Badge>
                          {style.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {style.trigger_word}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Share2, Copy, Download, Zap, Search, Filter,
  TrendingUp, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/Footer";

// Featured model cards
interface FeaturedModel {
  id: string;
  name: string;
  category: string;
  tags: string[];
  image: string;
  artist: string;
  artistUrl?: string;
  triggerWord: string;
  description: string;
  downloads: number;
  rating: number;
  favoriteCount: number;
  color: string;
  recommended: boolean;
}

const FEATURED_MODELS: FeaturedModel[] = [
  {
    id: "princess-jasmine",
    name: "Princess Jasmine",
    category: "Character",
    tags: ["portrait", "character", "fantasy", "lora"],
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
    artist: "Nostradabra",
    triggerWord: "princess jasmine style",
    description: "Beautiful character portrait with fantasy aesthetic",
    downloads: 1600,
    rating: 4.8,
    favoriteCount: 256,
    color: "from-blue-500 to-cyan-500",
    recommended: false,
  },
  {
    id: "pixel-core",
    name: "NEW PIXEL CORE - ILL - FLUX - ZIT",
    category: "Illustration",
    tags: ["pixel", "illustration", "character", "new"],
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=500&fit=crop",
    artist: "Visionary_Studio",
    triggerWord: "pixel core style",
    description: "High-quality pixel art and illustration style",
    downloads: 1700,
    rating: 4.9,
    favoriteCount: 381,
    color: "from-red-500 to-pink-500",
    recommended: true,
  },
  {
    id: "space-worlds",
    name: "Space Worlds - Dark One - ZIT",
    category: "Sci-Fi",
    tags: ["scifi", "dark", "cyberpunk", "moody"],
    image: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&h=500&fit=crop",
    artist: "Zios",
    triggerWord: "space worlds dark",
    description: "Dark sci-fi and cyberpunk aesthetic",
    downloads: 138,
    rating: 4.7,
    favoriteCount: 22,
    color: "from-slate-700 to-blue-900",
    recommended: false,
  },
  {
    id: "incase-style",
    name: "Incase Style (NoobAI)",
    category: "Character",
    tags: ["character", "anime", "style", "noobai"],
    image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&h=500&fit=crop",
    artist: "Digital_pastel",
    triggerWord: "incase style",
    description: "Unique character design with vibrant colors",
    downloads: 1700,
    rating: 4.8,
    favoriteCount: 660,
    color: "from-orange-400 to-yellow-400",
    recommended: false,
  },
  {
    id: "anime-portrait",
    name: "Anime Portrait Master",
    category: "Anime",
    tags: ["anime", "portrait", "character", "detailed"],
    image: "https://images.unsplash.com/photo-1535016120754-18c5d804d309?w=400&h=500&fit=crop",
    artist: "AnimeArtist_Pro",
    triggerWord: "anime portrait",
    description: "Stunning anime-style character portraits",
    downloads: 2400,
    rating: 4.9,
    favoriteCount: 542,
    color: "from-purple-500 to-pink-500",
    recommended: false,
  },
  {
    id: "realistic-photo",
    name: "Hyper Realistic Photography",
    category: "Photo",
    tags: ["realistic", "photo", "portrait", "professional"],
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop",
    artist: "PhotoMaster",
    triggerWord: "hyper realistic",
    description: "Professional photorealistic portrait style",
    downloads: 3100,
    rating: 5.0,
    favoriteCount: 1203,
    color: "from-amber-600 to-orange-600",
    recommended: true,
  },
  {
    id: "oil-painting",
    name: "Classical Oil Painting",
    category: "Art",
    tags: ["painting", "classical", "art", "detailed"],
    image: "https://images.unsplash.com/photo-1578926078328-123fc6ab20a7?w=400&h=500&fit=crop",
    artist: "ArtisticMind",
    triggerWord: "oil painting style",
    description: "Beautiful classical oil painting aesthetic",
    downloads: 892,
    rating: 4.7,
    favoriteCount: 445,
    color: "from-amber-700 to-red-700",
    recommended: false,
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon Aesthetic",
    category: "Cyberpunk",
    tags: ["cyberpunk", "neon", "futuristic", "moody"],
    image: "https://images.unsplash.com/photo-1550439062-2ab94b257e16?w=400&h=500&fit=crop",
    artist: "NeonDreams",
    triggerWord: "cyberpunk neon",
    description: "Vibrant cyberpunk with neon lighting",
    downloads: 1543,
    rating: 4.8,
    favoriteCount: 789,
    color: "from-cyan-500 to-blue-500",
    recommended: false,
  },
];

export function Gallery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"trending" | "new" | "top">("trending");

  const categories = Array.from(new Set(FEATURED_MODELS.map(m => m.category)));

  useEffect(() => {
    const saved = localStorage.getItem("favorite_models");
    if (saved) {
      setFavorites(new Set(JSON.parse(saved)));
    }
  }, []);

  const filteredModels = FEATURED_MODELS.filter(model => {
    const matchesSearch = !search ||
      model.name.toLowerCase().includes(search.toLowerCase()) ||
      model.artist.toLowerCase().includes(search.toLowerCase()) ||
      model.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = !selectedCategory || model.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const sortedModels = [...filteredModels].sort((a, b) => {
    if (sortBy === "trending") return b.downloads - a.downloads;
    if (sortBy === "top") return b.rating - a.rating;
    return 0; // new would need dates
  });

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
    localStorage.setItem("favorite_models", JSON.stringify(Array.from(newFavorites)));
  };

  const handleUseModel = (model: FeaturedModel) => {
    if (!user) {
      navigate("/");
      toast.error("Please sign in to use models");
      return;
    }
    
    // Navigate to chat with the model's trigger word
    navigate("/?prompt=" + encodeURIComponent(model.triggerWord));
    toast.success(`Added "${model.name}" to your prompt!`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/40 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-6 h-6 text-primary" />
                <h1 className="text-3xl font-bold">Featured Models</h1>
              </div>
              <p className="text-muted-foreground">
                Discover curated LoRA models and styles to enhance your image generation
              </p>
            </div>

            {/* Search & Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, artist, or tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
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
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant={sortBy === "trending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("trending")}
                  className="gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Trending
                </Button>
                <Button
                  variant={sortBy === "top" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("top")}
                >
                  Top Rated
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {sortedModels.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No models found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedModels.map(model => (
                <div
                  key={model.id}
                  className="group relative overflow-hidden rounded-xl border border-border/40 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/20 bg-card"
                >
                  {/* Recommended Badge */}
                  {model.recommended && (
                    <div className="absolute top-3 right-3 z-20">
                      <Badge className="bg-gradient-to-r from-amber-500 to-red-500 gap-1">
                        <Zap className="w-3 h-3" />
                        Recommended
                      </Badge>
                    </div>
                  )}

                  {/* Image Container */}
                  <div className="relative overflow-hidden h-64 sm:h-80">
                    <img
                      src={model.image}
                      alt={model.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
                      "opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    )} />

                    {/* Hover Actions */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Button
                        size="lg"
                        className="gap-2 rounded-full"
                        onClick={() => handleUseModel(model)}
                      >
                        <Sparkles className="w-4 h-4" />
                        Use This Model
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => {
                            navigator.clipboard.writeText(model.triggerWord);
                            toast.success("Trigger word copied!");
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: model.name,
                                text: model.description,
                                url: window.location.href,
                              });
                            } else {
                              navigator.clipboard.writeText(window.location.href);
                              toast.success("Link copied!");
                            }
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm sm:text-base line-clamp-2">
                            {model.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            by {model.artist}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleFavorite(model.id)}
                          className="text-xl shrink-0 hover:scale-125 transition-transform"
                        >
                          {favorites.has(model.id) ? "❤️" : "🤍"}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {model.description}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {model.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Trigger Word */}
                    <div className="bg-muted/50 rounded px-2 py-1">
                      <p className="text-xs text-muted-foreground">Trigger:</p>
                      <code className="text-xs font-mono text-primary truncate block">
                        {model.triggerWord}
                      </code>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-foreground">
                          {(model.downloads / 1000).toFixed(1)}k
                        </p>
                        <p className="text-muted-foreground">Downloads</p>
                      </div>
                      <div className="text-center border-x border-border/40">
                        <p className="font-bold text-yellow-500">⭐ {model.rating}</p>
                        <p className="text-muted-foreground">Rating</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-rose-500">❤️ {model.favoriteCount}</p>
                        <p className="text-muted-foreground">Favorites</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

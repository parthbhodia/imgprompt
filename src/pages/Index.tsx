import { useState } from "react";
import { PromptCard } from "@/components/PromptCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Zap, Copy, Search } from "lucide-react";

// Import generated images
import weddingSunset from "@/assets/wedding-sunset.jpg";
import weddingRings from "@/assets/wedding-rings.jpg";
import weddingDance from "@/assets/wedding-dance.jpg";
import portraitNeon from "@/assets/portrait-neon.jpg";
import portraitFashion from "@/assets/portrait-fashion.jpg";
import portraitSmoke from "@/assets/portrait-smoke.jpg";
import artAbstract from "@/assets/art-abstract.jpg";
import artGeometric from "@/assets/art-geometric.jpg";
import artFluid from "@/assets/art-fluid.jpg";
import animeCharacter from "@/assets/anime-character.jpg";
import animeMagical from "@/assets/anime-magical.jpg";
import animeWarrior from "@/assets/anime-warrior.jpg";
import productPhone from "@/assets/product-phone.jpg";
import productHeadphones from "@/assets/product-headphones.jpg";
import productWatch from "@/assets/product-watch.jpg";
import landscapeMountains from "@/assets/landscape-mountains.jpg";
import landscapeLake from "@/assets/landscape-lake.jpg";
import landscapeHills from "@/assets/landscape-hills.jpg";

const prompts = [
  {
    id: 1,
    images: [weddingSunset, weddingRings, weddingDance],
    title: "Romantic Wedding Sunset",
    category: "Wedding",
    prompt: "A beautiful romantic wedding photo of a couple at sunset, bride in white dress and groom in suit, golden hour lighting, soft bokeh background, professional photography style, warm colors",
    platforms: ["Midjourney", "DALL-E 3", "Stable Diffusion"],
  },
  {
    id: 2,
    images: [portraitNeon, portraitFashion, portraitSmoke],
    title: "Cyberpunk Neon Portrait",
    category: "Portrait",
    prompt: "A creative portrait of a young person with vibrant neon lighting, cyberpunk aesthetic, cool blue and purple tones, dramatic side lighting, professional studio photography",
    platforms: ["Midjourney", "Leonardo AI", "Stable Diffusion"],
  },
  {
    id: 3,
    images: [artAbstract, artGeometric, artFluid],
    title: "Flowing Abstract Art",
    category: "Art",
    prompt: "Abstract digital art with flowing shapes and vibrant gradients, purple pink and blue colors, modern contemporary style, ethereal atmosphere",
    platforms: ["DALL-E 3", "Midjourney", "Adobe Firefly"],
  },
  {
    id: 4,
    images: [animeCharacter, animeMagical, animeWarrior],
    title: "Magical Anime Character",
    category: "Anime",
    prompt: "A stunning anime-style character with detailed features, colorful hair, magical effects, fantasy theme, vibrant colors, professional anime art style",
    platforms: ["Niji Journey", "Stable Diffusion", "Leonardo AI"],
  },
  {
    id: 5,
    images: [productPhone, productHeadphones, productWatch],
    title: "Modern Tech Product",
    category: "Product",
    prompt: "Professional product photography of a modern smartphone on a gradient background, studio lighting, sleek design, tech aesthetic, ultra clean",
    platforms: ["Midjourney", "DALL-E 3", "Adobe Firefly"],
  },
  {
    id: 6,
    images: [landscapeMountains, landscapeLake, landscapeHills],
    title: "Epic Mountain Sunrise",
    category: "Landscape",
    prompt: "A majestic landscape photo of mountains at sunrise, epic scale, dramatic clouds, golden light, nature photography, breathtaking vista",
    platforms: ["Midjourney", "Stable Diffusion", "Leonardo AI"],
  },
];

const categories = ["All", "Wedding", "Portrait", "Art", "Anime", "Product", "Landscape"];

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesCategory = activeCategory === "All" || prompt.category === activeCategory;
    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10 animate-gradient" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse delay-1000" />

      <div className="relative z-10">
        {/* Hero Section */}
        <header className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI Prompt Library</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Discover Amazing
              <span className="text-gradient block mt-2">AI Prompts</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See exactly how stunning AI images were created. Click any card to reveal the magic prompt behind it. Copy, learn, and create your own masterpieces!
            </p>

            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button className="gradient-primary neon-glow font-semibold px-8">
                <Zap className="w-5 h-5 mr-2" />
                Explore Prompts
              </Button>
              <Button variant="outline" className="glass font-semibold px-8">
                <Copy className="w-5 h-5 mr-2" />
                Learn More
              </Button>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <section className="container mx-auto px-4 py-4">
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search prompts by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 glass text-base"
            />
          </div>
        </section>

        {/* Category Filter */}
        <section className="container mx-auto px-4 py-8">
          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </section>

        {/* Prompt Gallery */}
        <section className="container mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrompts.map((prompt, index) => (
              <div
                key={prompt.id}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <PromptCard
                  images={prompt.images}
                  prompt={prompt.prompt}
                  category={prompt.category}
                  title={prompt.title}
                  platforms={prompt.platforms}
                />
              </div>
            ))}
          </div>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                No prompts found in this category. Try selecting a different one!
              </p>
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer className="container mx-auto px-4 py-16 text-center">
          <div className="glass rounded-3xl p-12 space-y-6">
            <h2 className="text-3xl font-bold">
              Ready to Create Something <span className="text-gradient">Amazing?</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Use these prompts as inspiration for your next AI art project. Mix, match, and make them your own!
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;

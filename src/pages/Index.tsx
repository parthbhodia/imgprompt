import { useState, useRef } from "react";
import { PromptCard } from "@/components/PromptCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Zap, Copy, Search, Lightbulb, Star, Palette } from "lucide-react";

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
    prompt: `1. Capture a cinematic sunset wedding scene with molten gold horizons.
2. Position the couple in a gentle embrace, foreheads touching softly.
3. Dress the bride in a modern corseted gown with flowing chiffon layers.
4. Style the groom in a tailored charcoal suit with subtle satin lapels.
5. Place dried pampas grass and blush roses in the floral arrangements.
6. Request backlit flares that wrap the subjects in amber light.
7. Use a prime 85mm portrait lens aesthetic for dreamy compression.
8. Blur the background with creamy bokeh while keeping faces razor sharp.
9. Add a transparent veil drifting in the breeze for motion.
10. Introduce reflective highlights on the waterline in the distance.
11. Balance warm light with cool shadows for depth.
12. Include delicate jewelry glints on the bride’s neckline.
13. Allow subtle laughter expressions to keep the image candid.
14. Grade colors toward honey, terracotta, and dusty rose.
15. Sprinkle tiny floating dust particles for atmosphere.
16. Emphasize handcrafted stationery props on a nearby marble table.
17. Maintain editorial fashion vibes while feeling intimate.
18. Finish with light film grain for authenticity.
19. Ensure the horizon sits in the lower third for composition.
20. Export as a high-resolution image ready for fine-art printing.`,
    platforms: ["Midjourney", "DALL-E 3", "Stable Diffusion"],
  },
  {
    id: 2,
    images: [portraitNeon, portraitFashion, portraitSmoke],
    title: "Cyberpunk Neon Portrait",
    category: "Portrait",
    prompt: `1. Build a cyberpunk portrait with neon magenta and cyan accents.
2. Place the subject slightly off-center for magazine editorial framing.
3. Add reflective chrome makeup on cheekbones and temples.
4. Style hair with undercuts and luminous fiber-optic strands.
5. Use moody side lighting with sharp rim highlights.
6. Introduce translucent holographic UI panels floating nearby.
7. Include subtle rain streaks on the glass foreground.
8. Emphasize smoky atmosphere with volumetric light rays.
9. Select a shallow depth of field to isolate the face.
10. Add iridescent eyeshadow that shifts between teal and violet.
11. Give the subject a confident smirk for storytelling.
12. Incorporate glitch effects along the jacket edges.
13. Render metallic accessories with worn textures.
14. Color grade toward cool blues balanced by hot pink accents.
15. Enhance skin texture while keeping pores natural.
16. Layer faint city lights in the blurred background.
17. Introduce micro LEDs embedded in the clothing seams.
18. Apply a 35mm film grain overlay for grit.
19. Keep contrast punchy but protect highlight detail.
20. Deliver a 4K portrait ready for album art.`,
    platforms: ["Midjourney", "Leonardo AI", "Stable Diffusion"],
  },
  {
    id: 3,
    images: [artAbstract, artGeometric, artFluid],
    title: "Flowing Abstract Art",
    category: "Art",
    prompt: `1. Generate an abstract composition inspired by fluid acrylic pours.
2. Use sweeping ribbons of violet, fuchsia, and cerulean.
3. Blend gradients that transition like northern lights.
4. Add delicate metallic gold veining for luxury.
5. Introduce cellular lacing patterns reminiscent of resin art.
6. Ensure negative space breathes around the central vortex.
7. Overlay translucent geometric prisms for contrast.
8. Incorporate micro speckles of stardust particles.
9. Vary opacity layers to create depth.
10. Apply soft bloom to the brightest highlights.
11. Keep edges organic rather than perfectly smooth.
12. Include hints of turquoise mist swirling outward.
13. Add subtle motion blur to suggest movement.
14. Use high-resolution textures for print clarity.
15. Balance warm and cool zones harmoniously.
16. Allow wisps of smoke-like trails to escape the core.
17. Introduce faint shadow gradients for dimensionality.
18. Finish with a satin sheen across the canvas.
19. Preserve ultra-clean whites for gallery presentation.
20. Deliver a square composition suitable for wall art.`,
    platforms: ["DALL-E 3", "Midjourney", "Adobe Firefly"],
  },
  {
    id: 4,
    images: [animeCharacter, animeMagical, animeWarrior],
    title: "Magical Anime Character",
    category: "Anime",
    prompt: `1. Design a heroic anime mage hovering above crystalline ruins.
2. Give them pastel iridescent hair floating weightlessly.
3. Craft expressive golden eyes with star-shaped pupils.
4. Outfit includes layered kimono armor with holographic panels.
5. Summon swirling spell circles etched with runes.
6. Populate the scene with tiny spirit familiars glowing softly.
7. Use painterly clouds tinted lavender and peach.
8. Render fabric folds with dynamic motion and depth.
9. Add shimmering particle trails following hand gestures.
10. Balance cute aesthetics with powerful posture.
11. Include ornate staff tipped with a radiant prism.
12. Cast dramatic light from below to emphasize magic.
13. Integrate neon gradients into shadowed areas.
14. Highlight reflective metallic trims on accessories.
15. Provide subtle freckles to humanize the character.
16. Keep line art crisp while shading stays soft.
17. Add floating petals and embers for atmosphere.
18. Enhance background with distant floating islands.
19. Apply chromatic aberration for anime energy.
20. Output as vibrant key art ready for splash screens.`,
    platforms: ["Niji Journey", "Stable Diffusion", "Leonardo AI"],
  },
  {
    id: 5,
    images: [productPhone, productHeadphones, productWatch],
    title: "Modern Tech Product",
    category: "Product",
    prompt: `1. Stage a minimalist studio shot of premium wearable tech.
2. Place the device on a matte acrylic pedestal with soft edges.
3. Use gradient lighting transitioning from deep navy to electric teal.
4. Create a hero key light that wraps smoothly around the product.
5. Add a faint specular highlight to emphasize curvature.
6. Introduce a secondary rim light for separation.
7. Keep background spotless with no banding.
8. Position floating UI icons that hint at smart features.
9. Use shallow depth of field so base fades gently.
10. Ensure brand logo area is unobstructed.
11. Apply realistic fingerprints subtly for authenticity.
12. Include a complementary accessory blurred in the back.
13. Balance reflections to avoid hotspots.
14. Emulate a 70mm product lens look for compression.
15. Add micro dust particles catching the light.
16. Color grade toward cool, futuristic hues.
17. Maintain perfect symmetry in composition.
18. Export at 6000px for billboard readiness.
19. Deliver both glossy and matte texture variants.
20. Provide negative space for copy placement.`,
    platforms: ["Midjourney", "DALL-E 3", "Adobe Firefly"],
  },
  {
    id: 6,
    images: [landscapeMountains, landscapeLake, landscapeHills],
    title: "Epic Mountain Sunrise",
    category: "Landscape",
    prompt: `1. Paint a panoramic mountain sunrise above rolling mist.
2. Layer multiple ridge lines fading into atmospheric perspective.
3. Let warm sunlight kiss the highest peaks in molten gold.
4. Fill valleys with low-lying clouds drifting slowly.
5. Introduce a reflective alpine lake mirroring the sky.
6. Add wildflower meadows in the foreground for color pops.
7. Use leading lines from a winding trail toward the horizon.
8. Render detailed rock textures with subtle lichen.
9. Include distant waterfalls cascading into the fog.
10. Balance cool blues in shadows against warm highlights.
11. Add soaring birds for a sense of scale.
12. Place lens flare peeking from behind a summit.
13. Simulate long-exposure motion in the clouds.
14. Ensure depth of field keeps entire vista sharp.
15. Apply soft haze for atmospheric storytelling.
16. Keep the sky dynamic with stratified cloud layers.
17. Add faint sun rays breaking through gaps.
18. Introduce hikers silhouetted for human scale.
19. Grade colors toward cinematic teal and orange harmony.
20. Deliver ultra-wide resolution suitable for immersive prints.`,
    platforms: ["Midjourney", "Stable Diffusion", "Leonardo AI"],
  },
];

const categories = ["All", "Wedding", "Portrait", "Art", "Anime", "Product", "Landscape"];

const faqItems = [
  {
    question: "What makes VibeIMG different from other AI prompt libraries?",
    answer: "VibeIMG pairs every prompt with finished visuals, detailed guidance, and platform tags so you know exactly how to recreate the look across Midjourney, DALL·E 3, Stable Diffusion, and more.",
  },
  {
    question: "Can I use these prompts for commercial projects?",
    answer: "Yes—each prompt is written to be production-ready. We recommend customizing names, colors, and brand cues before publishing to ensure unique final images.",
  },
  {
    question: "How often is the VibeIMG library updated?",
    answer: "We add fresh prompt packs weekly, focusing on trending aesthetics like cyberpunk portraits, anime splash art, luxury products, and cinematic landscapes.",
  },
  {
    question: "Do I need advanced AI knowledge to start?",
    answer: "Not at all. Each prompt includes plain-language steps that cover composition, lighting, camera choices, and color grading so beginners can follow along confidently.",
  },
];

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "VibeIMG",
  url: "https://vibeimg.xyz",
  description: "VibeIMG is a curated AI prompt library that showcases premium Midjourney, DALL·E, and Stable Diffusion prompts with visuals and creator tips.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://vibeimg.xyz/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesCategory = activeCategory === "All" || prompt.category === activeCategory;
    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
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
              <Button onClick={scrollToGallery} className="gradient-primary neon-glow font-semibold px-8">
                <Zap className="w-5 h-5 mr-2" />
                Explore Prompts
              </Button>
              <Button onClick={() => setIsHelpDialogOpen(true)} variant="outline" className="glass font-semibold px-8">
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
        <section ref={galleryRef} className="container mx-auto px-4 pb-20">
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

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <p className="text-sm uppercase tracking-widest text-primary font-semibold">FAQ</p>
              <h2 className="text-3xl font-bold">Answers to popular VibeIMG questions</h2>
              <p className="text-muted-foreground max-w-3xl mx-auto">
                These search-optimized answers help new creators—and search engines—understand how to get the most out of the vibeimg.xyz prompt library.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {faqItems.map((item) => (
                <article key={item.question} className="rounded-2xl border border-border/60 p-6 bg-background/80 backdrop-blur">
                  <h3 className="text-xl font-semibold mb-2">{item.question}</h3>
                  <p className="text-muted-foreground text-sm">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
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

      {/* Help Dialog */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Lightbulb className="w-6 h-6 text-primary" />
              How to Use AI Prompts
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Master the art of creating stunning AI images with these tips
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Copy className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Copy & Customize</h4>
                  <p className="text-sm text-muted-foreground">
                    Click any prompt card to reveal and copy the full prompt. Modify details like colors, style, or subject to make it unique.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Be Specific</h4>
                  <p className="text-sm text-muted-foreground">
                    The more details you provide (lighting, mood, style, colors), the better your results. Don't be afraid to be descriptive!
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Try Different Platforms</h4>
                  <p className="text-sm text-muted-foreground">
                    Each prompt shows compatible AI platforms. Experiment across Midjourney, DALL-E, Stable Diffusion, and others for varied results.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold mb-1">Iterate & Experiment</h4>
                  <p className="text-sm text-muted-foreground">
                    Your first generation might not be perfect. Try variations, adjust parameters, and refine your prompt until you get the results you want.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
};

export default Index;

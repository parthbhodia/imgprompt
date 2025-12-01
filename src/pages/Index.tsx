import { useState, useRef } from "react";
import { PromptCard } from "@/components/PromptCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Zap, Copy, Search, Lightbulb, Star, Palette, MessageCircle } from "lucide-react";
import promptsData from "@/data/prompts.json";

// Import generated images
import weddingSunset from "@/assets/wedding-sunset.jpg";
import weddingRings from "@/assets/wedding-rings.jpg";
import weddingDance from "@/assets/wedding-dance.jpg";
import portraitNeon from "@/assets/portrait-neon.jpg";
import portraitFashion from "@/assets/portrait-fashion.jpg";
import portraitSmoke from "@/assets/portrait-smoke.jpg";
import portraitHeadshotModern from "@/assets/portrait-headshot-modern.jpg";
import portraitHeadshotNeutral from "@/assets/portrait-headshot-neutral.jpg";
import portraitHeadshotBlonde from "@/assets/portrait-headshot-blonde.jpg";
import portraitCreativeCitrus from "@/assets/portrait-creative-citrus.jpg";
import portraitCreativeGraphite from "@/assets/portrait-creative-graphite.jpg";
import portraitCreativeGradient from "@/assets/portrait-creative-gradient.jpg";
import instagramGhibli from "@/assets/instagram-ghibli.png";
import instagramGhibliForest from "@/assets/instagram-ghibli-forest.png";
import instagramGhibliFamily from "@/assets/instagram-ghibli-family.png";
import ghibliArtWorkshop from "@/assets/Creating-Ghibli-Art-with-ChatGPT.jpg";
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
import youngerSelfPolaroid from "@/assets/younger-self-polaroid.webp";

type PromptSlideConfig = {
  imageKey: string;
  prompt: string;
};

type PromptConfig = {
  id: number;
  title: string;
  category: string;
  platforms: string[];
  slides: PromptSlideConfig[];
};

type PromptData = {
  categories: string[];
  prompts: PromptConfig[];
};

const promptData = promptsData as PromptData;

const imageMap = {
  ghibliArtWorkshop,
  instagramGhibliFamily,
  instagramGhibliForest,
  instagramGhibli,
  weddingSunset,
  weddingRings,
  weddingDance,
  portraitNeon,
  portraitFashion,
  portraitSmoke,
  portraitCreativeGraphite,
  portraitCreativeCitrus,
  portraitCreativeGradient,
  portraitHeadshotModern,
  portraitHeadshotBlonde,
  portraitHeadshotNeutral,
  artAbstract,
  artGeometric,
  artFluid,
  animeCharacter,
  animeMagical,
  animeWarrior,
  productPhone,
  productHeadphones,
  productWatch,
  landscapeMountains,
  landscapeLake,
  landscapeHills,
  youngerSelfPolaroid,
} as const;

type ImageKey = keyof typeof imageMap;

const getImageByKey = (key: string) => {
  const image = imageMap[key as ImageKey];
  if (!image) {
    console.warn(`Missing image for key: ${key}`);
    return "";
  }
  return image;
};

const prompts = promptData.prompts.map((prompt) => ({
  ...prompt,
  slides: prompt.slides.map((slide) => ({
    image: getImageByKey(slide.imageKey),
    prompt: slide.prompt,
  })),
}));

const categories = promptData.categories;

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
  const defaultCategory = categories[0] ?? "All";
  const [activeCategory, setActiveCategory] = useState(defaultCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  const featuredPromptIds = [15, 9, 1];
  const featuredPrompts = featuredPromptIds
    .map((id) => prompts.find((prompt) => prompt.id === id))
    .filter((prompt): prompt is (typeof prompts)[number] => Boolean(prompt));

  const scrollToGallery = () => {
    galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToPromptCard = (promptId: number) => {
    const element = document.getElementById(`prompt-${promptId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFeaturedPromptClick = (promptId: number, promptCategory: string) => {
    setSearchQuery("");
    setActiveCategory(promptCategory);
    setTimeout(() => scrollToPromptCard(promptId), 200);
  };

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesCategory = activeCategory === "All" || prompt.category === activeCategory;
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      prompt.title.toLowerCase().includes(lowerQuery) ||
      prompt.slides.some((slide) => slide.prompt.toLowerCase().includes(lowerQuery));
    return matchesCategory && matchesSearch;
  });

  const feedbackFormUrl =
    import.meta.env.VITE_FEEDBACK_FORM_URL ||
    "https://docs.google.com/forms/d/e/1FAIpQLSc2Y-or9K-I6X-PFAHV-iLN2evZL_KqOAQzMd2FUJqwcQVgzQ/viewform?embedded=true";

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

        {featuredPrompts.length > 0 && (
          <section className="container mx-auto px-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-primary font-semibold">Social media drops</p>
                <h2 className="text-2xl font-bold">Trending prompt highlights</h2>
              </div>
              <Button
                variant="outline"
                className="hidden md:flex"
                onClick={() => {
                  const firstFeatured = featuredPrompts[0];
                  if (firstFeatured) {
                    handleFeaturedPromptClick(firstFeatured.id, firstFeatured.category);
                  } else {
                    scrollToGallery();
                  }
                }}
              >
                View all
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4">
              {featuredPrompts.map((prompt) => {
                const firstSlide = prompt.slides[0];
                return (
                  <article
                    key={prompt.id}
                    className="min-w-[260px] max-w-[260px] rounded-3xl border border-border/60 bg-card/80 backdrop-blur p-4 shrink-0"
                    onClick={() => handleFeaturedPromptClick(prompt.id, prompt.category)}
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-2xl mb-3">
                      <img
                        src={firstSlide.image}
                        alt={prompt.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      {prompt.category}
                    </p>
                    <h3 className="text-lg font-semibold mb-2">{prompt.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{firstSlide.prompt}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

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
                id={`prompt-${prompt.id}`}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <PromptCard
                  slides={prompt.slides}
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
      <button
        onClick={() => setIsFeedbackDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl bg-gradient-to-r from-primary to-accent hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        aria-label="Send feedback about ImgPrompt"
      >
        <MessageCircle className="w-4 h-4" />
        Feedback
      </button>
      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[720px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Share Feedback</DialogTitle>
            <DialogDescription>
              Tell us how we can improve ImgPrompt. Your thoughts go straight to our inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1">
            <iframe
              src={feedbackFormUrl}
              title="ImgPrompt feedback form"
              className="w-full h-full rounded-2xl border border-border"
              loading="lazy"
            />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Trouble with the form?{" "}
              <a
                href={feedbackFormUrl.replace("?embedded=true", "")}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                Open it in a new tab
              </a>
              .
            </p>
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

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGeneration } from "@/contexts/GenerationContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles, Send, Coins, Loader2, LogIn, Lightbulb,
  ImagePlus, X, Wand2, Maximize2, Minimize2, Download, Share2, RotateCcw, Shuffle, ChevronDown,
  MoreVertical, Copy, RefreshCw, Edit3, Palette, Settings, HelpCircle, History, BookmarkPlus, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import {
  canUseDevNoAuth,
  getCredits,
  generateImage,
  getSuggestions,
  createSession,
  listSessions,
  listMessages,
  refinePrompt,
  getChatInsights,
  getConversationContext,
  type MessageResponse,
  type SuggestResponse,
  type ChatInsightsResponse,
  type ConversationContextResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { PromptFrameworkBuilder } from "./PromptFrameworkBuilder";
import { PromptGuidePanel } from "./PromptGuidePanel";
import { PresetTags } from "./PresetTags";
import { StyleLibrary } from "./StyleLibrary";
import { CreditDisplay } from "./CreditDisplay";
import { validateImageRequirement, getImageRequirementMessage, shouldBlockGeneration } from "@/utils/promptValidation";

const PLACEHOLDER = "Describe the image you want to create...";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION_PX = 8000;

interface ImageChatProps {
  inline?: boolean;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
}

export function ImageChat({ inline = false, initialPrompt, onPromptConsumed }: ImageChatProps) {
  const { user, session, signInWithGoogle } = useAuth();
  const { generationState, startGeneration, stopGeneration, getElapsedTime } = useGeneration();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestResponse["suggestions"]>([]);
  const [attachedImage, setAttachedImage] = useState<{ file: File; preview: string } | null>(null);
  const [refining, setRefining] = useState(false);
  const [chatInsights, setChatInsights] = useState<ChatInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContextResponse | null>(null);
  const [inputFullscreen, setInputFullscreen] = useState(false);
  const [welcomeExpanded, setWelcomeExpanded] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [promptValidation, setPromptValidation] = useState<{ show: boolean; message: string; blocksGeneration: boolean }>({ show: false, message: '', blocksGeneration: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (attachedImage?.preview) URL.revokeObjectURL(attachedImage.preview);
    };
  }, [attachedImage?.preview]);

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    onPromptConsumed?.();
    if (inline) {
      setTimeout(() => {
        document.getElementById("ai-chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Lock body scroll in fullscreen
  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    };

    // Small delay to ensure content has rendered
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  // Validate prompt for image requirements
  useEffect(() => {
    if (!prompt.trim()) {
      setPromptValidation({ show: false, message: '', blocksGeneration: false });
      return;
    }

    const validation = validateImageRequirement(prompt);
    if (validation.requiresImage) {
      const hasImage = !!attachedImage;
      const blocksGeneration = shouldBlockGeneration(validation, hasImage);
      const message = getImageRequirementMessage(validation);
      
      setPromptValidation({
        show: true,
        message,
        blocksGeneration,
      });
    } else {
      setPromptValidation({ show: false, message: '', blocksGeneration: false });
    }
  }, [prompt, attachedImage]);

  // Debounce and fetch chat insights as user types
  useEffect(() => {
    if (!prompt.trim() || !session || !user) {
      setChatInsights(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        setInsightsLoading(true);
        const previousPrompts = messages
          .filter(m => m.role === "user")
          .map(m => m.content)
          .slice(-3);
        const insights = await getChatInsights(session.access_token, prompt, previousPrompts);
        setChatInsights(insights);
      } catch (e) {
        // Fail silently for insights
        setChatInsights(null);
      } finally {
        setInsightsLoading(false);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [prompt, session, user, messages]);

  // Fetch conversation context for smart suggestions (focus on last image + context)
  useEffect(() => {
    if (!session || !user || messages.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        // Get the last assistant message (last generated image) and some context around it
        const lastAssistantIdx = messages.findIndex((m, idx) => idx === messages.length - 1 - [...messages].reverse().findIndex(msg => msg.role === "assistant"));
        
        if (lastAssistantIdx === -1) return;
        
        // Include last assistant message + 2-3 messages before it for context
        const contextStart = Math.max(0, lastAssistantIdx - 2);
        const contextMessages = messages.slice(contextStart).map(m => ({
          role: m.role,
          content: m.content,
        }));
        
        const context = await getConversationContext(session.access_token, contextMessages);
        setConversationContext(context);
      } catch (e) {
        // Fail silently
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [messages, session, user]);

  const token = session?.access_token ?? null;
  const devNoAuth = canUseDevNoAuth();

  const refreshCredits = async () => {
    if (!token && !devNoAuth) return;
    try {
      const res = await getCredits(token);
      setCredits(res.credits);
    } catch {
      setCredits(0);
    }
  };

  const loadSuggestions = async () => {
    if (!token && !devNoAuth) return;
    try {
      const res = await getSuggestions(token, { limit: 5 });
      setSuggestions(res.suggestions);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    const canUse = user || devNoAuth;
    if ((!open && !inline) || !canUse) return;
    refreshCredits();
    loadSuggestions();
  }, [open, inline, user, devNoAuth]);

  // Restore last session on mount
  useEffect(() => {
    if (!token || sessionId) return;
    listSessions(token)
      .then((sessions) => {
        if (sessions.length > 0) {
          setSessionId(sessions[0].id);
        }
      })
      .catch(() => {});
  }, [token]);

  // Load messages whenever session is known and chat is visible
  useEffect(() => {
    const isVisible = open || inline;
    if (!isVisible || !token || !sessionId) {
      if (!inline) setMessages([]);
      return;
    }
    listMessages(token, sessionId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [open, inline, token, sessionId]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (!messages.length) return;
    const scrollToBottom = () => {
      const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };
    requestAnimationFrame(() => scrollToBottom());
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
  }, [messages]);

  const ensureSession = async (): Promise<string | null> => {
    if (!token && !devNoAuth) return null;
    if (sessionId) return sessionId;
    if (devNoAuth && !token) {
      const devSessionId = crypto.randomUUID();
      setSessionId(devSessionId);
      return devSessionId;
    }
    try {
      const s = await createSession(token!);
      setSessionId(s.id);
      return s.id;
    } catch {
      toast.error("Could not create chat session");
      return null;
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleRefine = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setRefining(true);
    try {
      const { refined } = await refinePrompt(token ?? null, trimmed);
      setPrompt(refined);
      toast.success("Prompt refined");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("503") || msg.toLowerCase().includes("not available") || msg.toLowerCase().includes("not configured")) {
        toast.error("Refinement not available — add GROQ_API_KEY to backend/.env");
      } else {
        toast.error("Refinement failed. Try again.");
      }
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateWithPrompt = async (customPrompt?: string, useImage?: boolean, imageUrl?: string) => {
    const promptToUse = (customPrompt ?? prompt).trim();
    const canGenerate = user || devNoAuth;
    if (!promptToUse || !canGenerate) {
      if (!canGenerate) { 
        setShowLoginPrompt(true);
        return; 
      }
      toast.error("Enter a prompt");
      return;
    }

    // Check if image is suggested but not required - warn but don't block
    const validation = validateImageRequirement(promptToUse);
    if (validation.requiresImage && !attachedImage) {
      // Show warning but allow to proceed - backend/Grok will handle it
      toast.info("Tip: This prompt works best with an uploaded image. Attach one for better results!", {
        duration: 4000,
      });
    }

    const sid = await ensureSession();
    if (!sid) return;

    setLoading(true);
    startGeneration(promptToUse, sid);
    
    // Use the specified image or attached image
    let imageToSend: File | null = null;
    let imageBase64: string | null = null;
    let userMessageAttachedUrl: string | null = null;

    if (useImage && imageUrl) {
      // Convert image URL to base64 for remix
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        imageToSend = new File([blob], 'remix-image.webp', { type: 'image/webp' });
        imageBase64 = await fileToBase64(imageToSend);
        userMessageAttachedUrl = imageUrl;
      } catch (error) {
        console.error('Failed to load image for remix:', error);
        toast.error("Could not load image for remix");
        setLoading(false);
        return;
      }
    } else if (attachedImage?.file) {
      imageToSend = attachedImage.file;
      imageBase64 = await fileToBase64(imageToSend);
      userMessageAttachedUrl = attachedImage.preview;
    }

    try {
      const res = await generateImage(token ?? null, {
        prompt: promptToUse,
        session_id: sid ?? undefined,
        image_base64: imageBase64 ?? undefined,
      });
      setCredits(res.credits_remaining);
      setMessages((prev) => [
        ...prev,
        {
          id: "",
          session_id: sid,
          role: "user",
          content: promptToUse,
          image_url: null,
          created_at: new Date().toISOString(),
          ...(userMessageAttachedUrl && { attached_image_url: userMessageAttachedUrl }),
        },
        {
          id: res.message_id ?? "",
          session_id: sid,
          role: "assistant",
          content: "",
          image_url: res.image_url,
          created_at: new Date().toISOString(),
        },
      ]);
      setPrompt("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      if (msg.toLowerCase().includes("safety filter blocked")) {
        toast.error("Replicate's safety filter blocked this prompt. Try changing the style to 'digital painting' or 'illustration' and rephrase descriptions of people.", { duration: 10000 });
      } else if (msg.toLowerCase().includes("replicate") && msg.toLowerCase().includes("billing")) {
        toast.error("Your Replicate account has no billing credit. Top up at replicate.com/account/billing, then try again.", { duration: 10000 });
      } else if (msg.includes("Insufficient credits") || msg.includes("402")) {
        toast.error("Not enough credits. You need 1 credit per image.");
      } else if (msg.toLowerCase().includes("high demand") || msg.includes("429")) {
        toast.error("We're experiencing high demand. Please wait a moment and try again.", { duration: 7000 });
      } else if (msg.toLowerCase().includes("timed out") || msg.includes("504")) {
        toast.error("Image generation timed out — Replicate was too slow. Please try again.", { duration: 7000 });
      } else if (msg.includes("502") || msg.toLowerCase().includes("bad gateway")) {
        toast.error("Image generation failed (Replicate error). Please try again in a moment.", { duration: 7000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      stopGeneration();
    }
  };

  const handleGenerate = () => {
    handleGenerateWithPrompt();
  };

  const applySuggestion = (text: string) => {
    setPrompt((p) => (p ? `${p} ${text}` : text));
  };

  const showSignInOnly = false; // Allow upload without login, check on send

  // ── Shared chat body (messages + input area) ──────────────────────────────
  const renderChatContent = () => (
    <>
      {/* Login Prompt Dialog */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <LogIn className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Sign in to Generate</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create an account to generate AI images and save your creations.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  onClick={() => { setShowLoginPrompt(false); signInWithGoogle(window.location.href); }} 
                  className="w-full gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in with Google
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowLoginPrompt(false)}
                  className="text-sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignInOnly ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4">
          <p className="text-muted-foreground">
            Sign in with Google to generate images with AI and use your credits.
          </p>
          <Button onClick={() => signInWithGoogle(window.location.href)} className="gap-2">
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </Button>
        </div>
      ) : (
        <>
            <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 p-4">
              <div className="space-y-3">
                {/* Welcome/Help message - Accordion */}
                {messages.length === 0 && (
                  <div className="space-y-2">
                    {/* Accordion Header */}
                    <button
                      onClick={() => setWelcomeExpanded(!welcomeExpanded)}
                      className="w-full rounded-xl border border-border/60 bg-blue-500/10 border-blue-500/20 p-4 flex items-center justify-between hover:bg-blue-500/15 transition-colors"
                    >
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        ✨ Welcome to VibeIMG AI Chat
                      </p>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform",
                          welcomeExpanded && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Accordion Content */}
                    {welcomeExpanded && (
                      <div className="rounded-xl border border-border/60 bg-blue-500/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <p className="text-xs text-muted-foreground">
                          Describe any image you'd like to generate. Be specific about style, mood, composition, and details. You can also:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-3">
                          <li>• Upload a reference image for img2img generation</li>
                          <li>• Use "Refine with AI" to enhance your prompt</li>
                          <li>• Download, share, or regenerate any image</li>
                          <li>• Use prompts from our community library</li>
                        </ul>
                      </div>
                    )}

                    {/* Suggestions Section */}
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        Try a prompt from our library
                      </p>
                      <div className="flex flex-col gap-2 w-full">
                        {suggestions.slice(0, 3).map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => applySuggestion(s.prompt_text)}
                            className="text-xs px-3 py-2 rounded-md bg-background border border-border hover:bg-primary/10 hover:border-primary/40 text-left transition-colors w-full"
                          >
                            <span className="font-medium text-primary">{s.title}</span>
                            <span className="block text-muted-foreground mt-0.5 line-clamp-2">{s.prompt_text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              {messages.map((m) => (
                <div
                  key={m.id || m.created_at}
                  className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl bg-primary/15 px-4 py-2 text-sm space-y-2">
                      {(m as MessageResponse & { attached_image_url?: string }).attached_image_url && (
                        <img
                          src={(m as MessageResponse & { attached_image_url?: string }).attached_image_url}
                          alt="Attached"
                          className="rounded-lg max-h-32 w-auto object-cover"
                        />
                      )}
                      {m.content}
                      <span className="text-[10px] text-muted-foreground/50">
                        {(() => {
                          const msgDate = new Date(m.created_at);
                          const today = new Date();
                          const isToday = msgDate.toDateString() === today.toDateString();
                          const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (isToday) return timeStr;
                          return `${msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
                        })()}
                      </span>
                    </div>
                    ) : (
                      <div className="max-w-[90%] space-y-2">
                        {m.image_url && (
                          <>
                            <a
                              href={m.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-colors"
                            >
                              <img src={m.image_url} alt="Generated" className="w-full h-auto object-cover" />
                            </a>
                            {/* Image utilities */}
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = m.image_url!;
                                  link.download = `vibeimg-${Date.now()}.webp`;
                                  link.click();
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-primary/10 text-xs font-medium transition-colors"
                                title="Download image"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Download</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.share) {
                                    navigator.share({
                                      title: "VibeIMG - Generated Image",
                                      text: m.content,
                                      url: m.image_url,
                                    }).catch(() => {});
                                  } else {
                                    navigator.clipboard.writeText(m.image_url!);
                                    toast.success("Image link copied!");
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-primary/10 text-xs font-medium transition-colors"
                                title="Share image"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Share</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGenerateWithPrompt(`${m.content}, different variation, remix`, true, m.image_url!)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-xs font-medium transition-colors border border-purple-500/30"
                                title="Generate a remix variation of this image"
                              >
                                <Shuffle className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Remix</span>
                              </button>
                            </div>
                          </>
                        )}
                        {/* Quick action suggestions - context-aware */}
                        {messages.length > 0 && messages.some(msg => msg.role === "user") && (
                          <div className="pt-2 border-t border-border/40 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Try next:</p>
                            <div className="flex flex-col gap-1.5">
                              {conversationContext?.next_variations && conversationContext.next_variations.length > 0 ? (
                                conversationContext.next_variations.slice(0, 2).map((variation, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleGenerateWithPrompt(`${m.content}, ${variation}`, true, m.image_url!)}
                                    className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors truncate"
                                    title={variation}
                                  >
                                    {variation}
                                  </button>
                                ))
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateWithPrompt(`${m.content}, different artistic style`, true, m.image_url!)}
                                    className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors"
                                  >
                                    Different artistic style
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateWithPrompt(`${m.content}, cinematic lighting`, true, m.image_url!)}
                                    className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors"
                                  >
                                    Cinematic version
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="bg-muted/40 rounded-2xl px-4 py-3 space-y-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Generating your image...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Mobile-Optimized Input Area */}
          <div className="border-t bg-muted/30 shrink-0 space-y-2 p-3 sm:p-4">
            {/* Attached Image Preview */}
            {attachedImage && (
              <div className="relative inline-block">
                <img
                  src={attachedImage.preview}
                  alt="Attached"
                  className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5 hover:bg-destructive/90 shadow-lg"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Input Row - Optimized for Mobile with Fullscreen on Focus */}
            {inputFullscreen && (
              <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-200">
                <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Write your prompt</h3>
                    <button
                      onClick={() => setInputFullscreen(false)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <Textarea
                    placeholder={PLACEHOLDER}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                    }}
                    className="flex-1 resize-none w-full text-base p-3"
                    disabled={loading}
                    autoFocus
                  />
                  <Button
                    onClick={() => {
                      setInputFullscreen(false);
                      handleGenerate();
                    }}
                    disabled={loading || !prompt.trim() || (!devNoAuth && credits !== null && credits < 1)}
                    className="w-full gap-2 h-12"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    <span>Generate</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end">
              {/* Input Field */}
              <div className="flex-1 space-y-1">
                <Textarea
                  placeholder={PLACEHOLDER}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                  }}
                  onClick={() => {
                    if (window.innerWidth < 640) {
                      setInputFullscreen(true);
                    }
                  }}
                  className="min-h-[64px] sm:min-h-[80px] resize-none w-full text-sm cursor-pointer sm:cursor-auto"
                  disabled={loading}
                  rows={2}
                />

                {/* Image Validation Alert */}
                {promptValidation.show && (
                  <Alert 
                    variant={promptValidation.blocksGeneration ? "destructive" : "default"}
                    className={`mt-2 ${promptValidation.blocksGeneration ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}
                  >
                    <AlertTriangle className={`h-4 w-4 ${promptValidation.blocksGeneration ? 'text-red-600' : 'text-amber-600'}`} />
                    <AlertDescription className={`text-xs ${promptValidation.blocksGeneration ? 'text-red-700' : 'text-amber-700'}`}>
                      {promptValidation.message}
                      {!attachedImage && !promptValidation.blocksGeneration && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="ml-2 underline font-medium hover:text-amber-800"
                        >
                          Upload an image
                        </button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Image Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || !file.type.startsWith("image/")) return;
                  if (file.size > MAX_IMAGE_BYTES) {
                    toast.error(`Image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB (got ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
                    e.target.value = "";
                    return;
                  }
                  const url = URL.createObjectURL(file);
                  const img = new Image();
                  img.onload = () => {
                    if (img.naturalWidth > MAX_IMAGE_DIMENSION_PX || img.naturalHeight > MAX_IMAGE_DIMENSION_PX) {
                      URL.revokeObjectURL(url);
                      toast.error(`Image dimensions must be at most ${MAX_IMAGE_DIMENSION_PX}px on each side (got ${img.naturalWidth}×${img.naturalHeight}).`);
                      return;
                    }
                    setAttachedImage((prev) => {
                      if (prev?.preview) URL.revokeObjectURL(prev.preview);
                      return { file, preview: url };
                    });
                    // Clear validation since image is now attached
                    setPromptValidation({ show: false, message: '', blocksGeneration: false });
                    toast.success("Image attached!");
                  };
                  img.onerror = () => { URL.revokeObjectURL(url); toast.error("Could not load image."); };
                  img.src = url;
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-[44px] sm:h-[56px] aspect-square"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload image"
              >
                <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              {/* Send Button */}
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || (!devNoAuth && credits !== null && credits < 1)}
                size="sm"
                className="shrink-0 h-[44px] sm:h-[56px] aspect-square bg-gradient-to-r from-primary to-accent hover:opacity-90"
                aria-label="Generate image"
              >
                {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
            </div>

            {/* Quick Actions - Only show when prompt is entered */}
            {prompt.trim() && (
              <div className="space-y-2">
                {/* AI Insights Badges */}
                {!insightsLoading && chatInsights && (
                  <div className="flex flex-wrap gap-1">
                    {chatInsights.should_refine && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 text-xs font-medium">
                        <Wand2 className="w-3 h-3" />
                        <span className="hidden xs:inline">Refinable</span>
                      </span>
                    )}
                    {chatInsights.is_variation && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-medium">
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden xs:inline">Variation</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Tool Buttons - Horizontal scroll on mobile */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs shrink-0"
                    onClick={handleRefine}
                    disabled={refining || loading}
                  >
                    {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">Refine</span>
                  </Button>
                  <PromptFrameworkBuilder
                    onPromptGenerated={(builtPrompt) => {
                      setPrompt(builtPrompt);
                      setTimeout(() => handleGenerate(), 200);
                    }}
                  />
                  <StyleLibrary
                    onStyleSelected={(styleId, triggerWord) => {
                      setPrompt((prev) => (prev ? `${prev}, ${triggerWord}` : triggerWord));
                    }}
                  />
                  <PromptGuidePanel />
                </div>
              </div>
            )}

            {/* Preset Tags */}
            {user && (
              <div className="px-4 py-3 border-t bg-muted/20">
                <PresetTags
                  onPresetSelected={(prompt) => {
                    setPrompt(prompt);
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  // ── Inline mode ──────────────────────────────────────────────────────────
  if (inline) {
    return (
      <>
        {/* Normal inline card */}
        <section
          id="ai-chat"
          className="container mx-auto px-4 py-12 scroll-mt-24"
          aria-label="AI Image Generator"
        >
          <div className="w-full max-w-5xl mx-auto rounded-3xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create with AI
                </h2>
                <div className="flex items-center gap-2">
                  {user && <CreditDisplay compact={true} />}
                  {devNoAuth && !user && (
                    <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                      Dev (no sign-in)
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFullscreen(true)}
                    aria-label="Expand to fullscreen"
                    title="Expand to fullscreen"
                    className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Body — responsive height */}
            <div className="flex flex-col h-[480px] sm:h-[580px] lg:h-[660px]">
              {renderChatContent()}
            </div>
          </div>
        </section>

        {/* ── Fullscreen overlay ── */}
        {fullscreen && (
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-xl animate-in fade-in zoom-in-[0.97] duration-200 ease-out"
            role="dialog"
            aria-modal="true"
            aria-label="AI Image Generator fullscreen"
          >
            {/* Top bar */}
            <div className="shrink-0 border-b border-border/50 bg-card/60 backdrop-blur-md px-4 sm:px-8 py-3.5">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create with AI
                </h2>
                <div className="flex items-center gap-3">
                  {(user || devNoAuth) && credits !== null && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      {credits} credits
                    </span>
                  )}
                  {devNoAuth && !user && (
                    <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                      Dev (no sign-in)
                    </span>
                  )}
                  <span className="hidden lg:inline text-xs text-muted-foreground/40 select-none">Esc to exit</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFullscreen(false)}
                    className="gap-1.5 rounded-full border-border/60 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                    aria-label="Exit fullscreen"
                  >
                    <Minimize2 className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Exit fullscreen</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Chat body */}
            <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-8 py-4">
              <div className="flex-1 min-h-0 rounded-2xl border border-border/40 bg-card/50 overflow-hidden flex flex-col shadow-lg">
                {renderChatContent()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Floating sheet (non-inline) ──────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 left-6 z-50 gap-2 rounded-full px-5 py-3 shadow-xl bg-gradient-to-r from-primary to-accent hover:scale-105 transition-transform"
          aria-label="Open AI Image Chat"
        >
          <Sparkles className="w-5 h-5" />
          <span className="hidden sm:inline">AI Image</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Image Chat
            </span>
            {(user || devNoAuth) && credits !== null && (
              <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                <Coins className="w-4 h-4" />
                {credits} credits
              </span>
            )}
            {devNoAuth && !user && (
              <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                Dev (no sign-in)
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        {renderChatContent()}
      </SheetContent>
    </Sheet>
  );
}

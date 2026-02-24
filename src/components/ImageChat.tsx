import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Coins, Loader2, LogIn, Lightbulb, ImagePlus, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  canUseDevNoAuth,
  getCredits,
  generateImage,
  getSuggestions,
  createSession,
  listMessages,
  refinePrompt,
  type MessageResponse,
  type SuggestResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "Describe the image you want to create...";

// Image limits (same as backend: 5MB, max 8000px per side, 1 image per request)
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION_PX = 8000;

interface ImageChatProps {
  /** When true, render chat inline in a section on the page (for homepage). When false, render as floating button + sheet. */
  inline?: boolean;
}

export function ImageChat({ inline = false }: ImageChatProps) {
  const { user, session, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [useLibraryStyle, setUseLibraryStyle] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestResponse["suggestions"]>([]);
  const [attachedImage, setAttachedImage] = useState<{ file: File; preview: string } | null>(null);
  const [refining, setRefining] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (attachedImage?.preview) URL.revokeObjectURL(attachedImage.preview);
    };
  }, [attachedImage?.preview]);

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

  useEffect(() => {
    if (!open || !token || !sessionId) {
      setMessages([]);
      return;
    }
    listMessages(token, sessionId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [open, token, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ensureSession = async (): Promise<string | null> => {
    if (!token && !devNoAuth) return null;
    if (sessionId) return sessionId;
    if (devNoAuth && !token) {
      // Use a client-side session ID so send works; backend won't persist for dev user.
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

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    const canGenerate = user || devNoAuth;
    if (!trimmed || !canGenerate) {
      if (!canGenerate) {
        toast.error("Sign in to generate images");
        return;
      }
      toast.error("Enter a prompt");
      return;
    }

    const sid = await ensureSession();
    if (!sid) return;

    setLoading(true);
    const imageToSend = attachedImage?.file ?? null;
    const imageBase64 = imageToSend ? await fileToBase64(imageToSend) : null;
    const userMessageAttachedUrl = attachedImage?.preview ?? null;

    try {
      const res = await generateImage(token ?? null, {
        prompt: trimmed,
        session_id: sid ?? undefined,
        use_library_style: useLibraryStyle,
        image_base64: imageBase64 ?? undefined,
      });
      setCredits(res.credits_remaining);
      setMessages((prev) => [
        ...prev,
        {
          id: "",
          session_id: sid,
          role: "user",
          content: trimmed,
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
      setAttachedImage(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      if (msg.toLowerCase().includes("replicate") && msg.toLowerCase().includes("billing")) {
        // Replicate account billing error
        toast.error(
          "Replicate account has no billing credit. Top up at replicate.com/account/billing, then try again.",
          { duration: 10000 }
        );
      } else if (msg.includes("Insufficient credits") || msg.includes("402")) {
        // App credits exhausted
        toast.error("Not enough credits. You need 1 credit per image.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (text: string) => {
    setPrompt((p) => (p ? `${p} ${text}` : text));
  };

  // Shared chat content (sign-in CTA or messages + input). In dev, allow use without sign-in.
  const showSignInOnly = !user && !devNoAuth;
  const chatContent = (
    <>
      {showSignInOnly ? (
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4">
            <p className="text-muted-foreground">
              Sign in with Google to generate images with AI and use your credits.
            </p>
            <Button
              onClick={() => signInWithGoogle(window.location.href)}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      Try a prompt from our library
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.slice(0, 3).map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => applySuggestion(s.prompt_text.slice(0, 80) + (s.prompt_text.length > 80 ? "…" : ""))}
                          className="text-xs px-2 py-1.5 rounded-md bg-background border border-border hover:bg-accent/50 truncate max-w-full"
                        >
                          {s.prompt_text.slice(0, 60)}…
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id || m.created_at}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
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
                      </div>
                    ) : (
                      <div className="max-w-[90%] space-y-1">
                        {m.image_url && (
                          <a
                            href={m.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border border-border"
                          >
                            <img
                              src={m.image_url}
                              alt="Generated"
                              className="w-full h-auto object-cover"
                            />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t space-y-2 shrink-0">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLibraryStyle}
                  onChange={(e) => setUseLibraryStyle(e.target.checked)}
                  className="rounded border-input"
                />
                Use style from prompt library
              </label>
              {attachedImage && (
                <div className="relative inline-block">
                  <img
                    src={attachedImage.preview}
                    alt="Attached"
                    className="h-16 w-16 object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5 hover:bg-destructive/90"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
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
                    };
                    img.onerror = () => {
                      URL.revokeObjectURL(url);
                      toast.error("Could not load image.");
                    };
                    img.src = url;
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-[80px] w-12"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload image"
                >
                  <ImagePlus className="w-5 h-5" />
                </Button>
                <div className="flex flex-col flex-1 gap-2">
                  <Textarea
                    placeholder={PLACEHOLDER}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    className="min-h-[80px] resize-none w-full"
                    disabled={loading}
                    rows={2}
                  />
                  {prompt.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start gap-1.5 h-7 text-xs"
                      onClick={handleRefine}
                      disabled={refining || loading}
                      aria-label="Refine prompt with AI"
                    >
                      {refining ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      {refining ? "Refining…" : "Refine with AI"}
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim() || (!devNoAuth && credits !== null && credits < 1)}
                  size="icon"
                  className="shrink-0 h-[80px] w-12"
                  aria-label="Generate image"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              {credits !== null && credits < 3 && credits > 0 && (
                <p className="text-xs text-amber-600">
                  {credits} credit{credits !== 1 ? "s" : ""} left. 1 credit per image.
                </p>
              )}
              {credits === 0 && (
                <p className="text-xs text-destructive">
                  No credits left. Contact support for more.
                </p>
              )}
            </div>
          </>
        )}
    </>
  );

  // Inline: visible section on homepage for first-time visitors
  if (inline) {
    return (
      <section
        id="ai-chat"
        className="container mx-auto px-4 py-12 scroll-mt-24"
        aria-label="AI Image Generator"
      >
        <div className="max-w-2xl mx-auto rounded-3xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border/60 bg-muted/20">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Create with AI
              </h2>
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
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {devNoAuth && !user
                ? "Describe an image and we’ll generate it with AI. (Dev mode: no sign-in required.)"
                : "Describe an image and we’ll generate it with AI. Sign in to get started."}
            </p>
          </div>
          <div className="flex flex-col min-h-[320px] h-[420px] max-h-[90vh]">
            {chatContent}
          </div>
        </div>
      </section>
    );
  }

  // Floating: sheet opened by button
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
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0"
      >
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
        {chatContent}
      </SheetContent>
    </Sheet>
  );
}

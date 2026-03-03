import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as React from "react";
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
  ImagePlus, X, Wand2, Maximize2, Minimize2, Download, Share2, RotateCcw, Shuffle, ChevronDown, ChevronUp,
  MoreVertical, Copy, RefreshCw, Edit3, Palette, Settings, HelpCircle, History, BookmarkPlus, AlertTriangle, Check, Plus, Menu, Shield
} from "lucide-react";
import { toast } from "sonner";
import heic2any from "heic2any";
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
  getThinkingSteps,
  getCreditHistory,
  syncCreditsFromStripe,
  claimDailyLoginCredit,
  claimShareCredit,
  claimCommunityCredit,
  deleteSession,
  type MessageResponse,
  type SuggestResponse,
  type ChatInsightsResponse,
  type ConversationContextResponse,
  type ThinkingStep,
  type CreditHistoryResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { PromptFrameworkBuilder } from "./PromptFrameworkBuilder";
import { PromptGuidePanel } from "./PromptGuidePanel";
import { PresetTags } from "./PresetTags";
import { StyleLibrary } from "./StyleLibrary";
import { CreditDisplay } from "./CreditDisplay";
import { ModelSelector } from "./ModelSelector";
import { ChatSidebar } from "./ChatSidebar";
import { CreditBadge } from "./CreditBadge";
import { GenerationCostLabel } from "./GenerationCostLabel";
import { GenerationRecapToast } from "./GenerationRecapToast";
import { validateImageRequirement, getImageRequirementMessage, shouldBlockGeneration } from "@/utils/promptValidation";

// Check if file is HEIC/HEIF format
const isHeicFile = (file: File): boolean => {
  const heicExtensions = ['.heic', '.heif'];
  const heicTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  const ext = file.name.toLowerCase();
  return heicTypes.includes(file.type.toLowerCase()) || 
         heicExtensions.some(e => ext.endsWith(e));
};

// Convert HEIC to JPEG
const convertHeicToJpeg = async (file: File): Promise<File> => {
  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    // heic2any returns a Blob or Blob[]
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Failed to convert iPhone image. Please save as JPEG first.');
  }
};

const PLACEHOLDER = "Describe the image you want to create...";

// Message item component that measures and reports its height
interface MessageItemProps {
  message: MessageResponse;
  index: number;
  isLast: boolean;
  conversationContext: ConversationContextResponse | null;
  onRemix: (customPrompt?: string, useImage?: boolean, imageUrl?: string) => Promise<void>;
  setItemSize: (index: number, size: number) => void;
}

const MessageItem = React.memo(({ message, index, isLast, conversationContext, onRemix, setItemSize }: MessageItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (ref.current) {
      const height = ref.current.getBoundingClientRect().height;
      setItemSize(index, height + 12); // +12 for padding
    }
  }, [index, setItemSize, message.content, message.image_url]);
  
  const m = message;
  
  return (
    <div
      ref={ref}
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
                  onClick={() => onRemix(`${m.content}, different variation, remix`, true, m.image_url!)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-xs font-medium transition-colors border border-purple-500/30"
                  title="Generate a remix variation of this image"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remix</span>
                </button>
              </div>
            </>
          )}
          {isLast && conversationContext?.next_variations && conversationContext.next_variations.length > 0 && (
            <div className="pt-2 border-t border-border/40 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try next:</p>
              <div className="flex flex-col gap-1.5">
                {conversationContext.next_variations.slice(0, 2).map((variation, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onRemix(`${m.content}, ${variation}`, true, m.image_url!)}
                    className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors truncate"
                    title={variation}
                  >
                    {variation}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isLast && (!conversationContext?.next_variations || conversationContext.next_variations.length === 0) && (
            <div className="pt-2 border-t border-border/40 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Try next:</p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onRemix(`${m.content}, different artistic style`, true, m.image_url!)}
                  className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors"
                >
                  Different artistic style
                </button>
                <button
                  type="button"
                  onClick={() => onRemix(`${m.content}, cinematic lighting`, true, m.image_url!)}
                  className="text-left px-2 py-1 rounded-md text-xs bg-muted/40 hover:bg-primary/10 text-muted-foreground transition-colors"
                >
                  Cinematic version
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION_PX = 8000;

interface ImageChatProps {
  inline?: boolean;
  initialPrompt?: string;
  initialImageUrl?: string;
  onPromptConsumed?: () => void;
}

export function ImageChat({ inline = false, initialPrompt, initialImageUrl, onPromptConsumed }: ImageChatProps) {
  const { user, session, signInWithGoogle, hasRole, profile } = useAuth();
  const { generationState, startGeneration, stopGeneration, getElapsedTime } = useGeneration();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Use Map for O(1) deduplication and efficient updates
  const [messagesMap, setMessagesMap] = useState<Map<string, MessageResponse>>(new Map());
  const messages = useMemo(() => {
    return Array.from(messagesMap.values()).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagesMap]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestResponse["suggestions"]>([]);
  const [attachedImage, setAttachedImage] = useState<{ file: File; preview: string } | null>(null);
  const [refining, setRefining] = useState(false);
  const [chatInsights, setChatInsights] = useState<ChatInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContextResponse | null>(null);
  const [welcomeExpanded, setWelcomeExpanded] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [promptValidation, setPromptValidation] = useState<{ show: boolean; message: string; blocksGeneration: boolean }>({ show: false, message: '', blocksGeneration: false });
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showThinking, setShowThinking] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("imagen-4-fast-generate-001");
  const [showRecapToast, setShowRecapToast] = useState(false);
  const [recapData, setRecapData] = useState({ cost: 1, remaining: 0, type: "standard" as const });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUtilitiesMenu, setShowUtilitiesMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{ id: string; title: string; timestamp: Date; messageCount: number }>>([]);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [generationSettings, setGenerationSettings] = useState({
    imageSize: "1024x1024" as "512x512" | "768x768" | "1024x1024" | "1024x576" | "576x1024",
    model: "imagen-4-fast-generate-001" as "replicate-flux" | "gemini-2.5-flash-image" | "gemini-3.1-flash-image-preview",
    quality: "standard" as "standard" | "hd",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea function
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (min 64px on mobile, 80px on desktop, max 200px)
    const minHeight = window.innerWidth < 640 ? 64 : 80;
    const maxHeight = 200;
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    
    textarea.style.height = `${newHeight}px`;
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);
  const sizeMap = useRef<Map<number, number>>(new Map());
  const scrollPositionRef = useRef<number>(0);
  const generatingRef = useRef<boolean>(false); // Synchronous lock to prevent race conditions
  
  // Get item size for virtualization (estimated, then measured)
  const getItemSize = useCallback((index: number) => {
    return sizeMap.current.get(index) || 200; // Default 200px
  }, []);
  
  // Update size when item renders
  const setItemSize = useCallback((index: number, size: number) => {
    if (sizeMap.current.get(index) !== size) {
      sizeMap.current.set(index, size);
      listRef.current?.resetAfterIndex(index);
    }
  }, []);

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
    // Auto-resize after setting initial prompt
    setTimeout(autoResizeTextarea, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Preserve scroll position when entering/exiting fullscreen
  useEffect(() => {
    if (fullscreen) {
      // Save current scroll position before entering fullscreen
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      // Prevent body scroll in fullscreen
      document.body.style.overflow = "hidden";
    } else {
      // Restore scroll position when exiting fullscreen
      document.body.style.overflow = "";
      window.scrollTo(0, scrollPositionRef.current);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  // Load sessions and credit history from backend (all logged-in users)
  useEffect(() => {
    if (!session) return;
    
    const loadSessionsAndHistory = async () => {
      try {
        const token = session?.access_token ?? null;
        
        // Load sessions
        const sessions = await listSessions(token);
        const formattedSessions = sessions.map(s => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.created_at),
          messageCount: 0, // Will be updated when messages are loaded
        }));
        setChatSessions(formattedSessions);
        console.log('Loaded sessions:', formattedSessions);
        
        // Load credit history
        const history = await getCreditHistory(token, 20);
        setCreditHistory(history.transactions || []);
        console.log('Loaded credit history:', history.transactions);
      } catch (err) {
        console.error('Failed to load sessions or credit history:', err);
      }
    };
    
    loadSessionsAndHistory();
  }, [session?.access_token]);

  // Sync selectedModel with generationSettings.model (bidirectional sync)
  useEffect(() => {
    // When generationSettings changes (from sidebar), update selectedModel
    if (generationSettings.model !== selectedModel) {
      setSelectedModel(generationSettings.model);
    }
  }, [generationSettings.model, selectedModel]);

  useEffect(() => {
    // When selectedModel changes (from dropdown), update generationSettings
    if (selectedModel !== generationSettings.model) {
      setGenerationSettings(prev => ({ ...prev, model: selectedModel as any }));
    }
  }, [selectedModel, generationSettings.model]);

  // Load initialImageUrl when provided (for Generate with AI workflow)
  useEffect(() => {
    if (!initialImageUrl || !initialImageUrl.startsWith('http')) {
      console.log('Skipping image load - invalid URL:', initialImageUrl);
      return;
    }
    
    console.log('Loading image from URL:', initialImageUrl.slice(0, 50));
    fetch(initialImageUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const file = new File([blob], 'reference-image.webp', { type: 'image/webp' });
        const preview = URL.createObjectURL(file);
        setAttachedImage({ file, preview });
        console.log('Image loaded successfully');
      })
      .catch(err => {
        console.error('Failed to load reference image:', err);
        // Don't crash - just log the error
      });
  }, [initialImageUrl]);

  // Animate thinking steps dynamically - progress through pending → active → complete
  useEffect(() => {
    if (thinkingSteps.length === 0 || !loading) return;

    // Start with all steps as pending
    const animatedSteps = thinkingSteps.map(s => ({ ...s, status: "pending" as const }));
    setThinkingSteps(animatedSteps);

    let currentIndex = 0;
    const interval = setInterval(() => {
      setThinkingSteps(prev => {
        if (currentIndex >= prev.length) {
          clearInterval(interval);
          return prev;
        }

        return prev.map((step, idx) => {
          if (idx < currentIndex) {
            // Previous steps are complete
            return { ...step, status: "complete" };
          } else if (idx === currentIndex) {
            // Current step is active
            return { ...step, status: "active" };
          }
          // Future steps are pending
          return { ...step, status: "pending" };
        });
      });

      currentIndex++;
      if (currentIndex > animatedSteps.length) {
        clearInterval(interval);
      }
    }, 1500); // 1.5 seconds per step

    return () => clearInterval(interval);
  }, [thinkingSteps.length, loading]);

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
    const hasImage = !!attachedImage;
    
    // Only show validation warning if NO image is attached
    if (validation.requiresImage && !hasImage) {
      const blocksGeneration = validation.isStronglyRequired;
      const message = getImageRequirementMessage(validation);
      
      setPromptValidation({
        show: true,
        message,
        blocksGeneration,
      });
    } else {
      // Clear validation if image is attached or no image required
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

  // Load messages with pagination - only get recent ones initially
  useEffect(() => {
    const isVisible = open || inline;
    if (!isVisible || !token || !sessionId) {
      if (!inline) {
        setMessagesMap(new Map());
        setHasMoreMessages(false);
      }
      return;
    }
    // Load only recent 20 messages initially (API returns newest first, reverse to get oldest first)
    listMessages(token, sessionId, { limit: 20 })
      .then((msgs) => {
        // Use Map for deduplication - convert array to Map
        const msgsMap = new Map<string, MessageResponse>();
        [...msgs].reverse().forEach(m => {
          const key = m.id || `${m.created_at}-${m.role}`;
          msgsMap.set(key, m);
        });
        setMessagesMap(msgsMap);
        // If we got 20 messages, there might be more
        setHasMoreMessages(msgs.length === 20);
      })
      .catch(() => {
        setMessagesMap(new Map());
        setHasMoreMessages(false);
      });
  }, [open, inline, token, sessionId]);

  // Load older messages when user clicks "View Older"
  const loadOlderMessages = async () => {
    if (!token || !sessionId || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      // Get the oldest message ID to load before it (oldest is at index 0)
      const oldestMessageId = messages[0]?.id;
      const olderMsgs = await listMessages(token, sessionId, { 
        limit: 20, 
        beforeId: oldestMessageId 
      });
      if (olderMsgs.length > 0) {
        // Prepend older messages to Map (reversed to maintain chronological order)
        setMessagesMap((prev) => {
          const next = new Map(prev);
          [...olderMsgs].reverse().forEach(m => {
            const key = m.id || `${m.created_at}-${m.role}`;
            next.set(key, m);
          });
          return next;
        });
        setHasMoreMessages(olderMsgs.length === 20);
      } else {
        setHasMoreMessages(false);
      }
    } catch {
      toast.error("Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  };

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
      console.log(`[fileToBase64] Starting with file: ${file.name}, size: ${file.size}, type: ${file.type}`);
      // Resize image to ensure dimensions divisible by 16 for Flux compatibility
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const PATCH_SIZE = 16;
        const origWidth = img.naturalWidth;
        const origHeight = img.naturalHeight;
        console.log(`[fileToBase64] Image loaded: ${origWidth}x${origHeight}`);
        const newWidth = Math.floor(origWidth / PATCH_SIZE) * PATCH_SIZE;
        const newHeight = Math.floor(origHeight / PATCH_SIZE) * PATCH_SIZE;
        
        if (newWidth !== origWidth || newHeight !== origHeight) {
          console.log(`[fileToBase64] RESIZING: ${origWidth}x${origHeight} -> ${newWidth}x${newHeight}`);
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            console.log(`[fileToBase64] Resized blob size: ${blob.size}`);
            const reader = new FileReader();
            reader.onload = () => {
              console.log(`[fileToBase64] Done - output base64 length: ${(reader.result as string).length}`);
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }, 'image/webp', 0.95);
        } else {
          console.log(`[fileToBase64] NO resize needed, using original`);
          const reader = new FileReader();
          reader.onload = () => {
            console.log(`[fileToBase64] Done - output base64 length: ${(reader.result as string).length}`);
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for resize'));
      };
      img.src = url;
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
    // Prevent parallel generation requests using synchronous ref (no stale closure issues)
    if (generatingRef.current) {
      console.log('[GENERATE] Already generating, ignoring duplicate request');
      return;
    }
    generatingRef.current = true;
    
    const promptToUse = (customPrompt ?? prompt).trim();
    const canGenerate = user || devNoAuth;
    if (!promptToUse || !canGenerate) {
      generatingRef.current = false;
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
    if (!sid) {
      generatingRef.current = false;
      return;
    }

    // Optimistically update session title from prompt (Bug 3 fix)
    if (promptToUse && promptToUse !== "New chat") {
      const newTitle = promptToUse.slice(0, 50) + (promptToUse.length > 50 ? "..." : "");
      setChatSessions(prev => prev.map(s => 
        s.id === sid && s.title === "New chat" 
          ? { ...s, title: newTitle } 
          : s
      ));
    }

    setLoading(true);
    
    // Clear validation immediately since we're proceeding with generation
    setPromptValidation({ show: false, message: '', blocksGeneration: false });
    
    // Capture and immediately clear the attached image to prevent stale data
    const currentAttachedImage = attachedImage;
    if (attachedImage) {
      setAttachedImage(null); // Clear immediately so subsequent calls don't reuse it
    }
    
    startGeneration(promptToUse, sid);
    
    // Use the captured image reference (not the state which may have changed)
    let imageToSend: File | null = null;
    let imageBase64: string | null = null;
    let userMessageAttachedUrl: string | null = null;

    if (useImage && imageUrl) {
      // Convert image URL to base64 for remix
      try {
        console.log('[REMIX] Fetching image from URL:', imageUrl.slice(0, 50));
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        console.log('[REMIX] Fetched blob size:', blob.size, 'type:', blob.type);
        imageToSend = new File([blob], 'remix-image.webp', { type: 'image/webp' });
        imageBase64 = await fileToBase64(imageToSend);
        userMessageAttachedUrl = imageUrl;
      } catch (error) {
        console.error('[REMIX] Failed to load image for remix:', error);
        toast.error("Could not load image for remix");
        setLoading(false);
        generatingRef.current = false;
        return;
      }
    } else if (currentAttachedImage?.file) {
      console.log('[UPLOAD] Using captured file:', currentAttachedImage.file.name, 'size:', currentAttachedImage.file.size);
      imageToSend = currentAttachedImage.file;
      imageBase64 = await fileToBase64(imageToSend);
      userMessageAttachedUrl = currentAttachedImage.preview;
    }
    
    // Fetch thinking steps to show reasoning (after image is processed)
    try {
      const steps = await getThinkingSteps(token ?? null, {
        prompt: promptToUse,
        has_uploaded_image: !!imageBase64,
        is_img2img: !!imageBase64,
      });
      setThinkingSteps(steps);
      setShowThinking(true);
    } catch {
      // Silently fail - thinking is optional
      setThinkingSteps([]);
    }

    try {
      const res = await generateImage(token ?? null, {
        prompt: promptToUse,
        session_id: sid ?? undefined,
        image_base64: imageBase64 ?? undefined,
        model: selectedModel,
      });
      setCredits(res.credits_remaining);
      
      // Show recap toast
      setRecapData({
        cost: 1,
        remaining: res.credits_remaining,
        type: "standard",
      });
      setShowRecapToast(true);
      
      // Generate unique temp IDs for optimistic updates to avoid key collisions
      const tempUserId = `temp-user-${Date.now()}`;
      const tempAsstId = `temp-asst-${Date.now()}`;
      setMessagesMap((prev) => {
        const next = new Map(prev);
        next.set(tempUserId, {
          id: tempUserId,
          session_id: sid,
          role: "user",
          content: promptToUse,
          image_url: null,
          created_at: new Date().toISOString(),
          ...(userMessageAttachedUrl && { attached_image_url: userMessageAttachedUrl }),
        });
        next.set(tempAsstId, {
          id: res.message_id || tempAsstId,
          session_id: sid,
          role: "assistant",
          content: "",
          image_url: res.image_url,
          created_at: new Date().toISOString(),
        });
        return next;
      });
      setPrompt("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      if (msg.toLowerCase().includes("safety filter blocked")) {
        toast.error("Replicate's safety filter blocked this prompt. Try changing the style to 'digital painting' or 'illustration' and rephrase descriptions of people.", { duration: 10000 });
      } else if (msg.toLowerCase().includes("replicate") && msg.toLowerCase().includes("billing")) {
        toast.error("Your Replicate account has no billing credit. Top up at replicate.com/account/billing, then try again.", { duration: 10000 });
      } else if (msg.includes("Insufficient credits") || msg.includes("402") || msg.toLowerCase().includes("credit deduction failed")) {
        toast.error("Credit deduction failed. Please refresh the page and try again.");
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
      generatingRef.current = false; // Release the synchronous lock
    }
  };

  const handleGenerate = () => {
    handleGenerateWithPrompt();
  };

  const handleSyncCredits = async () => {
    if (!token) return;
    const result = await syncCreditsFromStripe(token);
    setCredits(result.credits);
  };

  const handleClaimDaily = async () => {
    if (!token) throw new Error("Not authenticated");
    const result = await claimDailyLoginCredit(token);
    if (result.success) {
      setCredits(result.new_balance);
    } else {
      throw new Error(result.message || "Already claimed today");
    }
  };

  const handleClaimShare = async () => {
    if (!token) throw new Error("Not authenticated");
    const result = await claimShareCredit(token);
    if (result.success) {
      setCredits(result.new_balance);
    } else {
      throw new Error(result.message || "Failed to claim share credit");
    }
  };

  const handleClaimCommunity = async () => {
    if (!token) throw new Error("Not authenticated");
    const result = await claimCommunityCredit(token);
    if (result.success) {
      setCredits(result.new_balance);
    } else {
      throw new Error(result.message || "Failed to claim community credit");
    }
  };

  const applySuggestion = (text: string) => {
    const newPrompt = prompt ? `${prompt} ${text}` : text;
    setPrompt(newPrompt);
    setTimeout(autoResizeTextarea, 0);
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

              {/* View Older Messages Button */}
              {hasMoreMessages && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={loadingOlder}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    {loadingOlder ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <ChevronUp className="w-3 h-3 mr-1" />
                    )}
                    View older messages
                  </Button>
                </div>
              )}

              {/* Messages - chronological (oldest first, newest at bottom like ChatGPT) */}
              {messages.length > 0 && messages.map((m, index) => (
                <div
                  key={m.id ? `${m.id}-${index}` : `${m.created_at}-${m.role}-${index}`}
                  className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl bg-primary/15 px-4 py-2 text-sm space-y-2">
                      {(m as MessageResponse & { attached_image_url?: string }).attached_image_url && (
                        <img
                          src={(m as MessageResponse & { attached_image_url?: string }).attached_image_url}
                          alt="Attached"
                          className="rounded-lg max-h-32 w-auto object-cover"
                          onError={(e) => {
                            console.error('Failed to load attached image:', e);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
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
                  <div className="bg-muted/40 rounded-2xl px-4 py-3 space-y-3 max-w-[90%]">
                    {/* Thinking Header */}
                    <button
                      onClick={() => setShowThinking(!showThinking)}
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generating your image...</span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform", showThinking && "rotate-180")} />
                    </button>
                    
                    {/* Thinking Steps */}
                    {showThinking && thinkingSteps.length > 0 && (
                      <div className="space-y-2 border-t border-border/50 pt-2">
                        {thinkingSteps.map((step, idx) => (
                          <div key={step.id} className="flex items-start gap-2">
                            <div className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                              step.status === "complete" && "bg-green-500/20 text-green-600",
                              step.status === "active" && "bg-primary/20 text-primary animate-pulse",
                              step.status === "pending" && "bg-muted text-muted-foreground"
                            )}>
                              {step.status === "complete" ? (
                                <Check className="w-2.5 h-2.5" />
                              ) : step.status === "active" ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-medium",
                                step.status === "complete" && "text-muted-foreground",
                                step.status === "active" && "text-primary",
                                step.status === "pending" && "text-muted-foreground/50"
                              )}>
                                {step.title}
                              </p>
                              {step.status !== "pending" && (
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">
                                  {step.content}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Simple Loading Animation */}
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Mobile-Optimized Input Area */}
          <div className="border-t bg-muted/30 shrink-0 space-y-2 p-3 sm:p-4">
            {/* Attached Image Preview */}
            {(() => {
              console.log('[DEBUG] attachedImage state:', attachedImage);
              return attachedImage && (
                <div className="relative inline-block">
                  <img
                    src={attachedImage.preview}
                    alt="Attached"
                    className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      console.error('[DEBUG] Failed to load attached image preview:', e);
                    }}
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
              );
            })()}

            {/* Input Row - Auto-resizing Textarea */}
            <div className="flex gap-2 items-end">
              {/* + Button for Mobile Utilities Menu */}
              <div className="relative shrink-0 sm:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUtilitiesMenu(!showUtilitiesMenu)}
                  className="h-[44px] aspect-square rounded-full border-dashed border-2"
                  aria-label="Open utilities menu"
                >
                  <Plus className="w-5 h-5" />
                </Button>
                
                {/* Utilities Popover Menu - Mobile Only */}
                {showUtilitiesMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUtilitiesMenu(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border border-border bg-card shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Tools</p>
                      
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowUtilitiesMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <ImagePlus className="w-4 h-4 text-primary" />
                        <span className="text-sm">Upload Image</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          handleRefine();
                          setShowUtilitiesMenu(false);
                        }}
                        disabled={refining || loading || !prompt.trim()}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                      >
                        <Wand2 className="w-4 h-4 text-purple-500" />
                        <span className="text-sm">Refine Prompt</span>
                      </button>
                      
                      <div className="border-t border-border my-1" />
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Library</p>
                      
                      <button
                        onClick={() => {
                          setShowTools(true);
                          setShowUtilitiesMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <Palette className="w-4 h-4 text-pink-500" />
                        <span className="text-sm">Style Library</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setWelcomeExpanded(true);
                          setShowUtilitiesMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">Prompt Guide</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Input Field */}
              <div className="flex-1 space-y-1">
                <Textarea
                  ref={textareaRef}
                  placeholder={PLACEHOLDER}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    setTimeout(autoResizeTextarea, 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                  }}
                  className="min-h-[64px] sm:min-h-[80px] max-h-[200px] resize-none w-full text-sm overflow-y-auto"
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
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  let processedFile = file;
                  
                  // Check if it's a HEIC/HEIF file and convert it
                  if (isHeicFile(file)) {
                    try {
                      toast.loading("Converting iPhone image...", { id: "heic-convert" });
                      processedFile = await convertHeicToJpeg(file);
                      toast.success("Image converted!", { id: "heic-convert" });
                    } catch (err) {
                      toast.error("Failed to convert iPhone image. Please save as JPEG first.", { id: "heic-convert" });
                      e.target.value = "";
                      return;
                    }
                  }
                  
                  // Check for supported formats (after conversion)
                  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                  const isSupported = supportedTypes.some(type => 
                    processedFile.type.toLowerCase().startsWith(type) || 
                    processedFile.name.toLowerCase().endsWith(type.replace('image/', ''))
                  );
                  
                  if (!isSupported) {
                    toast.error(`Format not supported: ${processedFile.type || processedFile.name.split('.').pop()?.toUpperCase()}. Please use JPEG, PNG, WebP, or GIF.`);
                    e.target.value = "";
                    return;
                  }
                  
                  if (processedFile.size > MAX_IMAGE_BYTES) {
                    toast.error(`Image must be under ${MAX_IMAGE_BYTES / (1024 * 1024)}MB (got ${(processedFile.size / (1024 * 1024)).toFixed(1)}MB).`);
                    e.target.value = "";
                    return;
                  }
                  const url = URL.createObjectURL(processedFile);
                  console.log('[DEBUG] Created blob URL:', url);
                  const img = new Image();
                  img.onload = () => {
                    console.log('[DEBUG] Image loaded successfully:', img.naturalWidth, 'x', img.naturalHeight);
                    if (img.naturalWidth > MAX_IMAGE_DIMENSION_PX || img.naturalHeight > MAX_IMAGE_DIMENSION_PX) {
                      URL.revokeObjectURL(url);
                      toast.error(`Image dimensions must be at most ${MAX_IMAGE_DIMENSION_PX}px on each side (got ${img.naturalWidth}×${img.naturalHeight}).`);
                      return;
                    }
                    console.log('[DEBUG] Setting attachedImage state');
                    setAttachedImage((prev) => {
                      if (prev?.preview) URL.revokeObjectURL(prev.preview);
                      return { file: processedFile, preview: url };
                    });
                    // Force immediate validation clear to prevent race condition
                    requestAnimationFrame(() => {
                      setPromptValidation({ show: false, message: '', blocksGeneration: false });
                    });
                    toast.success("Image attached!");
                  };
                  img.onerror = () => { 
                    console.error('[DEBUG] Failed to load image');
                    URL.revokeObjectURL(url); 
                    toast.error("Could not load image. Please try JPEG or PNG format.");
                    e.target.value = "";
                  };
                  img.src = url;
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-[44px] sm:h-[56px] aspect-square"
                onClick={() => {
                  console.log('Upload button clicked, fileInputRef:', fileInputRef.current);
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  } else {
                    console.error('fileInputRef is null!');
                    toast.error('Upload not ready, please try again');
                  }
                }}
                aria-label="Upload image"
              >
                <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              {/* Send Button */}
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || (!devNoAuth && credits !== null && credits < 1)}
                size="sm"
                className="shrink-0 h-[44px] sm:h-[56px] gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                aria-label="Generate image"
              >
                {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                <GenerationCostLabel cost={1} userBalance={credits} className="hidden sm:flex" />
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
                  <ModelSelector
                    token={token}
                    selectedModel={selectedModel}
                    onSelectModel={setSelectedModel}
                    disabled={loading}
                  />
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
                  {/* Menu button for all users - opens ChatSidebar */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors -ml-2"
                    title="Menu"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create with AI
                </h2>
                <div className="flex items-center gap-2">
                  {/* Admin Menu */}
                  {isAdmin && (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowAdminMenu(!showAdminMenu)}
                        className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Admin Menu"
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                      {showAdminMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowAdminMenu(false)}
                          />
                          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-card shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Admin</p>
                            <a
                              href="/admin"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Dashboard</span>
                            </a>
                            <a
                              href="/admin/prompts"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Prompts</span>
                            </a>
                            <a
                              href="/admin/categories"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Categories</span>
                            </a>
                            <a
                              href="/admin/platforms"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Platforms</span>
                            </a>
                            <a
                              href="/admin/users"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Users</span>
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <CreditBadge
                    balance={credits}
                    isLow={credits !== null && credits < 2}
                    isAdmin={isAdmin}
                    onSyncCredits={handleSyncCredits}
                    onClaimDaily={handleClaimDaily}
                    onClaimShare={handleClaimShare}
                    onClaimCommunity={handleClaimCommunity}
                  />
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
            onClick={(e) => {
              // Close fullscreen when clicking outside the chat content area
              if (e.target === e.currentTarget) {
                setFullscreen(false);
              }
            }}
          >
            {/* Top bar */}
            <div className="shrink-0 border-b border-border/50 bg-card/60 backdrop-blur-md px-4 sm:px-8 py-3.5">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  {/* Menu button for all users - opens ChatSidebar */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors -ml-2"
                    title="Menu"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create with AI
                </h2>
                <div className="flex items-center gap-3">
                  {/* Admin Menu */}
                  {isAdmin && (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowAdminMenu(!showAdminMenu)}
                        className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Admin Menu"
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                      {showAdminMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowAdminMenu(false)}
                          />
                          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-card shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Admin</p>
                            <a
                              href="/admin"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Dashboard</span>
                            </a>
                            <a
                              href="/admin/prompts"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Prompts</span>
                            </a>
                            <a
                              href="/admin/categories"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Categories</span>
                            </a>
                            <a
                              href="/admin/platforms"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Platforms</span>
                            </a>
                            <a
                              href="/admin/users"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left text-sm"
                            >
                              <span>Users</span>
                            </a>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <CreditBadge
                    balance={credits}
                    isLow={credits !== null && credits < 2}
                    isAdmin={isAdmin}
                    onSyncCredits={handleSyncCredits}
                    onClaimDaily={handleClaimDaily}
                    onClaimShare={handleClaimShare}
                    onClaimCommunity={handleClaimCommunity}
                  />
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
              <div 
                className="flex-1 min-h-0 rounded-2xl border border-border/40 bg-card/50 overflow-hidden flex flex-col shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {renderChatContent()}
              </div>
            </div>
          </div>
        )}
        
        {/* Recap Toast */}
        <GenerationRecapToast
          isVisible={showRecapToast}
          creditsCost={recapData.cost}
          creditsRemaining={recapData.remaining}
          generationType={recapData.type}
          onClose={() => setShowRecapToast(false)}
        />

        {/* Sidebar Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="flex flex-col w-full sm:max-w-xs p-0">
            <ChatSidebar
              sessions={chatSessions}
              currentSessionId={sessionId}
              settings={generationSettings}
              onNewChat={() => {
                setSessionId(null);
                setMessagesMap(new Map());
                setPrompt("");
                setSidebarOpen(false);
              }}
              onSelectSession={(id) => {
                setSessionId(id);
                setSidebarOpen(false);
              }}
              onDeleteSession={async (id) => {
                try {
                  // Only delete from backend if user is logged in (has token)
                  // Dev mode sessions only exist in frontend state
                  if (token) {
                    await deleteSession(token, id);
                  }
                  setChatSessions(chatSessions.filter(s => s.id !== id));
                  if (sessionId === id) {
                    setSessionId(null);
                    setMessagesMap(new Map());
                  }
                  toast.success("Chat deleted");
                } catch (err) {
                  console.error('Failed to delete session:', err);
                  toast.error("Failed to delete chat");
                }
              }}
              onSettingsChange={(settings) => setGenerationSettings(settings)}
              credits={credits}
            />
          </SheetContent>
        </Sheet>
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

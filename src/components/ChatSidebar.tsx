import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  History,
  Settings,
  ChevronDown,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}

interface GenerationSettings {
  imageSize: "512x512" | "768x768" | "1024x1024" | "1024x576" | "576x1024";
  model: "replicate-flux" | "gemini-2.5-flash-image" | "gemini-3.1-flash-image-preview";
  quality: "standard" | "hd";
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  settings: GenerationSettings;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onSettingsChange: (settings: GenerationSettings) => void;
  credits: number | null;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  settings,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onSettingsChange,
  credits,
}: ChatSidebarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">VibeIMG</h2>
            </div>

          {/* Credits Display */}
          {credits !== null && (
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Available Credits</p>
              <p className="text-2xl font-bold text-primary">{credits.toFixed(1)}</p>
            </div>
          )}

          {/* New Chat Button */}
          <Button
            onClick={() => {
              onNewChat();
            }}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Settings Section */}
        <div className="px-4 py-3 border-b border-border">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Generation Settings
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showSettings && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {/* Image Size */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Image Size
                  </label>
                  <select
                    value={settings.imageSize}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        imageSize: e.target.value as GenerationSettings["imageSize"],
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-sm"
                  >
                    <option value="512x512">512×512</option>
                    <option value="768x768">768×768</option>
                    <option value="1024x1024">1024×1024</option>
                    <option value="1024x576">1024×576 (Wide)</option>
                    <option value="576x1024">576×1024 (Tall)</option>
                  </select>
                </div>

                {/* Model Selection */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Model
                  </label>
                  <select
                    value={settings.model}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        model: e.target.value as GenerationSettings["model"],
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-md bg-muted border border-border text-sm"
                  >
                    <option value="replicate-flux">Flux 1.1 Ultra</option>
                    <option value="imagen-3.0-fast-generate-001">Imagen 3.0 Fast</option>
                    <option value="imagen-3.0-generate-001">Imagen 3.0</option>
                    <option value="imagen-3.0-ultra-generate-001">Imagen 3.0 Ultra</option>
                    <option value="gemini-2.5-flash-image">Nano Banana (Flash)</option>
                  </select>
                </div>

                {/* Quality */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-2">
                    Quality
                  </label>
                  <div className="flex gap-2">
                    {["standard", "hd"].map((q) => (
                      <button
                        key={q}
                        onClick={() =>
                          onSettingsChange({
                            ...settings,
                            quality: q as "standard" | "hd",
                          })
                        }
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                          settings.quality === q
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        )}
                      >
                        {q === "standard" ? "Standard" : "HD"}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat History */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-3 flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Chat History
          </div>

          <ScrollArea className="flex-1">
            <div className="px-2 space-y-1">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No chats yet. Start a new one!
                </p>
              ) : (
                sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="group relative"
                  >
                    <button
                      onClick={() => {
                        onSelectSession(session.id);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 pr-8 rounded-lg text-sm transition-colors",
                        "hover:bg-muted/50 flex items-center gap-2",
                        currentSessionId === session.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium" title={session.title}>
                          {session.title.length > 35 ? session.title.slice(0, 35) + "..." : session.title}
                        </p>
                      </div>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive hover:text-destructive/80" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border text-xs text-muted-foreground text-center">
          <p>VibeIMG © 2026</p>
        </div>
    </div>
  );
}

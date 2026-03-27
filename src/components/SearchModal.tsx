import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { searchGenerations, type SearchResult } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, X, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchModalProps {
  token: string | null;
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ token, open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !token) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenerations(token, query.trim());
        setResults(res);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, token]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl mx-4 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          {searching ? (
            <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <Input
            ref={inputRef}
            placeholder="Search your generated images…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 p-0 text-base h-auto bg-transparent"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <p className="text-center text-muted-foreground text-sm py-10">
              Type to semantically search your images
            </p>
          )}

          {query && !searching && searched && results.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">
              No images found for "{query}"
            </p>
          )}

          {results.length > 0 && (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground px-1">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="group relative rounded-xl overflow-hidden border border-border/40 hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => {
                      window.open(r.image_url, "_blank");
                    }}
                  >
                    <img
                      src={r.image_url}
                      alt={r.prompt}
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 gap-1.5">
                      <p className="text-white text-[11px] line-clamp-3 leading-snug">{r.prompt}</p>
                      <span className="flex items-center gap-1 text-white/70 text-[10px]">
                        <ExternalLink className="w-2.5 h-2.5" />
                        Open full size
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { onClose(); navigate(`/creations`); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary py-2 transition-colors"
              >
                See all in My Creations →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

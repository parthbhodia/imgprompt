import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/30 py-6 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>for the community</span>
          </p>
          <p className="text-xs text-muted-foreground/70">
            ℹ️ This service operates at cost. We don't make any profit — all revenue goes directly to API costs and infrastructure.
          </p>
        </div>
      </div>
    </footer>
  );
}

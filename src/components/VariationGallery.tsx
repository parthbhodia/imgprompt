import { Download } from "lucide-react";

interface VariationGalleryProps {
  urls: string[];
  /** Called when user clicks a variation image */
  onSelect?: (url: string) => void;
}

/**
 * 2×2 thumbnail grid for image variation results.
 * Shows up to 4 images. Each has a download button on hover.
 */
export function VariationGallery({ urls, onSelect }: VariationGalleryProps) {
  const shown = urls.slice(0, 4);

  const handleDownload = (e: React.MouseEvent, url: string, idx: number) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = url;
    link.download = `vibeimg-v${idx + 1}-${Date.now()}.webp`;
    link.click();
  };

  return (
    <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm">
      {shown.map((url, i) => (
        <div
          key={i}
          className="relative aspect-square rounded-xl overflow-hidden border border-border hover:border-primary/50 cursor-pointer group transition-all hover:shadow-md"
          onClick={() => onSelect?.(url)}
          title={`Variation ${i + 1} — click to open full size`}
        >
          <img
            src={url}
            alt={`Variation ${i + 1}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />

          {/* Variation badge */}
          <div className="absolute top-1.5 left-1.5 pointer-events-none">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white/90 font-semibold">
              V{i + 1}
            </span>
          </div>

          {/* Download button */}
          <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => handleDownload(e, url, i)}
              className="p-1 rounded-md bg-black/70 text-white hover:bg-black/90 transition-colors"
              title="Download this variation"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

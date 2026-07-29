import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase, uploadImage } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Save,
  ArrowLeft,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
}
interface Platform {
  id: number;
  name: string;
}
interface PackOption {
  id: number;
  name: string;
  slug: string;
}
interface SlideForm {
  id?: number;
  prompt_text: string;
  prompt_preview?: string;
  image_url: string;
  before_image_url?: string;
  sort_order: number;
  _file?: File;
  _preview?: string;
  _beforeFile?: File;
  _beforePreview?: string;
}

const slugify = (val: string) =>
  val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const makePreview = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}...`;
};

const AdminPromptForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [featured, setFeatured] = useState(false);
  const [isPremium, setIsPremium] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [selectedPacks, setSelectedPacks] = useState<number[]>([]);
  const [slides, setSlides] = useState<SlideForm[]>([
    { prompt_text: "", prompt_preview: "", image_url: "", before_image_url: "", sort_order: 0 },
  ]);

  // Options
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [packs, setPacks] = useState<PackOption[]>([]);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const beforeFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSlug = useRef(true);

  // Load categories + platforms + packs
  useEffect(() => {
    const load = async () => {
      const [catRes, platRes, packRes] = await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("platforms").select("id, name").order("name"),
        supabase.from("packs").select("id, name, slug").order("sort_order"),
      ]);
      setCategories((catRes.data ?? []) as Category[]);
      setPlatforms((platRes.data ?? []) as Platform[]);
      setPacks((packRes.data ?? []) as PackOption[]);
    };
    load();
  }, []);

  // Load existing prompt for edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("prompts")
        .select(
          `*, slides(*), prompt_platforms(platform_id), prompt_packs(pack_id)`
        )
        .eq("id", Number(id))
        .single();
      if (error || !data) {
        toast.error("Prompt not found");
        navigate("/admin/prompts");
        return;
      }
      setTitle(data.title);
      setSlug(data.slug);
      setFeatured(data.featured);
      setIsPremium(data.is_premium !== false);
      setCategoryId(data.category_id ? String(data.category_id) : "");
      setSelectedPlatforms(
        (data.prompt_platforms as { platform_id: number }[]).map(
          (pp) => pp.platform_id
        )
      );
      setSelectedPacks(
        ((data.prompt_packs as { pack_id: number }[]) || []).map(
          (pp) => pp.pack_id
        )
      );
      const sorted = [...(data.slides as SlideForm[])].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      setSlides(
        sorted.length > 0
          ? sorted
          : [{ prompt_text: "", prompt_preview: "", image_url: "", before_image_url: "", sort_order: 0 }]
      );
      autoSlug.current = false;
      setLoading(false);
    };
    load();
  }, [id, isEdit, navigate]);

  // Auto-generate slug from title
  useEffect(() => {
    if (autoSlug.current && !isEdit) {
      setSlug(slugify(title));
    }
  }, [title, isEdit]);

  const togglePlatform = (platformId: number) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const togglePack = (packId: number) => {
    setSelectedPacks((prev) =>
      prev.includes(packId)
        ? prev.filter((p) => p !== packId)
        : [...prev, packId]
    );
  };

  // Slide operations
  const addSlide = () => {
    setSlides((prev) => [
      ...prev,
      { prompt_text: "", prompt_preview: "", image_url: "", before_image_url: "", sort_order: prev.length },
    ]);
  };

  const removeSlide = (idx: number) => {
    setSlides((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, sort_order: i }))
    );
  };

  const moveSlide = (idx: number, direction: "up" | "down") => {
    setSlides((prev) => {
      const arr = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((s, i) => ({ ...s, sort_order: i }));
    });
  };

  const updateSlide = (
    idx: number,
    field: keyof SlideForm,
    value: string | File
  ) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === "_file" && value instanceof File) {
          return {
            ...s,
            _file: value,
            _preview: URL.createObjectURL(value),
          };
        }
        if (field === "_beforeFile" && value instanceof File) {
          return {
            ...s,
            _beforeFile: value,
            _beforePreview: URL.createObjectURL(value),
          };
        }
        return { ...s, [field]: value };
      })
    );
  };

  // Save handler
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    if (!categoryId) {
      toast.error("Category is required");
      return;
    }

    setSaving(true);
    try {
      // Upload any new slide images (after + before)
      const uploadedSlides = await Promise.all(
        slides.map(async (slide, idx) => {
          let next = { ...slide };
          if (slide._file) {
            const ext = slide._file.name.split(".").pop() ?? "jpg";
            const path = `prompts/${slug}/${Date.now()}-${idx}.${ext}`;
            const publicUrl = await uploadImage(slide._file, path);
            next = { ...next, image_url: publicUrl };
          }
          if (slide._beforeFile) {
            const ext = slide._beforeFile.name.split(".").pop() ?? "jpg";
            const path = `prompts/${slug}/before-${Date.now()}-${idx}.${ext}`;
            const publicUrl = await uploadImage(slide._beforeFile, path);
            next = { ...next, before_image_url: publicUrl };
          }
          return next;
        })
      );

      const slidePayload = (promptId: number) =>
        uploadedSlides.map((s, i) => ({
          prompt_id: promptId,
          prompt_text: s.prompt_text,
          prompt_preview: s.prompt_preview || makePreview(s.prompt_text),
          image_url: s.image_url,
          before_image_url: s.before_image_url || "",
          sort_order: i,
        }));

      if (isEdit && id) {
        // Update prompt
        const { error: promptError } = await supabase
          .from("prompts")
          .update({
            title,
            slug,
            featured,
            is_premium: isPremium,
            category_id: Number(categoryId),
            updated_at: new Date().toISOString(),
          })
          .eq("id", Number(id));
        if (promptError) throw promptError;

        // Replace prompt_platforms
        await supabase
          .from("prompt_platforms")
          .delete()
          .eq("prompt_id", Number(id));
        if (selectedPlatforms.length > 0) {
          await supabase.from("prompt_platforms").insert(
            selectedPlatforms.map((pid) => ({
              prompt_id: Number(id),
              platform_id: pid,
            }))
          );
        }

        await supabase.from("prompt_packs").delete().eq("prompt_id", Number(id));
        if (selectedPacks.length > 0) {
          await supabase.from("prompt_packs").insert(
            selectedPacks.map((packId) => ({
              prompt_id: Number(id),
              pack_id: packId,
            }))
          );
        }

        // Replace slides: delete old, insert new
        await supabase.from("slides").delete().eq("prompt_id", Number(id));
        if (uploadedSlides.length > 0) {
          await supabase.from("slides").insert(slidePayload(Number(id)));
        }

        toast.success("Prompt updated!");
      } else {
        // Insert new prompt
        const { data: newPrompt, error: promptError } = await supabase
          .from("prompts")
          .insert({
            title,
            slug,
            featured,
            is_premium: isPremium,
            category_id: Number(categoryId),
          })
          .select("id")
          .single();
        if (promptError) throw promptError;

        const promptId = newPrompt.id;

        // Insert platforms
        if (selectedPlatforms.length > 0) {
          await supabase.from("prompt_platforms").insert(
            selectedPlatforms.map((pid) => ({
              prompt_id: promptId,
              platform_id: pid,
            }))
          );
        }

        if (selectedPacks.length > 0) {
          await supabase.from("prompt_packs").insert(
            selectedPacks.map((packId) => ({
              prompt_id: promptId,
              pack_id: packId,
            }))
          );
        }

        // Insert slides
        if (uploadedSlides.length > 0) {
          await supabase.from("slides").insert(slidePayload(promptId));
        }

        toast.success("Prompt created!");
      }
      navigate("/admin/prompts");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/prompts")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEdit ? "Edit Prompt" : "New Prompt"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEdit ? `Editing #${id}` : "Create a new prompt entry"}
          </p>
        </div>
      </div>

      {/* Title & Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Romantic Wedding Sunset"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              autoSlug.current = false;
              setSlug(e.target.value);
            }}
            placeholder="romantic-wedding-sunset"
          />
        </div>
      </div>

      {/* Category & Featured */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <Switch
              id="featured"
              checked={featured}
              onCheckedChange={setFeatured}
            />
            <Label htmlFor="featured" className="flex items-center gap-2 cursor-pointer">
              <Star className={`w-4 h-4 ${featured ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
              Featured look
            </Label>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <Switch
              id="premium"
              checked={isPremium}
              onCheckedChange={setIsPremium}
            />
            <Label htmlFor="premium" className="cursor-pointer">
              Premium (full prompt locked until subscribe)
            </Label>
          </div>
        </div>
      </div>

      {/* Platforms */}
      <div className="space-y-3">
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-4">
          {platforms.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={selectedPlatforms.includes(p.id)}
                onCheckedChange={() => togglePlatform(p.id)}
              />
              <span className="text-sm">{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Packs */}
      {packs.length > 0 && (
        <div className="space-y-3">
          <Label>Look packs</Label>
          <div className="flex flex-wrap gap-4">
            {packs.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={selectedPacks.includes(p.id)}
                  onCheckedChange={() => togglePack(p.id)}
                />
                <span className="text-sm">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Slides */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg">Slides ({slides.length})</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSlide}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add slide
          </Button>
        </div>

        {slides.map((slide, idx) => (
          <Card key={idx} className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Slide {idx + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={idx === 0}
                  onClick={() => moveSlide(idx, "up")}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={idx === slides.length - 1}
                  onClick={() => moveSlide(idx, "down")}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  disabled={slides.length === 1}
                  onClick={() => removeSlide(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* After image upload */}
            <div className="space-y-2">
              <Label>After image (result)</Label>
              <div className="flex items-start gap-4">
                {(slide._preview || slide.image_url) && (
                  <img
                    src={slide._preview || slide.image_url}
                    alt={`Slide ${idx + 1} after`}
                    className="w-24 h-24 rounded-lg object-cover border"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => {
                      fileInputRefs.current[idx] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateSlide(idx, "_file", file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRefs.current[idx]?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Upload after image
                  </Button>
                  <Input
                    value={slide.image_url}
                    onChange={(e) =>
                      updateSlide(idx, "image_url", e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Before image upload */}
            <div className="space-y-2">
              <Label>Before image (optional)</Label>
              <div className="flex items-start gap-4">
                {(slide._beforePreview || slide.before_image_url) && (
                  <img
                    src={slide._beforePreview || slide.before_image_url}
                    alt={`Slide ${idx + 1} before`}
                    className="w-24 h-24 rounded-lg object-cover border"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => {
                      beforeFileInputRefs.current[idx] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateSlide(idx, "_beforeFile", file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => beforeFileInputRefs.current[idx]?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Upload before image
                  </Button>
                  <Input
                    value={slide.before_image_url || ""}
                    onChange={(e) =>
                      updateSlide(idx, "before_image_url", e.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Prompt text */}
            <div className="space-y-2">
              <Label>Full prompt text</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={slide.prompt_text}
                onChange={(e) =>
                  updateSlide(idx, "prompt_text", e.target.value)
                }
                placeholder="Transform the uploaded photo into..."
              />
            </div>
            <div className="space-y-2">
              <Label>Free teaser preview</Label>
              <Input
                value={slide.prompt_preview || ""}
                onChange={(e) =>
                  updateSlide(idx, "prompt_preview", e.target.value)
                }
                placeholder="Shown to free users (auto-filled from prompt if empty)"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Save */}
      <div className="flex gap-3 pb-8">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isEdit ? "Update Prompt" : "Create Prompt"}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/prompts")}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default AdminPromptForm;

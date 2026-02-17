/**
 * Bulk-upload local images to Supabase Storage and update slide image_url fields.
 *
 * Usage:  node scripts/upload-images.mjs
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * Also requires a Supabase service_role key for storage uploads.
 * Set SUPABASE_SERVICE_ROLE_KEY in .env (find it in Supabase > Settings > API).
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env manually (no dotenv dependency needed)
const envPath = path.join(ROOT, ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://pozytitruvcthhfvpqic.supabase.co';
const SUPABASE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvenl0aXRydXZjdGhoZnZwcWljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM1ODY0MiwiZXhwIjoyMDc5OTM0NjQyfQ.9AeHT1qKEGr-2RR2LD2JHa2SgvD7SmiuM21CJaxsFZQ';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map imageKey → local file name
const imageKeyToFile = {
  ghibliArtWorkshop: "Creating-Ghibli-Art-with-ChatGPT.jpg",
  instagramGhibliFamily: "instagram-ghibli-family.jpg",
  instagramGhibliForest: "instagram-ghibli-forest.jpg",
  instagramGhibli: "instagram-ghibli.jpg",
  weddingSunset: "wedding-sunset.jpg",
  weddingRings: "wedding-rings.jpg",
  weddingDance: "wedding-dance.jpg",
  portraitNeon: "portrait-neon.jpg",
  portraitFashion: "portrait-fashion.jpg",
  portraitSmoke: "portrait-smoke.jpg",
  portraitCreativeGraphite: "portrait-creative-graphite.jpg",
  portraitCreativeCitrus: "portrait-creative-citrus.jpg",
  portraitCreativeGradient: "portrait-creative-gradient.jpg",
  portraitHeadshotModern: "portrait-headshot-modern.jpg",
  portraitHeadshotBlonde: "portrait-headshot-blonde.jpg",
  portraitHeadshotNeutral: "portrait-headshot-neutral.jpg",
  portraitHeadshotSoft: "portrait-headshot-soft.jpg",
  artAbstract: "art-abstract.jpg",
  artGeometric: "art-geometric.jpg",
  artFluid: "art-fluid.jpg",
  animeCharacter: "anime-character.jpg",
  animeMagical: "anime-magical.jpg",
  animeWarrior: "anime-warrior.jpg",
  productPhone: "product-phone.jpg",
  productHeadphones: "product-headphones.jpg",
  productWatch: "product-watch.jpg",
  landscapeMountains: "landscape-mountains.jpg",
  landscapeLake: "landscape-lake.jpg",
  landscapeHills: "landscape-hills.jpg",
  youngerSelfPolaroid: "younger-self-polaroid.webp",
};

// Load prompts.json to know which imageKey maps to which prompt slug + slide order
const promptsData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/data/prompts.json"), "utf-8")
);

async function main() {
  console.log("Starting image upload to Supabase Storage...\n");

  // Get all slides from DB
  const { data: allSlides, error: slidesErr } = await supabase
    .from("slides")
    .select("id, prompt_id, sort_order, image_url");
  if (slidesErr) {
    console.error("Failed to fetch slides:", slidesErr.message);
    process.exit(1);
  }

  // Get all prompts from DB to map slug -> id
  const { data: allPrompts, error: promptsErr } = await supabase
    .from("prompts")
    .select("id, slug");
  if (promptsErr) {
    console.error("Failed to fetch prompts:", promptsErr.message);
    process.exit(1);
  }

  const slugToId = {};
  for (const p of allPrompts) slugToId[p.slug] = p.id;

  // Build a map: prompt slug -> array of imageKeys (by slide order)
  const promptSlugMap = {
    "ig-trend-ghibli-art-studio-time-capsule": [
      "ghibliArtWorkshop",
      "instagramGhibliFamily",
      "instagramGhibliForest",
      "instagramGhibli",
    ],
    "romantic-wedding-sunset": ["weddingSunset", "weddingRings", "weddingDance"],
    "cyberpunk-neon-portrait": ["portraitNeon", "portraitFashion", "portraitSmoke"],
    "executive-linkedin-headshot": [
      "portraitCreativeGraphite",
      "portraitCreativeCitrus",
      "portraitCreativeGradient",
    ],
    "creative-resume-portrait": [
      "portraitHeadshotModern",
      "portraitHeadshotBlonde",
      "portraitHeadshotNeutral",
    ],
    "flowing-abstract-art": ["artAbstract", "artGeometric", "artFluid"],
    "magical-anime-character": ["animeCharacter", "animeMagical", "animeWarrior"],
    "modern-tech-product": ["productPhone", "productHeadphones", "productWatch"],
    "epic-mountain-sunrise": [
      "landscapeMountains",
      "landscapeLake",
      "landscapeHills",
    ],
    "photo-with-your-younger-self": ["youngerSelfPolaroid"],
  };

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;

  for (const [promptSlug, imageKeys] of Object.entries(promptSlugMap)) {
    const promptId = slugToId[promptSlug];
    if (!promptId) {
      console.warn(`  Prompt slug "${promptSlug}" not found in DB, skipping.`);
      skipped += imageKeys.length;
      continue;
    }

    for (let sortOrder = 0; sortOrder < imageKeys.length; sortOrder++) {
      const imageKey = imageKeys[sortOrder];
      const fileName = imageKeyToFile[imageKey];
      if (!fileName) {
        console.warn(`  No file mapped for imageKey "${imageKey}", skipping.`);
        skipped++;
        continue;
      }

      const localPath = path.join(ROOT, "src/assets", fileName);
      if (!fs.existsSync(localPath)) {
        console.warn(`  File not found: ${localPath}, skipping.`);
        skipped++;
        continue;
      }

      // Find matching slide in DB
      const slide = allSlides.find(
        (s) => s.prompt_id === promptId && s.sort_order === sortOrder
      );
      if (!slide) {
        console.warn(
          `  No slide for prompt ${promptSlug} sort_order ${sortOrder}, skipping.`
        );
        skipped++;
        continue;
      }

      // Skip if already has an image URL
      if (slide.image_url && slide.image_url.startsWith("http")) {
        console.log(`  Slide ${slide.id} already has image, skipping.`);
        skipped++;
        continue;
      }

      // Upload to Supabase Storage
      const storagePath = `seeds/${promptSlug}/${fileName}`;
      const fileBuffer = fs.readFileSync(localPath);
      const contentType = fileName.endsWith(".webp")
        ? "image/webp"
        : fileName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

      const { error: uploadErr } = await supabase.storage
        .from("prompt-images")
        .upload(storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        console.error(
          `  Upload failed for ${fileName}: ${uploadErr.message}`
        );
        continue;
      }
      uploaded++;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("prompt-images").getPublicUrl(storagePath);

      // Update slide in DB
      const { error: updateErr } = await supabase
        .from("slides")
        .update({ image_url: publicUrl })
        .eq("id", slide.id);

      if (updateErr) {
        console.error(
          `  DB update failed for slide ${slide.id}: ${updateErr.message}`
        );
      } else {
        updated++;
        console.log(`  ✓ ${fileName} → ${publicUrl}`);
      }
    }
  }

  console.log(
    `\nDone! Uploaded: ${uploaded}, Updated: ${updated}, Skipped: ${skipped}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

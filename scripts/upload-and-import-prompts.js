import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables");
  console.error("Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper function to create slug from name
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

// Upload image to Supabase storage
const uploadImageToSupabase = async (localImagePath, storagePath) => {
  try {
    if (!fs.existsSync(localImagePath)) {
      console.warn(`⚠️  Image not found: ${localImagePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(localImagePath);
    const { data, error } = await supabase.storage
      .from("prompt-images")
      .upload(storagePath, fileBuffer, { 
        upsert: true,
        contentType: `image/${path.extname(localImagePath).slice(1)}`
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("prompt-images")
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error(`❌ Error uploading ${localImagePath}:`, error.message);
    return null;
  }
};

async function uploadAndImportPrompts() {
  try {
    console.log("🚀 Starting ChatGPT Image Editing Prompts upload and import...");

    // Read the JSON file
    const jsonPath = path.join(process.cwd(), "chatgpt_image_editing_prompts.json");
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    console.log(`📊 Found ${jsonData.total_prompts} prompts in ${jsonData.categories.length} categories`);
    console.log(`📁 Images folder: ${jsonData.images_folder}`);

    // Step 1: Create or get the platform
    console.log("🔧 Creating platform...");
    let platformId;
    
    const { data: existingPlatform } = await supabase
      .from("platforms")
      .select("id")
      .eq("name", jsonData.platform.name)
      .single();

    if (existingPlatform) {
      platformId = existingPlatform.id;
      console.log(`✅ Platform "${jsonData.platform.name}" already exists (ID: ${platformId})`);
    } else {
      const { data: newPlatform, error: platformError } = await supabase
        .from("platforms")
        .insert({
          name: jsonData.platform.name,
          url: jsonData.platform.url,
        })
        .select("id")
        .single();

      if (platformError) throw platformError;
      platformId = newPlatform.id;
      console.log(`✅ Created platform "${jsonData.platform.name}" (ID: ${platformId})`);
    }

    // Step 2: Create categories and get their IDs
    console.log("📁 Creating categories...");
    const categoryMap = new Map();

    for (const category of jsonData.categories) {
      const slug = slugify(category.name);
      
      const { data: existingCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("name", category.name)
        .single();

      if (existingCategory) {
        categoryMap.set(category.name, existingCategory.id);
        console.log(`✅ Category "${category.name}" already exists (ID: ${existingCategory.id})`);
      } else {
        const { data: newCategory, error: categoryError } = await supabase
          .from("categories")
          .insert({
            name: category.name,
            slug: slug,
          })
          .select("id")
          .single();

        if (categoryError) throw categoryError;
        categoryMap.set(category.name, newCategory.id);
        console.log(`✅ Created category "${category.name}" (ID: ${newCategory.id})`);
      }
    }

    // Step 3: Upload images and import prompts
    console.log("📝 Uploading images and importing prompts...");
    let importedCount = 0;
    let skippedCount = 0;
    let uploadedImagesCount = 0;

    for (const category of jsonData.categories) {
      const categoryId = categoryMap.get(category.name);
      
      for (const jsonPrompt of category.prompts) {
        const promptSlug = slugify(jsonPrompt.title);
        
        // Check if prompt already exists
        const { data: existingPrompt } = await supabase
          .from("prompts")
          .select("id")
          .eq("slug", promptSlug)
          .single();

        if (existingPrompt) {
          console.log(`⏭️  Skipping "${jsonPrompt.title}" - already exists`);
          skippedCount++;
          continue;
        }

        console.log(`📤 Processing "${jsonPrompt.title}"...`);

        // Upload before and after images
        const beforeImagePath = path.join(jsonData.images_folder, jsonPrompt.before_image);
        const afterImagePath = path.join(jsonData.images_folder, jsonPrompt.after_image);

        const beforeStoragePath = `chatgpt-prompts/before/${jsonPrompt.id}-${jsonPrompt.before_image}`;
        const afterStoragePath = `chatgpt-prompts/after/${jsonPrompt.id}-${jsonPrompt.after_image}`;

        const beforeImageUrl = await uploadImageToSupabase(beforeImagePath, beforeStoragePath);
        const afterImageUrl = await uploadImageToSupabase(afterImagePath, afterStoragePath);

        // Use fallback URLs if upload fails
        const finalBeforeUrl = beforeImageUrl || jsonPrompt.before_image_url;
        const finalAfterUrl = afterImageUrl || jsonPrompt.after_image_url;

        if (beforeImageUrl) uploadedImagesCount++;
        if (afterImageUrl) uploadedImagesCount++;

        // Create the prompt
        const { data: newPrompt, error: promptError } = await supabase
          .from("prompts")
          .insert({
            title: jsonPrompt.title,
            slug: promptSlug,
            featured: false,
            category_id: categoryId,
          })
          .select("id")
          .single();

        if (promptError) {
          console.error(`❌ Error creating prompt "${jsonPrompt.title}":`, promptError);
          continue;
        }

        const promptId = newPrompt.id;

        // Link to platform
        await supabase.from("prompt_platforms").insert({
          prompt_id: promptId,
          platform_id: platformId,
        });

        // Create slides - before and after images
        const slides = [
          {
            prompt_id: promptId,
            prompt_text: `Before: ${jsonPrompt.title}`,
            image_url: finalBeforeUrl,
            sort_order: 0,
          },
          {
            prompt_id: promptId,
            prompt_text: jsonPrompt.prompt,
            image_url: finalAfterUrl,
            sort_order: 1,
          },
        ];

        const { error: slidesError } = await supabase
          .from("slides")
          .insert(slides);

        if (slidesError) {
          console.error(`❌ Error creating slides for "${jsonPrompt.title}":`, slidesError);
          continue;
        }

        console.log(`✅ Imported "${jsonPrompt.title}" with 2 slides`);
        importedCount++;
      }
    }

    console.log("\n🎉 Upload and import completed!");
    console.log(`📊 Summary:`);
    console.log(`   - Total prompts in JSON: ${jsonData.total_prompts}`);
    console.log(`   - Imported: ${importedCount}`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    console.log(`   - Images uploaded: ${uploadedImagesCount}`);
    console.log(`   - Categories created/found: ${jsonData.categories.length}`);
    console.log(`   - Platform: ${jsonData.platform.name}`);

  } catch (error) {
    console.error("❌ Upload and import failed:", error);
    process.exit(1);
  }
}

// Run the upload and import
uploadAndImportPrompts();

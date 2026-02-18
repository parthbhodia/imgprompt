import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to create slug from name
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

interface JsonPrompt {
  id: number;
  title: string;
  prompt: string;
  before_image: string;
  after_image: string;
}

interface JsonCategory {
  name: string;
  count: number;
  prompts: JsonPrompt[];
}

interface JsonData {
  title: string;
  total_prompts: number;
  platform: {
    name: string;
    url: string;
  };
  categories: JsonCategory[];
}

async function importChatGPTPrompts() {
  try {
    console.log("🚀 Starting ChatGPT Image Editing Prompts import...");

    // Read the JSON file
    const jsonPath = path.join(process.cwd(), "chatgpt_image_editing_prompts.json");
    const jsonData: JsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    console.log(`📊 Found ${jsonData.total_prompts} prompts in ${jsonData.categories.length} categories`);

    // Step 1: Create or get the platform
    console.log("🔧 Creating platform...");
    let platformId: number;
    
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
    const categoryMap = new Map<string, number>();

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

    // Step 3: Import prompts with slides
    console.log("📝 Importing prompts...");
    let importedCount = 0;
    let skippedCount = 0;

    for (const category of jsonData.categories) {
      const categoryId = categoryMap.get(category.name)!;
      
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
            prompt_text: jsonPrompt.prompt,
            image_url: `https://www.fotor.com/blog/wp-content/uploads/2024/12/${jsonPrompt.before_image}`,
            sort_order: 0,
          },
          {
            prompt_id: promptId,
            prompt_text: `Result: ${jsonPrompt.title}`,
            image_url: `https://www.fotor.com/blog/wp-content/uploads/2024/12/${jsonPrompt.after_image}`,
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

    console.log("\n🎉 Import completed!");
    console.log(`📊 Summary:`);
    console.log(`   - Total prompts in JSON: ${jsonData.total_prompts}`);
    console.log(`   - Imported: ${importedCount}`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    console.log(`   - Categories created/found: ${jsonData.categories.length}`);
    console.log(`   - Platform: ${jsonData.platform.name}`);

  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run the import
importChatGPTPrompts();

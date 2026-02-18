import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updatePlatforms() {
  try {
    console.log("🔄 Updating platform associations...");

    // Step 1: Get or create the AI platforms
    const aiPlatforms = [
      { name: "DALL-E 3", url: "https://chatgpt.com/" },
      { name: "Stable Diffusion", url: "https://stablediffusionweb.com/" },
      { name: "Midjourney", url: "https://www.midjourney.com/" }
    ];

    const platformIds = {};

    for (const platform of aiPlatforms) {
      const { data: existing } = await supabase
        .from("platforms")
        .select("id")
        .eq("name", platform.name)
        .single();

      if (existing) {
        platformIds[platform.name] = existing.id;
        console.log(`✅ Found existing platform "${platform.name}" (ID: ${existing.id})`);
      } else {
        const { data: newPlatform, error } = await supabase
          .from("platforms")
          .insert({
            name: platform.name,
            url: platform.url
          })
          .select("id")
          .single();

        if (error) throw error;
        platformIds[platform.name] = newPlatform.id;
        console.log(`✅ Created platform "${platform.name}" (ID: ${newPlatform.id})`);
      }
    }

    // Step 2: Get Fotor platform and associated prompts
    const { data: fotorPlatform } = await supabase
      .from("platforms")
      .select("id")
      .eq("name", "Fotor GPT Image Generator")
      .single();

    if (!fotorPlatform) {
      console.log("ℹ️  No Fotor platform found");
      return;
    }

    const { data: fotorPrompts } = await supabase
      .from("prompt_platforms")
      .select("prompt_id")
      .eq("platform_id", fotorPlatform.id);

    if (!fotorPrompts || fotorPrompts.length === 0) {
      console.log("ℹ️  No prompts associated with Fotor platform");
      return;
    }

    console.log(`🔍 Found ${fotorPrompts.length} prompts to reassign`);

    // Step 3: Categorize prompts by type and assign appropriate platforms
    const promptCategories = {
      "Popular/Creative Tricks": ["DALL-E 3", "Midjourney"],
      "Style Transfer": ["Stable Diffusion", "Midjourney"], 
      "Basic Editing": ["DALL-E 3", "Stable Diffusion"],
      "Portrait Editing": ["DALL-E 3", "Stable Diffusion"],
      "Practical Applications": ["DALL-E 3", "Stable Diffusion", "Midjourney"]
    };

    // Get all prompts with their categories
    const { data: allPrompts } = await supabase
      .from("prompts")
      .select(`
        id,
        title,
        category:categories(name)
      `)
      .in("id", fotorPrompts.map(fp => fp.prompt_id));

    // Step 4: Delete existing Fotor associations
    console.log("🗑️  Removing Fotor platform associations...");
    await supabase
      .from("prompt_platforms")
      .delete()
      .eq("platform_id", fotorPlatform.id);

    // Step 5: Create new platform associations
    console.log("🔗 Creating new platform associations...");
    let associationsCreated = 0;

    for (const prompt of allPrompts) {
      const categoryName = prompt.category?.name;
      const platforms = promptCategories[categoryName] || ["DALL-E 3", "Stable Diffusion"];
      
      const associations = platforms.map(platformName => ({
        prompt_id: prompt.id,
        platform_id: platformIds[platformName]
      }));

      const { error } = await supabase
        .from("prompt_platforms")
        .insert(associations);

      if (error) {
        console.error(`❌ Error associating prompt "${prompt.title}":`, error);
      } else {
        console.log(`✅ Associated "${prompt.title}" with ${platforms.join(", ")}`);
        associationsCreated += associations.length;
      }
    }

    // Step 6: Delete Fotor platform
    console.log("🗑️  Deleting Fotor platform...");
    await supabase
      .from("platforms")
      .delete()
      .eq("id", fotorPlatform.id);

    console.log("\n🎉 Platform update completed!");
    console.log(`📊 Summary:`);
    console.log(`   - Prompts reassigned: ${allPrompts.length}`);
    console.log(`   - Platform associations created: ${associationsCreated}`);
    console.log(`   - AI platforms: ${Object.keys(platformIds).join(", ")}`);
    console.log(`   - Fotor platform removed`);

  } catch (error) {
    console.error("❌ Platform update failed:", error);
  }
}

updatePlatforms();

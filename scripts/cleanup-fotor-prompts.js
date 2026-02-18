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

async function cleanupFotorPrompts() {
  try {
    console.log("🧹 Cleaning up existing Fotor prompts...");

    // Step 1: Find Fotor platform
    const { data: fotorPlatform } = await supabase
      .from("platforms")
      .select("id")
      .eq("name", "Fotor GPT Image Generator")
      .single();

    if (!fotorPlatform) {
      console.log("ℹ️  No Fotor platform found, nothing to clean up");
      return;
    }

    console.log(`🔍 Found Fotor platform (ID: ${fotorPlatform.id})`);

    // Step 2: Get prompt IDs associated with Fotor platform
    const { data: promptPlatforms } = await supabase
      .from("prompt_platforms")
      .select("prompt_id")
      .eq("platform_id", fotorPlatform.id);

    if (!promptPlatforms || promptPlatforms.length === 0) {
      console.log("ℹ️  No prompts associated with Fotor platform");
      return;
    }

    const promptIds = promptPlatforms.map(pp => pp.prompt_id);
    console.log(`🔍 Found ${promptIds.length} prompts to delete`);

    // Step 3: Delete slides first (due to foreign key constraints)
    console.log("🗑️  Deleting slides...");
    const { error: slidesError } = await supabase
      .from("slides")
      .delete()
      .in("prompt_id", promptIds);

    if (slidesError) {
      console.error("❌ Error deleting slides:", slidesError);
      return;
    }

    // Step 4: Delete prompt_platforms relationships
    console.log("🗑️  Deleting prompt-platform relationships...");
    const { error: relationError } = await supabase
      .from("prompt_platforms")
      .delete()
      .eq("platform_id", fotorPlatform.id);

    if (relationError) {
      console.error("❌ Error deleting relationships:", relationError);
      return;
    }

    // Step 5: Delete prompts
    console.log("🗑️  Deleting prompts...");
    const { error: promptsError } = await supabase
      .from("prompts")
      .delete()
      .in("id", promptIds);

    if (promptsError) {
      console.error("❌ Error deleting prompts:", promptsError);
      return;
    }

    console.log(`✅ Successfully deleted ${promptIds.length} prompts and their associated data`);
    console.log("🎉 Cleanup completed! Ready for fresh import.");

  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

cleanupFotorPrompts();

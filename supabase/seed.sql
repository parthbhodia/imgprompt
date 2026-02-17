-- ============================================================
-- Seed data – migrated from prompts.json
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- ============================================================

-- Categories
INSERT INTO public.categories (name, slug) VALUES
  ('Social Media', 'social-media'),
  ('Wedding', 'wedding'),
  ('Portrait', 'portrait'),
  ('Art', 'art'),
  ('Anime', 'anime'),
  ('Product', 'product'),
  ('Landscape', 'landscape')
ON CONFLICT (name) DO NOTHING;

-- Platforms
INSERT INTO public.platforms (name, url) VALUES
  ('Midjourney', 'https://www.midjourney.com/'),
  ('DALL-E 3', 'https://chatgpt.com/'),
  ('Stable Diffusion', 'https://stablediffusionweb.com/'),
  ('Leonardo AI', 'https://leonardo.ai/'),
  ('Adobe Firefly', 'https://firefly.adobe.com/'),
  ('Niji Journey', 'https://niji.journey.com/'),
  ('Google Gemini', 'https://gemini.google.com/app'),
  ('Createimg.com', 'https://createimg.com/')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Prompts
-- NOTE: image_url fields are left empty below. After running
-- this seed, upload images via the admin panel or update these
-- URLs to point to your Supabase Storage public URLs.
-- ============================================================

-- 1. IG Trend: Ghibli Art Studio Time Capsule (Social Media, featured)
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('IG Trend: Ghibli Art Studio Time Capsule', 'ig-trend-ghibli-art-studio-time-capsule', true,
   (SELECT id FROM public.categories WHERE slug = 'social-media'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'ig-trend-ghibli-art-studio-time-capsule'
  AND pl.name IN ('Midjourney', 'DALL-E 3', 'Stable Diffusion');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded photo into a Studio Ghibli–style illustration. Preserve every subject''s facial structure, hairstyle, wardrobe silhouette, and overall mood from the original image while gently stylizing them with rounded faces, expressive large eyes, soft blush, and tidy anime line-art. Simplify clothing folds while keeping original color cues, and harmonize tones with warm gradients. Recreate the photographed environment in painterly watercolor textures with soft light bloom, drifting particles, and nostalgic cinematic lighting. Maintain the emotional tone and composition of the source image while infusing it with handcrafted Ghibli charm, gentle wind movement, and dreamy atmospheric effects.',
  '', 0
FROM public.prompts p WHERE p.slug = 'ig-trend-ghibli-art-studio-time-capsule';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded group photo into a Studio Ghibli–style outdoor family portrait. Preserve the exact number of people, their poses, positions, outfits, and accessories from the original image. Restyle each person with rounded features, gentle blush, glossy eyes, and softly textured hair while maintaining their individual facial characteristics and expressions. Reimagine the background as a golden-hour park scene with watercolor foliage, glowing rim light, drifting pollen, and painterly lens bloom. Keep the original spatial relationships between subjects, emphasize closeness and warmth, and preserve each person''s unique likeness while adding Ghibli''s signature gentle aesthetic.',
  '', 1
FROM public.prompts p WHERE p.slug = 'ig-trend-ghibli-art-studio-time-capsule';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded outdoor photo into a Ghibli forest vista while preserving its subject placement, poses, and camera angle from the original. Restyle people, animals, or objects from the original image with clean anime line-art, rounded proportions, and soft shading while maintaining their recognizable features. Surround them with towering ancient trees, mossy roots, painterly leaves, and amber god rays streaming through the canopy. Add Totoro-inspired forest spirits or floating soot sprites for whimsy, keep lighting golden and diffused with lens flares, and retain the scene''s original mood of calm wonder while enhancing it with magical realism and gentle atmospheric depth.',
  '', 2
FROM public.prompts p WHERE p.slug = 'ig-trend-ghibli-art-studio-time-capsule';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded indoor photo into a Studio Ghibli art-studio moment. Preserve the subject count, poses, spatial positioning, and props from the original image. Reinterpret subjects with rounded faces, expressive eyes, subtle blush, and soft cel shading while keeping their distinctive features recognizable. Replace or enhance the setting with tatami floors, wooden shelves packed with sketchbooks and pottery, floating dust motes catching light, and golden window illumination from a hearth-lit atelier. Add tiny friendly spirits or glowing paint orbs drifting in the air, maintain the original emotional tone and interactions between subjects, and finish with warm nostalgic color grading that emphasizes comfort and creativity.',
  '', 3
FROM public.prompts p WHERE p.slug = 'ig-trend-ghibli-art-studio-time-capsule';

-- 2. Romantic Wedding Sunset
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Romantic Wedding Sunset', 'romantic-wedding-sunset', false,
   (SELECT id FROM public.categories WHERE slug = 'wedding'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'romantic-wedding-sunset'
  AND pl.name IN ('Midjourney', 'DALL-E 3', 'Stable Diffusion');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded wedding or couple photo into a cinematic sunset scene. Preserve the couple''s exact poses, facial features, expressions, dress style, suit details, and positioning from the original image. Enhance with molten gold horizon backlighting that wraps subjects in amber glow, create soft creamy bokeh in the background while keeping faces razor sharp, add warm honey and terracotta color grading, introduce subtle floating dust particles catching the light, maintain authentic expressions and body language, incorporate gentle lens flares and rim lighting, add delicate veil movement if present in original, include reflective highlights suggesting distant water, balance warm sunset tones with cool shadow depth, and finish with light editorial film grain while preserving the intimate emotion of the original moment.',
  '', 0
FROM public.prompts p WHERE p.slug = 'romantic-wedding-sunset';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded wedding detail photo of rings, jewelry, flowers, or accessories into an intimate macro composition. Preserve the exact items, their positioning, and arrangement from the original image. Enhance with elegant velvet or silk textures beneath the objects, add scattered handwritten vow snippets or dried petals around the main subject, apply focus stacking for razor-sharp foreground with dreamy bokeh background, introduce soft directional lighting that creates gentle highlights on metal or floral surfaces, incorporate warm golden hour color grading, add subtle lens flare or light bloom, maintain the original item colors while enhancing richness, include delicate shadows for depth, create a refined editorial aesthetic, and finish with fine art color treatment that emphasizes romance and luxury.',
  '', 1
FROM public.prompts p WHERE p.slug = 'romantic-wedding-sunset';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded dance or motion photo into a magical first-dance moment. Preserve the subjects'' poses, movement, facial expressions, outfit details, and spatial relationship from the original image. Enhance with elegant string lights or canopy lighting above creating a romantic ceiling effect, add subtle motion blur trailing from fabric or dress hem to emphasize graceful movement, introduce rim lighting that outlines silhouettes and separates subjects from background, incorporate warm golden amber color grading, blur background guests or venue details into soft bokeh, add floating particles or sparkles catching the light, maintain authentic emotions and gestures, include gentle lens flares from overhead lights, create depth through layered lighting zones, and finish with cinematic color treatment that captures the joy and energy while preserving the intimacy of the moment.',
  '', 2
FROM public.prompts p WHERE p.slug = 'romantic-wedding-sunset';

-- 3. Cyberpunk Neon Portrait
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Cyberpunk Neon Portrait', 'cyberpunk-neon-portrait', false,
   (SELECT id FROM public.categories WHERE slug = 'portrait'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'cyberpunk-neon-portrait'
  AND pl.name IN ('Midjourney', 'Leonardo AI', 'Stable Diffusion');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a cyberpunk scene soaked in magenta and cyan neon lighting. Preserve the subject''s facial structure, features, expression, hair style, and pose from the original image.',
  '', 0
FROM public.prompts p WHERE p.slug = 'cyberpunk-neon-portrait';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded fashion or portrait photo into a cyberpunk editorial masterpiece. Preserve the subject''s face, expression, body pose, and overall proportions from the original image.',
  '', 1
FROM public.prompts p WHERE p.slug = 'cyberpunk-neon-portrait';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a moody cyberpunk scene with the subject emerging through neon-tinted steam. Preserve the subject''s facial features, profile angle, expression, and recognizable characteristics from the original image.',
  '', 2
FROM public.prompts p WHERE p.slug = 'cyberpunk-neon-portrait';

-- 4. Executive LinkedIn Headshot
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Executive LinkedIn Headshot', 'executive-linkedin-headshot', false,
   (SELECT id FROM public.categories WHERE slug = 'portrait'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'executive-linkedin-headshot'
  AND pl.name IN ('Midjourney', 'DALL-E 3', 'Stable Diffusion');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a professional executive headshot suitable for LinkedIn and corporate profiles. Preserve the subject''s facial features, expression, eye color, hair style, and recognizable characteristics from the original image.',
  '', 0
FROM public.prompts p WHERE p.slug = 'executive-linkedin-headshot';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a modern professional headshot with contemporary styling. Preserve the subject''s facial structure, natural expression, distinctive features, and hair style from the original image.',
  '', 1
FROM public.prompts p WHERE p.slug = 'executive-linkedin-headshot';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a professional headshot radiating optimism and capability. Preserve the subject''s facial features, natural smile, eye characteristics, and distinctive appearance from the original image.',
  '', 2
FROM public.prompts p WHERE p.slug = 'executive-linkedin-headshot';

-- 5. Creative Resume Portrait
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Creative Resume Portrait', 'creative-resume-portrait', false,
   (SELECT id FROM public.categories WHERE slug = 'portrait'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'creative-resume-portrait'
  AND pl.name IN ('Midjourney', 'Leonardo AI', 'Adobe Firefly');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a creative headshot with citrus-inspired color blocking using apricot and teal tones. Preserve the subject''s facial features, authentic expression, hair style, and recognizable characteristics from the original image.',
  '', 0
FROM public.prompts p WHERE p.slug = 'creative-resume-portrait';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a creative headshot with graphite tones and diagonal neon accent strokes. Preserve the subject''s facial structure, features, eye color, hair characteristics, and distinctive appearance from the original image.',
  '', 1
FROM public.prompts p WHERE p.slug = 'creative-resume-portrait';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the uploaded portrait into a creative headshot with flowing lilac-to-turquoise gradient background. Preserve the subject''s facial features, natural expression, eye characteristics, hair style, and authentic appearance from the original image.',
  '', 2
FROM public.prompts p WHERE p.slug = 'creative-resume-portrait';

-- 6. Flowing Abstract Art
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Flowing Abstract Art', 'flowing-abstract-art', false,
   (SELECT id FROM public.categories WHERE slug = 'art'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'flowing-abstract-art'
  AND pl.name IN ('DALL-E 3', 'Midjourney', 'Adobe Firefly');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded photo into flowing abstract art inspired by fluid acrylic pours.', '', 0
FROM public.prompts p WHERE p.slug = 'flowing-abstract-art';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded photo into geometric abstract art with interlocking prisms and angular shapes.', '', 1
FROM public.prompts p WHERE p.slug = 'flowing-abstract-art';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded photo into fluid resin-style art echoing ocean currents and waves.', '', 2
FROM public.prompts p WHERE p.slug = 'flowing-abstract-art';

-- 7. Magical Anime Character
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Magical Anime Character', 'magical-anime-character', false,
   (SELECT id FROM public.categories WHERE slug = 'anime'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'magical-anime-character'
  AND pl.name IN ('Niji Journey', 'Stable Diffusion', 'Leonardo AI');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded portrait into a heroic anime mage character hovering above crystalline magical ruins.', '', 0
FROM public.prompts p WHERE p.slug = 'magical-anime-character';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded portrait into a celestial anime sorceress conjuring nebula fire and cosmic magic.', '', 1
FROM public.prompts p WHERE p.slug = 'magical-anime-character';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded portrait into an armored anime guardian warrior captured mid-leap over floating islands.', '', 2
FROM public.prompts p WHERE p.slug = 'magical-anime-character';

-- 8. Modern Tech Product
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Modern Tech Product', 'modern-tech-product', false,
   (SELECT id FROM public.categories WHERE slug = 'product'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'modern-tech-product'
  AND pl.name IN ('Midjourney', 'DALL-E 3', 'Adobe Firefly');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded product photo into a minimalist hero shot with premium commercial lighting.', '', 0
FROM public.prompts p WHERE p.slug = 'modern-tech-product';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded audio product photo into premium commercial photography with dynamic presentation.', '', 1
FROM public.prompts p WHERE p.slug = 'modern-tech-product';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded watch, jewelry, or luxury accessory photo into premium product photography with meticulous attention to detail.', '', 2
FROM public.prompts p WHERE p.slug = 'modern-tech-product';

-- 9. Epic Mountain Sunrise
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Epic Mountain Sunrise', 'epic-mountain-sunrise', false,
   (SELECT id FROM public.categories WHERE slug = 'landscape'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'epic-mountain-sunrise'
  AND pl.name IN ('Midjourney', 'Stable Diffusion', 'Leonardo AI');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded landscape or outdoor photo into a panoramic mountain sunrise scene with epic cinematic quality.', '', 0
FROM public.prompts p WHERE p.slug = 'epic-mountain-sunrise';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded photo containing water elements into a serene alpine lake scene with perfect mirror-like reflections.', '', 1
FROM public.prompts p WHERE p.slug = 'epic-mountain-sunrise';

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id, 'Transform the uploaded outdoor photo into painterly rolling hills bathed in blue-hour gradient lighting.', '', 2
FROM public.prompts p WHERE p.slug = 'epic-mountain-sunrise';

-- 10. Photo With Your Younger Self
INSERT INTO public.prompts (title, slug, featured, category_id) VALUES
  ('Photo With Your Younger Self', 'photo-with-your-younger-self', false,
   (SELECT id FROM public.categories WHERE slug = 'social-media'));

INSERT INTO public.prompt_platforms (prompt_id, platform_id)
SELECT p.id, pl.id FROM public.prompts p, public.platforms pl
WHERE p.slug = 'photo-with-your-younger-self'
  AND pl.name IN ('Google Gemini', 'Createimg.com', 'DALL-E 3');

INSERT INTO public.slides (prompt_id, prompt_text, image_url, sort_order)
SELECT p.id,
  'Transform the two uploaded photos into a cute polaroid picture showing my older self hugging my younger self together in one heartwarming scene. Preserve the facial features, expressions, hair styles, and distinctive characteristics from both the current photo and the childhood photo.',
  '', 0
FROM public.prompts p WHERE p.slug = 'photo-with-your-younger-self';

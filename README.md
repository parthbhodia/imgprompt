# ImgPrompt - AI Image Prompt Library

ImgPrompt is a comprehensive AI prompt library that pairs high-performing prompts with finished visuals, platform recommendations, and creative guidance. Users can discover, copy, and share prompts for DALL-E 3, Stable Diffusion, Midjourney, and other AI image generation platforms.

**Live site:** https://vibeimg.xyz/

## 🚀 Features

### Core Functionality
- **Curated Prompt Library** - 36+ ChatGPT image editing prompts with before/after examples
- **Multi-Platform Support** - Prompts optimized for DALL-E 3, Stable Diffusion, and Midjourney
- **Interactive Prompt Cards** - Image carousels with navigation, copyable prompts, and platform links
- **Category Filtering** - Organized by Popular/Creative Tricks, Style Transfer, Basic Editing, Portrait Editing, and Practical Applications
- **Search Functionality** - Real-time search across prompt titles and descriptions
- **Shareable Category URLs** - Direct links to specific categories for easy sharing

### User Experience
- **AI Image Chat** - Generate images with Replicate Flux from the homepage; chat-style UI with credits and prompt suggestions from the library
- **Most Liked Prompts** - Displays top 6 most liked prompts with arrow navigation
- **User Authentication** - Google OAuth integration for likes, favorites, and AI image credits
- **Likes & Favorites System** - Users can like prompts and save favorites
- **Responsive Design** - Fully responsive with glassmorphism styling and smooth animations
- **Before/After Image Display** - Visual examples showing prompt results

### Admin Features
- **Admin Dashboard** - Statistics and management overview
- **Prompt Management** - Create, edit, and delete prompts with multi-slide support
- **Featured Prompts** - Star toggle for easy featured status management
- **Category Management** - Organize prompts into categories
- **Platform Management** - Associate prompts with AI platforms
- **Image Upload** - Supabase storage integration for prompt images

## 🛠 Tech Stack

### Frontend
- **Vite + React + TypeScript** - Modern build tooling and type safety
- **React Router** - Client-side routing with URL parameters
- **shadcn/ui + Tailwind CSS** - Component library and utility-first styling
- **TanStack Query** - Data fetching and caching
- **Lucide React** - Icon library

### Backend & Database
- **Supabase** - PostgreSQL database with real-time features
- **Row Level Security** - Secure data access with user authentication
- **Supabase Storage** - Image hosting and management
- **Google OAuth** - Authentication provider

### Database Schema
- `prompts` - Main prompt data with title, slug, featured status
- `categories` - Prompt categorization
- `platforms` - AI platform information (DALL-E 3, Stable Diffusion, etc.)
- `slides` - Multi-slide prompt content with images and text
- `likes` - User like interactions
- `favorites` - User favorite prompts
- `prompt_platforms` - Many-to-many relationship between prompts and platforms
- `profiles.credits` - Per-user credits for AI image generation (see `supabase/ai-chat-migration.sql`)
- `chat_sessions` / `chat_messages` / `image_generations` - AI chat and generation history

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (recommended via [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn package manager
- Supabase account for database and authentication

### Environment Setup

1. **Clone the repository**
```bash
git clone <REPO_URL>
cd imgprompt
npm install
```

2. **Environment Variables**
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# Optional: for AI Image Chat (points to FastAPI backend)
VITE_API_URL=http://localhost:8000
```

3. **Database Setup**
Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor to create all necessary tables and policies. Then run `supabase/likes-migration.sql` for likes/favorites. For AI Image Chat, run `supabase/ai-chat-migration.sql` to add credits, chat_sessions, chat_messages, and image_generations.

4. **Start Development Server**
```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and prepare for deployment
- `npm run import:chatgpt-prompts` - Import ChatGPT prompts from JSON
- `npm run upload:chatgpt-prompts` - Upload local images and import prompts

## 📊 Data Management

### Importing Prompts

The project includes scripts to import ChatGPT image editing prompts:

1. **Basic Import** (uses external image URLs):
```bash
npm run import:chatgpt-prompts
```

2. **Upload & Import** (uploads local images to Supabase storage):
```bash
npm run upload:chatgpt-prompts
```

### Admin Access

1. Sign in with Google OAuth
2. Update your user role to 'admin' or 'editor' in the Supabase `profiles` table
3. Access admin features at `/admin`

### Platform Management

The system supports multiple AI platforms:
- **DALL-E 3** - https://chatgpt.com/
- **Stable Diffusion** - https://stablediffusionweb.com/
- **Midjourney** - https://www.midjourney.com/
- **Leonardo AI** - https://leonardo.ai/
- **Adobe Firefly** - https://firefly.adobe.com/

## 🚀 Deployment

### GitHub Pages

The repo includes `.github/workflows/deploy.yml` for automatic deployment:

1. In GitHub, go to **Settings → Pages** and choose **GitHub Actions** as source
2. Push to `main` branch or trigger workflow manually
3. Site will be available at `https://<username>.github.io/<repo-name>/`

### AI Image Backend (FastAPI) on Railway

To enable the **AI Image Chat** on the homepage (Replicate Flux integration):

1. **Run Supabase migration**  
   Execute `supabase/ai-chat-migration.sql` in the Supabase SQL editor.

2. **Backend env**  
   In `backend/`, copy `backend/.env.example` to `.env` and set:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
   - `REPLICATE_API_TOKEN` (from [Replicate](https://replicate.com/account/api-tokens))

3. **Run backend locally**  
   Use **Python 3.11 or 3.12**. Create and activate a virtual env first, then install and run:
   ```bash
   cd backend
   python -m venv .venv
   ```
   Then:
   - **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`
   - **Windows (CMD):** `.venv\Scripts\activate.bat`
   - **macOS/Linux:** `source .venv/bin/activate`
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
   On PowerShell you may need to allow scripts first: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

4. **Deploy to Railway**
   - Create a new Railway project and set **Root Directory** to `backend`.
   - Add env vars (same as above) in Railway dashboard.
   - Deploy; Railway will use `backend/Dockerfile`.
   - Set your frontend `VITE_API_URL` to the Railway URL (e.g. `https://your-app.railway.app`).

5. **Frontend**  
   Set `VITE_API_URL` in the repo root `.env` to your backend URL so the chat uses the deployed API.

### Custom Domain Setup

For custom domain (like `vibeimg.xyz`):

1. Update `public/CNAME` with your domain
2. Configure DNS settings with your domain provider
3. Update meta tags in `index.html`:
   - `canonical` URL
   - `og:url` property
   - Social image URLs

## 🎨 Customization

### Styling
- Colors and themes defined in `src/index.css`
- Component styles use Tailwind CSS classes
- Custom utilities: `.glass`, `.gradient-primary`, `.neon-glow`

### Adding New Categories
1. Use admin interface to create categories
2. Or add directly to Supabase `categories` table
3. Categories automatically appear in filters

### Platform Integration
1. Add platform to `platforms` table in Supabase
2. Update `platformUrls` object in components for click-to-launch functionality

## 🔧 Architecture

### Key Components
- `PromptCard` - Interactive prompt display with image carousel
- `CategoryFilter` - Category navigation with URL routing
- `AdminPromptForm` - Prompt creation/editing interface
- `LikesContext` - Global state for likes and favorites

### Data Flow
1. Prompts fetched from Supabase via TanStack Query
2. Real-time updates for likes/favorites
3. Image storage handled by Supabase Storage
4. Authentication managed by Supabase Auth

### URL Structure
- `/` - Main prompt library
- `/?category=category-slug` - Filtered by category
- `/?prompt=prompt-slug` - Direct prompt link
- `/favorites` - User's favorite prompts
- `/admin` - Admin dashboard
- `/admin/prompts` - Prompt management
- `/admin/prompts/new` - Create new prompt
- `/admin/prompts/:id` - Edit existing prompt

## 📱 SEO & Social

- **Meta Tags** - Comprehensive Open Graph and Twitter Card support
- **Social Preview** - Custom image at `public/social-card.jpg`
- **Structured Data** - JSON-LD for better search indexing
- **Sitemap** - Auto-generated for search engines
- **Category URLs** - SEO-friendly category filtering

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -m 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

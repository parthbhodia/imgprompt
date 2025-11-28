# ImgPrompt

ImgPrompt is a curated AI prompt library that pairs high-performing prompts with finished visuals, platform recommendations, and creative guidance so you can produce standout images faster.

**Live site:** https://vibeimg.xyz/

## Features

- Spotlight hero section with animated gradients and CTAs
- Search + category filters for instant discovery
- Interactive prompt cards showing images, copyable prompts, and supported AI tools
- Tips dialog that teaches newcomers how to iterate effectively
- Fully responsive layout with glassmorphism styling

## Tech Stack

- Vite + React + TypeScript
- React Router
- shadcn/ui + Tailwind CSS
- TanStack Query

## Local Development

```bash
git clone <REPO_URL>
cd <REPO_DIR>
npm install
npm run dev
```

> Requires Node.js 16+. For the smoothest experience, use Node 18+ via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

## Deployment (GitHub Pages)

The repo includes `.github/workflows/deploy.yml` which automatically deploys the `main` branch to GitHub Pages.

1. In GitHub, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push commits to `main` (or trigger the workflow manually from the **Actions** tab).
3. The workflow sets `GITHUB_REPOSITORY_NAME` so the Vite `base` path matches your repo automatically.
4. The site will be served from `https://<your-username>.github.io/<repo-name>/`.

### Custom Domain (`vibeimg.xyz`)

- `public/CNAME` locks the deployment to `vibeimg.xyz`.
- The GitHub Actions workflow exports `CUSTOM_DOMAIN=true`, forcing the Vite base path to `/`.
- If you change the domain, update:
  - `public/CNAME`
  - `canonical`, `og:url`, and social image URLs in `index.html`
  - Any references in this README

## SEO Notes

- Social preview image lives at `public/social-card.jpg` and is referenced with the absolute URL `https://vibeimg.xyz/social-card.jpg`.
- Update `index.html` meta tags whenever branding, description, or canonical URL changes.

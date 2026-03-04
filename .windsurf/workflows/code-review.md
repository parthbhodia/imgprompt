---
description: VibeIMG Code Review Workflow - Use this when a new PR or branch needs review
---

# VibeIMG Code Review Workflow

This workflow ensures high-quality, consistent code reviews for the VibeIMG image generation application.

## 1. Review Setup

- [ ] Check out the PR branch: `git fetch origin pull/{PR_NUMBER}/head:{BRANCH_NAME}`
- [ ] Open `git diff` against main to see all changes
- [ ] Read the PR description and understand the intent

## 2. Backend Review (if modified)

### API Endpoints (`backend/main.py`)
- [ ] Validate new endpoints have proper input validation
- [ ] Check authentication/authorization is enforced (`get_current_user_id`)
- [ ] Ensure proper error handling with HTTPException
- [ ] Verify database operations use Supabase correctly

### Image Generation (`backend/replicate_flux.py`)
- [ ] Check Flux model selection logic (flux-1.1-pro-ultra for txt2img, flux-dev for img2img)
- [ ] Verify image dimension validation (PATCH_SIZE = 16)
- [ ] Ensure proper error handling for Replicate API failures

### Configuration
- [ ] No secrets in code (use env vars)
- [ ] Proper validation of required settings

## 3. Frontend Review (if modified)

### React Components (`src/components/`)
- [ ] Check TypeScript types are defined
- [ ] Verify proper state management (useState/useEffect patterns)
- [ ] Ensure proper cleanup (URL.revokeObjectURL, event listeners)
- [ ] Check for memory leaks in useEffect

### API Integration (`src/lib/api.ts`)
- [ ] Verify fetchApi wrapper is used
- [ ] Check error handling with try/catch
- [ ] Ensure proper token handling for authenticated requests

### UI/UX
- [ ] Responsive design (mobile/desktop)
- [ ] Proper loading states and error messages
- [ ] Accessibility (aria-labels, semantic HTML)

## 4. Database Schema (if modified)

### Migrations (`supabase/`)
- [ ] Proper foreign key constraints
- [ ] Index on frequently queried columns
- [ ] Default values for required fields

## 5. Final Checklist

- [ ] No console.log statements left in production code
- [ ] No debug print statements in backend
- [ ] Proper git commit messages following conventional commits
- [ ] No large binary files in repo

## Review Feedback Format

Provide feedback as:

**APPROVED** - No issues found, ready to merge
**APPROVED with NITS** - Minor suggestions, author can decide
**CHANGES REQUESTED** - Issues must be fixed before merge

Include:
- Specific line numbers for issues
- Code suggestions in ```suggestion blocks
- Explanation of why the change is needed

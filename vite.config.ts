import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Get base path from environment variable or use default
  // For GitHub Pages: use repository name (e.g., /imgprompt/)
  // Set GITHUB_REPOSITORY_NAME environment variable or it will default to '/'
  const base = process.env.GITHUB_REPOSITORY_NAME 
    ? `/${process.env.GITHUB_REPOSITORY_NAME}/` 
    : '/';

  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

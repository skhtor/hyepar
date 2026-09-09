import { defineConfig } from "astro/config";

// Static output; deploys to Cloudflare Pages. Audio is served separately from R2.
export default defineConfig({
  site: "https://hyepar.sass.sh",
  output: "static",
  build: { format: "directory" },
});

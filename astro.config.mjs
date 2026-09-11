import { defineConfig } from "astro/config";

// Static output; deploys to Cloudflare Pages. Audio is served separately from R2.
export default defineConfig({
  site: "https://hyepar.sass.sh",
  output: "static",
  build: { format: "directory" },
  // Disable the dev toolbar so dev-mode HTML doesn't inject data-astro-source-*
  // attributes (which embed absolute local paths incl. the OS username). These
  // are dev-only and already stripped from production builds, but this keeps
  // local inspection identical to prod and leaks nothing.
  devToolbar: { enabled: false },
});

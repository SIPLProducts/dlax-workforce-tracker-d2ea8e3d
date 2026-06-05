// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Force the Nitro Cloudflare worker build on every machine (not just the Lovable
// sandbox). Without this, `bun run build` on a self-hosted box skips the nitro
// plugin and never produces dist/server/index.{js,mjs} or dist/server/wrangler.json,
// which install.sh requires to launch the worker under wrangler/PM2.
export default defineConfig({
  nitro: {
    preset: "cloudflare-module",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
    cloudflare: { nodeCompat: true, deployConfig: true },
  },
});

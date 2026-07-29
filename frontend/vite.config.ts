import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // PWA-5 splits the JavaScript per route. It must NOT split the CSS.
    //
    // The shared utility layer in this app — .page-header, .tabs, .empty-state,
    // .icon-btn, .text-secondary, the whole .mb-*/.mt-* scale — does not live in
    // components.css. It grew inside pages/Tasks/Tasks.css, and every other page
    // uses it. That worked only because every stylesheet ended up in one bundle.
    //
    // With cssCodeSplit on (the Vite default), each lazy route gets its own CSS
    // chunk containing just its own file, so opening /settings directly would
    // render it with no margins, no page header and no muted text. Keeping CSS
    // in one file is also the better call for a precached PWA: it is 29 kB for
    // the entire app against 535 kB of JavaScript, and one stylesheet loaded up
    // front means no flash of unstyled content when navigating between routes.
    //
    // The tidier fix is to hoist those utilities into components.css where they
    // belong; that is a refactor across eight stylesheets and its own change.
    cssCodeSplit: false,
  },
  plugins: [
    react(),

    // PWA-1 (manifest + icons) and PWA-2 (service worker).
    VitePWA({
      // 'prompt', not 'autoUpdate'. autoUpdate swaps the running code out from
      // under you the moment a deploy lands, which can reload the page while
      // you are mid-form. More importantly, Phase 1 shipped a schema migration
      // that the previous build could not write against — an old service worker
      // silently serving stale JS against a migrated database is exactly the
      // failure we want to be able to see and act on. UpdatePrompt.tsx renders
      // the banner.
      registerType: 'prompt',

      // No `includeAssets` here. Icons and fonts live in public/ and are already
      // matched by the widened `globPatterns` below; listing them in both places
      // put every one of them into the precache manifest twice.

      manifest: {
        id: '/',
        name: 'Life OS',
        short_name: 'Life OS',
        description:
          'Turn everyday habits, goals, and workouts into points you can cash in on yourself.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0E14',
        theme_color: '#0B0E14',
        categories: ['productivity', 'lifestyle', 'health'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Android crops this to whatever shape the launcher uses, so it is a
          // separate full-bleed drawing with the mark inside the 80% safe zone.
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Tasks & Goals', short_name: 'Tasks', url: '/tasks' },
          { name: 'Log a workout', short_name: 'Exercise', url: '/exercise' },
          { name: 'Finance Hub', short_name: 'Finance', url: '/finance' },
        ],
      },

      workbox: {
        // The default pattern omits woff2 and webmanifest, which would leave an
        // installed app fetching its own fonts over the network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],

        globIgnores: [
          // public/fonts ships its licence and provenance notes; they are
          // served for attribution, not needed offline.
          '**/fonts/*.txt',

          // The plugin injects manifest.webmanifest and every icon listed in
          // `manifest.icons` above into the precache itself. Letting the glob
          // match them too listed each one twice. Anything in public/icons that
          // the manifest does NOT reference — favicon.svg, apple-touch-icon.png
          // — is still picked up by the glob, which is exactly what we want.
          'manifest.webmanifest',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-maskable-512.png',
        ],

        // BrowserRouter means /tasks and /settings are not real files. Every
        // navigation resolves to the precached shell, matching the SPA rewrite
        // in vercel.json.
        navigateFallback: 'index.html',

        // Drop precaches from previous deploys instead of accumulating them.
        cleanupOutdatedCaches: true,

        // Deliberately NO runtimeCaching for the Supabase API.
        //
        // DESIGN.md suggested stale-while-revalidate for data. That is wrong
        // here for two reasons. First, every response is RLS-scoped to the
        // signed-in user, and the Cache API is keyed by URL alone — sign out,
        // sign in as someone else, and the same URL would serve the previous
        // account's rows. Second, a points tracker that shows a stale balance
        // is lying, which is the exact class of bug Phase 1 was about.
        //
        // Cross-origin requests are not precached by default, so leaving this
        // empty means Supabase always goes to the network. The offline story is
        // "the app shell launches instantly"; making writes work offline is
        // PWA-4 and needs a real IndexedDB queue, not a cache heuristic.
      },

      // Keep the service worker out of `npm run dev`. A SW that caches during
      // development is a great way to spend an hour debugging your own stale
      // bundle.
      devOptions: { enabled: false },
    }),
  ],
})

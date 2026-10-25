# User requirements

- This is a personal Japanese study tool. Use concise Russian labels and explanations; no greetings, slogans, motivational copy or decorative promotional sections.
- Canonical repository: `git@github.com:hb3p8/jap-learn.git`, checkout `/Users/hb3p8/projects/jap-learn`.
- The user authorized private Cloudflare Workers hosting, using the existing synchronization key to unlock the app. Serve the app and original Genki recordings only through the authenticated Worker; `assets.run_worker_first` must remain `true`. Do not use Sites hosting.
- GitHub Pages is now only a migration bridge for the former origin. Publish `.pages-build/` there, never `dist/` or original course recordings.
- Keep the local preview available at `http://localhost:4173`.
- Synchronization uses Cloudflare Workers + D1. Preserve the existing database, key, learning progress and unfinished sessions. After each change save locally and send automatically, retrying transient failures.
- Only the SHA-256 key hash is deployed as a Worker secret. Never publish the key, `.dev.vars`, `.local/`, account credentials, progress snapshots, or `dist/assets/genki/`. The public Worker URL can be committed.
- Use the supplied local Genki second-edition collection for course material; the user requested hosted private audio without per-device imports.
- Mobile layouts must work at 320px and 390px without horizontal scrolling. Use a consistent plain Japanese sans-serif font.

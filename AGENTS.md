# User requirements

- This is a personal Japanese study tool. Use concise Russian labels and explanations.
- Keep the interface focused on lessons, audio, answers, errors and progress. Avoid greetings, slogans, motivational messages, growth metaphors and decorative promotional sections.
- Canonical repository: `git@github.com:hb3p8/jap-learn.git`, checkout `/Users/hb3p8/projects/jap-learn`.
- GitHub Pages publication is authorized by the user. Publish static assets from `dist/` via the repository workflow. Do not use Sites hosting.
- Keep the local preview available at `http://localhost:4173`.
- Synchronization uses Cloudflare Workers + D1. Access is protected by a random per-user key; only its SHA-256 hash is deployed as a Worker secret. Never publish the key, `.dev.vars`, `.local/`, account credentials, or progress snapshots. The public Worker URL can be committed.
- Preserve saved learning progress when changing the interface.
- Mobile layouts must work at 320px and 390px without horizontal scrolling; exercise controls must be easy to tap.

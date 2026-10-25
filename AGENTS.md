# User requirements

- This is a personal Japanese study tool. Use concise Russian labels and explanations.
- Keep the interface focused on lessons, audio, answers, errors and progress. Avoid greetings, slogans, motivational messages, growth metaphors and decorative promotional sections.
- Canonical repository: `git@github.com:hb3p8/jap-learn.git`, checkout `/Users/hb3p8/projects/jap-learn`.
- GitHub Pages publication is authorized by the user. Publish static assets from `dist/` via the repository workflow. Do not use Sites hosting.
- Keep the local preview available at `http://localhost:4173`.
- Google Sheets integration uses user OAuth with `drive.file`, never service-account keys or client secrets in browser code. OAuth consent is performed by the user. A missing Client ID is expected until configured.
- Preserve saved learning progress when changing the interface.
- Mobile layouts must work at 320px and 390px without horizontal scrolling; exercise controls must be easy to tap.

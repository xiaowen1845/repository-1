# Simulator development

- Repository: https://github.com/xiaowen1845/repository-1
- Run all application commands from `gobo-simulator/`, not the repository root.
- Keep development on `codex/*` or another feature branch. Vercel Production tracks `main`.
- Do not push, merge into `main`, run production deployment commands, change Vercel settings/domains, or edit Shopify embeds without an explicit release request from the user.
- Current known live URL: https://simulator.gobosolution.com/
- Vercel project: `xiaowen1845s-projects/repository-1`. Verified from user screenshots: Production tracks `main`; Root Directory is `gobo-simulator`; Node.js is `24.x`; unassigned Git branches use Preview with no custom domains. Environment variables, Preview service isolation and the Shopify embed configuration remain unverified. Current project checks use Node.js 24.22.0; .nvmrc pins that version and package.json engines specifies 24.x. Use that runtime rather than the system Node.js 26. See LOCAL_DEVELOPMENT.md for npm exec commands.
- Use the npm lockfile. Avoid dependency upgrades unrelated to the requested change.
- Before handoff, run lint, TypeScript checking and production build as appropriate. Run the shared rule regression tests and smoke-test the three-step flow for UI/canvas changes.
- Never commit `.env*`, `.vercel/`, credentials, `node_modules/` or generated `.next/` output.
- See `LOCAL_DEVELOPMENT.md` for the migration baseline and known issues.

- Simulator V2 recommends one projector from actual distance, target diameter, environment and ambient light. Use automatic lens matching by default; fixed lenses are an advanced option. Visual placement and brightness never affect selection. Link the verified product page as primary action, quote as secondary, and existing Finder as a text link. Do not display GOBO sizes or hard-coded prices. This supersedes the earlier Finder-only conversion design.
- Shared selection rules: `gobo-simulator/lib/projector-rules.ts`. Use canonical metres; 0.3 lens is High-Power only. Product capabilities and empirical wattage tables are owner-provided; do not invent replacements.
- Scope is Simulator only. The user-provided Finder code is read-only reference for capabilities and selection rules. Do not develop or deliver a separate Finder implementation.
- Required validation for rule changes: `npm test` (shared rule regressions), `npm run lint`, and `npm run build`, all under Node.js 24.22.0.
- See `V2_DEVELOPMENT.md` for the current implementation, QA and outstanding release checks.

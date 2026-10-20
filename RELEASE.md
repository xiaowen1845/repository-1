# Simulator V2 release — 2026-10-20

The owner authorized deployment after validation. Release from `codex/local-development` through a pull request to `main`; the existing Vercel integration publishes `gobo-simulator/` to https://simulator.gobosolution.com/. GitHub deployment status is the authoritative release record.

## Change

Indoor/Outdoor scene selection, PNG/JPG/SVG artwork previews, independent visual controls, automatic projector/lens selection from actual distance and target diameter, stable metre/feet conversion, and direct links to the verified store product pages. The store logo, favicon and locally served Archivo fonts provide consistent branding.

## Release checks

- Node.js 24.22.0; Next.js and eslint-config-next 16.4.2; Fabric 7.4.0. React remains 19.2.3.
- 11 rule regression tests, ESLint, TypeScript and production build passed.
- Production dependency audit on 2026-10-20: zero known vulnerabilities (`npm audit --omit=dev`).
- The dependency changes address published Next.js / Fabric advisories and compatible transitive fixes. See [Next.js advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) and [Fabric advisory](https://github.com/advisories/GHSA-w22m-hvvm-xmwx).
- Development-only audit retains five linked high-severity findings in the ESLint glob toolchain, rooted in [braces pattern recursion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No compatible remediation was offered by npm; the suggested forced fix would downgrade the Next ESLint configuration to v14. This chain is absent from the production dependency graph. No forced downgrade was applied.

## Previous production baseline

- Commit: `17c2c66fc8944a4bf13f6e948cbbca4e7ec1d8c4`
- GitHub deployment: `4101743413`
- Vercel deployment: `6BfqCy1RiYQhvnLbtsUsYePU5sXX`
- Deployment URL: https://repository-1-1txt8ddsu-xiaowen1845s-projects.vercel.app

Retain this baseline and the merged release PR for an auditable rollback. Do not force-push production history.

## Scope

The existing Shopify embed, domain configuration and online Projector Finder are unchanged. Scene/logo/screenshot transfer to the quote page remains a future enhancement.

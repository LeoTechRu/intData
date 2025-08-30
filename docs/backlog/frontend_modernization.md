# Frontend Modernization Plan

## Current State
- FastAPI serves pages using Jinja templates in `web/templates`.
- Static assets live in `web/static`; TypeScript compiles via bare `tsc` without bundling (`web/tsconfig.json`).
- `web/package.json` lists React and Tailwind, but React is used only in isolated TSX modules.
- Tailwind config references templates and JS files with minimal tooling.

## Proposed Stack
Select a single modern framework for the whole frontend:
- **React + Vite** for a lightweight SPA build.
- **Next.js** for React with built-in SSR/SSG.
- Alternative options (SvelteKit, SolidStart) if they offer clear advantages.

Decision criteria: developer experience, performance, ecosystem, integration with FastAPI API.

## Migration Strategy
1. Research and choose the final stack.
2. Scaffold a new frontend project under `web/` or a separate `frontend/` directory.
3. Configure TypeScript, Tailwind and component library within the chosen framework.
4. Implement base layout and shared UI components.
5. Gradually port existing pages and widgets from Jinja templates to components.
6. Replace scattered JS/TS utilities with centralized modules in the new framework.
7. After each page migration, remove corresponding templates and scripts.
8. Purge legacy assets from `web/static` and adjust Tailwind content paths.
9. Add linting/formatting and basic frontend tests.

## Deprecation & Cleanup Plan
- Maintain a checklist of migrated pages and deleted assets.
- Remove unused dependencies from `package.json` once migration stabilizes.
- Add tooling to detect dead assets and enforce cleanup.
- Document progress and removals in `CHANGELOG.md`.

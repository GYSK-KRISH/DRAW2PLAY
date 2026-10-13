# THINK-TO-PLAY / DRAW2PLAY — Monorepo Foundation

## Phase 1 goal
Introduce workspace and build-orchestration conventions without moving or rewriting the currently working application. The existing root package remains the application entry point during this foundation phase.

## Workspace layout

- `apps/*` — deployable applications (creator web, player, API, model worker, admin dashboard).
- `packages/*` — reusable domain contracts, schemas, game core, runtimes, AI gateway, assets, security, and shared utilities.
- `services/*` — separately deployable generation and publishing services when they need independent lifecycles.

Only directories containing a `package.json` become actual pnpm workspace projects. Add each project when its source and dependency boundaries are ready; do not create empty placeholder apps just to make the tree look complete.

## Build conventions

- `pnpm-workspace.yaml` defines workspace discovery.
- `turbo.json` defines dependency-aware build, lint, test, and persistent development tasks.
- `tsconfig.base.json` is the shared TypeScript baseline; leaf projects should extend it and declare their own `rootDir`, `outDir`, and environment-specific types.
- The root package's existing scripts are intentionally retained until app extraction is ready.

## Migration rules

1. Keep `main` runnable; perform migration work on feature branches and merge through pull requests.
2. Extract contracts before consumers: `packages/game-schema` and `packages/game-spec` should become the source of truth before the runtime or API is moved.
3. Shared packages must not import from `apps/*` or `services/*`.
4. Browser code must never contain provider API keys. AI providers remain behind server-side interfaces.
5. Do not commit local generated projects, uploaded assets, model caches, or secrets. Use `storage-local/` only for ignored development data.
6. Do not move the full source tree in one large change. Each extraction should preserve the existing root commands until the replacement workspace command is verified.

## Next phases

- **Phase 2:** define and validate the canonical game schema/spec package; add compatibility adapters for the current scene and plan types.
- **Phase 3:** extract the Phaser runtime behind the canonical game spec.
- **Phase 4:** isolate the API server and provider integrations.
- **Phase 5:** project storage, asset provenance, publishing, and usage metering.
- **Phase 6:** introduce the 3D runtime and large-world generation only after the 2D path remains stable.

## Validation status

This commit adds repository configuration and migration documentation only. It does not claim that the application has been installed, built, linted, or tested in this environment. Run `pnpm install` to generate `pnpm-lock.yaml` and validate the current root scripts before beginning source extraction.

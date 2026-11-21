# Shared AI Hub account and workspace

Tailwind 4 consumers must pass `clerkCssLayerName="clerk"`, declare the Clerk
layer before Tailwind utilities, import the Clerk theme stylesheet, and disable
Tailwind's CSS optimization for nested theme layers. Leave the option unset for
Tailwind 3 consumers.

Both AI Hub artifacts and Signal Room render `HubApp` from this package. Change account routing,
customer-scoped cache creation, conversations, comparison behavior, sidebar
actions, settings controls, toast behavior, and their actively used UI primitives
here rather than editing two copies.

The original paths in each artifact are compatibility re-exports only. Unused
template components remain artifact-local; they are not additional implementations
of the active workspace.

## Artifact-owned configuration

Each artifact's `src/App.tsx` supplies its own:

- Landing component and original styles/brand assets.
- Wouter base path and Clerk publishable-key/proxy wiring.
- Immutable `createHubDataClient` adapter.
- Optional force-redirect URL (Motion retains its workspace redirect; the
  original app retains its existing default Clerk redirect behavior).
- Optional account observer (Motion's privacy-safe conversion observer only).

AI Hub uses `/api/hub`; Motion uses `/ai-hub-motion/api/hub`. There is no mutable
global API namespace. API credentials remain same-origin cookies, not mobile
bearer tokens. Every authenticated identity gets a fresh query cache, as before.

Neither artifact imports the other. This package imports neither artifact,
contains no database client, and does not change backend ownership rules.

Signal Room supplies its existing workspace through the optional `Workspace`
slot and `workspaceAtRoot`, preserving `/signal-room/`. Its account shell shares
the same identity-keyed query-provider remount and old-cache cleanup. Replacing
only the query-client value is not sufficient: account transitions must reset
workspace component state and query observers as well.

## Styles

All stylesheets stay in their original artifacts, in the original import order.
Both Tailwind configurations scan this package's source so moving a component
does not silently remove its generated utility classes.

## Checks

```sh
pnpm run typecheck
pnpm --filter @workspace/ai-hub-ui test
pnpm --filter @workspace/ai-hub-motion run test:analytics
```

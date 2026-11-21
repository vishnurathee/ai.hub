# Account privacy and request limits

All conversation, message, provider and comparison routes under `/api`,
`/api/hub`, and Motion's `/ai-hub-motion/api/hub` require the existing Clerk
session. `/api/healthz` and Clerk's own authentication proxy remain public.
API responses are private/no-store. Mutations require a same-origin browser
request; cross-site mutations are rejected.

Customer records always use the authenticated owner, never an ID supplied in a
request body. Customer accounts cannot change global provider configuration.
Provider credentials stay server-side in workspace Secrets.

## Legacy history

Pre-login conversations/comparisons with a null owner remain in place. They are
not exposed by any customer route and are not assigned on first sign-in. There
is no public legacy recovery endpoint. Recovery requires a separate verified
ownership/creator-review process; do not infer ownership from record contents.
No existing conversation data is rewritten by this change.

## Limits

Counters are atomic PostgreSQL reservations shared by all aliases, processes
and restarts, not per-process memory limits:

| Request class | Per-account minute | Per-account hour | Workspace hour |
| --- | ---: | ---: | ---: |
| AI provider units | 8 | 40 | 200 |
| API write attempts | 30 | 300 | 3,000 |

One AI request reserves one unit; a comparison reserves one per distinct
selected provider, including failed/configuration-error outcomes. Retries
reserve units too. Unauthorized/invalid requests cannot reach providers.
Denied reservations roll back all partially charged buckets. Counters contain
only account identifiers, counts and expiration times, never prompt content.
Expired counters are removed opportunistically within their own namespace.

Prompts are limited to 8,000 characters, comparisons to six distinct providers,
and request bodies to 64 KB. Composers preserve over-limit drafts instead of
silently discarding them. Gemini output, including the labeled Grok preview, is
capped at 1,024 tokens; other live services retain their existing output caps.

Exhausted budgets return 429 plus `Retry-After`. If counter storage fails,
requests fail closed with 503 before provider access. These are request limits,
**not a monetary spending cap**: review them and provider-side billing limits
before broad public sharing.

## Schema and checks

The only new table is `ai_usage_buckets`. Apply the development schema through
the normal Drizzle push/post-merge flow; publish/republish applies the managed
production schema. Never add startup or deployment-build migration code.

`pnpm --filter @workspace/api-server run test:security` creates uniquely named
development fixtures, checks ownership and concurrent quota enforcement
without calling providers, and removes its fixtures. It refuses production
mode. The existing workspace and signup analytics regression suites still apply.

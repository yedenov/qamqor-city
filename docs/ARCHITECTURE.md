# Architecture and invariants

## Application boundary

Qamqor City is a static, browser-local application. `index.html` loads `app.js`, which imports a domain module, curated sample content and a small visual system. Hash-based routes keep deployment compatible with ordinary static hosting and repository subpaths.

The browser layer handles DOM rendering, input, file selection, download and localStorage. The pure domain layer is usable directly in Node.js tests. There is no network-backed application data store.

## Routes

| Route | Purpose |
| --- | --- |
| `#/home` | Overview and entry into core workflows |
| `#/initiatives` | Search and filter catalog |
| `#/initiative/:id` | Initiative details and participation |
| `#/map` | Interactive illustrative map |
| `#/calendar` | Monthly date filtering |
| `#/create` | Validated local idea creation |
| `#/participation` | Plans, saved items, local initiatives and notes |
| `#/impact` | Derived metrics and personal achievements |
| `#/guides` | Resource directory |
| `#/guide/:id` | Structured guide article |
| `#/profile` | Local profile and data controls |

Unknown and inherited-object route keys render a recoverable not-found view. Skip navigation focuses the main content without changing the application hash.

## State

The versioned state document has `app: "qamqor-city"`, `version: 1`, a profile, saved and joined initiative IDs, completed task IDs, locally created initiative records, catalog filters, and an initiative-ID-to-note dictionary. Seed content is read from source, not duplicated into every saved record.

Core invariants:

1. An initiative must exist before it can be joined or saved.
2. Repeated joins are idempotent; IDs are deduplicated.
3. A completed task must belong to an initiative in the current personal plan.
4. Removing an initiative removes its task completion marks, while retaining the user's reflection.
5. Metrics are derived from valid current records. There are no mutable totals that can drift.
6. Created records receive an application-owned ID and task template. Supplied task or map fields cannot change those definitions.
7. No user text is inserted as unescaped markup.

## Import trust boundary

Import accepts at most 500,000 bytes from the file picker and bounds the raw string in the domain function. It checks application identity, schema version, profile fields, record and text limits, dates, time, categories, districts, references and task ownership. The limit is 100 locally created initiatives. Imported created records are reconstructed using validated fields; unexpected properties are discarded. Arrays of reference IDs normalize duplicates. Prototype keys cannot enter notes because keys must correspond to known initiative IDs.

Markup characters may exist as literal text: they are escaped when rendering. This supports ordinary punctuation without treating an HTML-like title as executable content.

After validation, the UI asks before replacing current state. A failed import leaves the current state untouched. Invalid startup storage recovers to a clean workspace with a notice.

## Metrics

- Joined count: initiatives whose IDs appear in the personal plan.
- Done count: known tasks in joined initiatives with a completion mark.
- Completion percentage: rounded `done / total * 100`, or zero for an empty plan.
- Finished count: joined initiatives with every defined task complete.
- Category chart: completed tasks grouped by the initiative's category.
- Planned hours: sum of catalog duration fields for joined initiatives; not a time tracker or verified volunteer hours.

Achievements use these same local observations: first joined initiative, one completed plan, and participation spanning three categories. They have no certification status.

## Styling and accessibility

The visual system uses forest green, warm off-white, muted lime and clay accents. Original SVG scenes depict neighbors and green spaces. Functional text is darkened independently of decorative color. Layouts adapt to desktop, tablet and mobile; the sidebar becomes a toggleable navigation panel.

The UI includes labelled inputs, visible focus, semantic navigation, keyboard-operable buttons, status toasts, form errors, selected/pressed states, skip navigation, dialogue focus trapping and reduced-motion support. Manual review is still required for screen-reader behavior and full accessibility conformance.

## Serving and deployment

The local Node server allows GET/HEAD only, resolves paths within `dist`, returns correct MIME types, and binds to loopback. A server rewrite fallback is unnecessary because navigation uses the URL hash.

The application can be deployed by serving `dist/` as static assets. If a hosting integration creates project identity/configuration under `.openai`, keep that identity bound to its specific Site. Do not copy hosting credentials into this repository.

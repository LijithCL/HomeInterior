# Home Interior & Exterior Design Platform — Architecture Analysis

Status: pre-implementation analysis. No application code has been written yet.
This document is the living reference for the platform's architecture. It will
be updated as phases are implemented; it is not a one-time plan.

---

## A. System Architecture (high level)

```
                                ┌─────────────────────┐
                                │  Static file server   │
                                │  (Nginx/Express       │
                                │   serving local disk) │
                                └──────────┬───────────┘
                                           │ static assets, textures, models, renders
                     ┌─────────────────────┼─────────────────────┐
                     │                     │                     │
              ┌──────▼──────┐      ┌───────▼───────┐     ┌───────▼───────┐
              │  Web App    │      │  Object Store │     │  Render Worker │
              │  (Next.js)  │      │  (local disk, │     │  farm (Node/   │
              └──────┬──────┘      │   volume-     │     │  headless GL)  │
                     │             │   mounted)     │     └───────▲───────┘
                     │ REST + WS   └───────────────┘             │
              ┌──────▼──────────────────────────────┐    jobs      │
              │        API Gateway / BFF            │──────────────┘
              │        (NestJS)                     │
              └──────┬───────────────┬───────────────┘
                     │               │
              ┌──────▼─────┐  ┌──────▼──────┐   ┌────────────────┐
              │ PostgreSQL │  │  Redis      │   │  Message Queue  │
              │ (primary   │  │ (cache,     │   │  (BullMQ/SQS)   │
              │  data)     │  │  sessions,  │   │  render jobs,   │
              └────────────┘  │  pub/sub)   │   │  AI jobs        │
                               └─────────────┘   └────────┬────────┘
                                                           │
                                                  ┌────────▼────────┐
                                                  │  AI Service      │
                                                  │  (LLM + vision)  │
                                                  └─────────────────┘
```

Core principles:

1. **Separation of editor state from persistence.** The 2D/3D/4D editor runs
   entirely client-side against an in-memory scene graph; the backend only
   sees serialized "design documents" (JSON) on save/autosave. This keeps
   editing latency at 0 network round-trips.
2. **Backend is a thin, well-typed API over Postgres + local disk
   storage.** No business logic lives in the 3D engine that the backend
   needs to duplicate — the backend validates and stores; the client
   renders and edits.
3. **Heavy compute (rendering, AI) is asynchronous**, via job queue + worker
   pool, never inline in a request/response cycle.
4. **Assets are data, not code.** New furniture/materials/templates are
   added via an admin CRUD + upload to local storage, never a code deploy.
5. **Monorepo** so frontend, backend, and shared types (design-document
   schema, DTOs) stay in lockstep — this matters enormously here because the
   3D scene-graph shape is shared between client (renderer) and server
   (validator/renderer worker).

---

## B. Technology Stack (with rationale)

| Layer | Choice | Why |
|---|---|---|
| Monorepo tooling | Turborepo + pnpm workspaces | Fast incremental builds, shared `packages/schema` types between web/api/worker |
| Frontend framework | Next.js 14 (App Router) + TypeScript | SSR for dashboard/marketing/SEO pages, CSR for the editor itself, one deploy target, good DX |
| 2D canvas | **Konva.js** (via `react-konva`) | Purpose-built retained-mode 2D canvas with built-in transformers, snapping, hit-testing — far less custom math than raw `<canvas>`/SVG for a CAD-like floor-plan editor |
| 3D engine | **Three.js via React Three Fiber (R3F)**, `@react-three/drei`, `@react-three/fiber` | R3F gives declarative scene graph that maps cleanly onto our design-document tree (House→Floor→Room→Object), integrates with React state/undo system, huge ecosystem (drei helpers: TransformControls, gizmos, environment maps). Babylon.js is a valid alternative (better built-in editor tooling) but R3F's React-native composition model fits our component-per-object architecture better and has a larger web talent pool. |
| 2D/3D shared math | `three` math classes reused in 2D layer via projection, OR keep 2D independent with its own Vector2 — **decision: keep 2D (Konva) and 3D (Three) as independent renderers of the same design document**, not one derived from the other. Simpler mental model, avoids leaky abstractions. |
| State management | **Zustand** for scene/editor state, **TanStack Query** for server state (projects, assets, auth) | Zustand's small footprint + selector-based subscriptions are critical for editor perf (avoid re-rendering the whole R3F tree on every drag frame). Redux would work but adds ceremony without benefit here. |
| Undo/redo | Custom command-pattern history stack (see §23) backed by Zustand's `temporal` middleware or a bespoke patch-based history (Immer patches) | Command objects are also the natural unit for future real-time collaboration (CRDT-able) |
| Styling/UI | Tailwind CSS + shadcn/ui (Radix primitives) | Fast to build professional CAD-like panels, accessible primitives, no fighting a heavy component lib |
| Backend framework | **NestJS** (Node.js + TypeScript) | Opinionated modular architecture (modules/controllers/services/DI) matches the many bounded contexts (auth, projects, assets, ai, render); built-in support for guards (RBAC), pipes (validation), WebSockets gateway, queues |
| API style | REST for CRUD, dedicated WebSocket gateway for autosave/presence/future collab, no GraphQL in MVP | REST is simplest to secure/rate-limit/version; GraphQL's benefit (flexible querying) isn't needed since the frontend has few, well-known query shapes. Revisit GraphQL only if collaboration/BFF fan-out gets complex. |
| ORM | **Prisma** | Type-safe client generation feeding directly into NestJS DTOs and the shared TS types used by the frontend; migrations are simple to review |
| Primary DB | PostgreSQL 15+ | Relational integrity for House/Floor/Room/Object hierarchy, JSONB columns for flexible per-object properties, strong indexing, mature |
| Cache/session/pubsub | Redis | Session store, autosave debouncing, WS pub/sub fanout, render-job status cache |
| Object storage | **Local filesystem** — a `storage/` directory on the API host (or a Docker named volume), behind a `StorageService` abstraction with one implementation (`LocalDiskStorageProvider`) | No cloud/S3 cost. 3D models (GLB/GLTF), textures, thumbnails, exports, renders are written to disk under `storage/{bucket}/{key}` and served back via signed, time-limited download URLs generated by the API — never stored in Postgres, never served as raw static files without a signature check. The abstraction (`put/get/delete/getSignedUrl`) is the same shape S3's SDK exposes, so swapping in real S3/R2/MinIO later (once there's budget or multi-instance scaling need) is a config change + a new provider class, not a rewrite of any caller. |
| CDN | None in MVP — static file responses get long-lived `Cache-Control` headers from the API/Nginx layer instead | A CDN has no local-storage equivalent and isn't needed at single-server scale; revisit only if serving assets becomes a bottleneck or the deployment moves to multi-region |
| Queue | BullMQ on Redis (MVP) → SQS if scaling beyond single-region | Render jobs, AI jobs, export jobs |
| Auth | Auth.js (NextAuth) on the frontend edge + JWT verified by NestJS guards, or a dedicated auth module in NestJS issuing JWT/refresh — **decision: NestJS-native auth (Passport + JWT)** so the same auth service protects REST, WS, and future mobile clients uniformly | Avoids splitting auth logic between two frameworks |
| AI/LLM | Anthropic Claude (Sonnet for prompt-to-design structuring, vision-capable call for image-to-design analysis) via a dedicated `ai-service` module | Structured-output tool-calling maps well to "generate a design-document JSON from a text prompt" |
| Rendering workers | Headless Node + `three`/`gl` (or a dedicated Blender/Cycles pipeline for "final" photorealistic tier later) | MVP preview/HQ renders can be done by re-using the R3F scene server-side with `puppeteer`/headless Chrome screenshot, or `three`+`node-canvas`. Photorealistic "final" tier is a Phase 5+ concern and can be swapped to a Blender headless pipeline without touching the API contract (render jobs are opaque to the API). |
| Infra/deploy | Docker Compose on a single VPS (e.g. a low-cost droplet/VM) for MVP — API, worker, Postgres, Redis, and the `storage/` volume all on one host; move to managed cloud (and optionally real S3) only when traffic/team size justifies the cost | Zero cloud-provider spend; a single host is enough until there's real load, and the storage abstraction (above) means "add S3 later" doesn't require re-architecting |
| Observability | OpenTelemetry + a hosted backend (Grafana Cloud/Datadog), Sentry for error tracking | |

---

## C. 2D Editor Architecture

**Rendering:** Konva `Stage` → one `Layer` per concern (grid, walls, rooms,
objects, dimensions/overlay, selection). Objects are Konva nodes bound
1:1 to entries in the design-document's `objects` array via React
reconciliation (`react-konva`), so React state is the single source of
truth — Konva never owns state Konva doesn't already get from props.

**Core systems:**
- **Grid & units**: grid drawn at a configurable pixel-per-unit scale;
  unit system (mm/cm/m/in/ft) is a display-layer concern only — all
  internal storage is in millimeters (integers) to avoid floating-point
  drift across conversions.
- **Wall model**: walls are stored as line segments with thickness, not as
  filled polygons; room polygons are derived (or explicitly authored) and
  wall-join geometry (miter corners) is computed at render time — this
  keeps the data model editable (drag one wall, joints recompute) rather
  than baking geometry.
- **Snapping engine**: a pure function `snap(candidatePos, sceneGraph,
  options) -> snappedPos` run on every drag-move event; checks, in order:
  grid snap → wall-surface snap → object-edge alignment → angle snap
  (0/45/90°) for wall drawing. Pure/stateless so it's unit-testable and
  reusable in 3D placement validation.
- **Selection & transform**: Konva `Transformer` node per selection,
  constrained to uniform vs. per-axis scaling per object type (e.g. doors
  don't free-scale, furniture width/depth can).
- **Dimension/measurement overlay**: computed from the same scene graph,
  rendered as its own non-interactive layer so it never interferes with
  hit-testing.
- **Doors/windows on walls**: modeled as children of a wall with a
  1D offset + width along the wall's length, not free XY objects — this
  makes "door snaps into wall" a data-model guarantee, not a runtime
  collision check.

**2D and 3D read the same design document** — a wall drawn in 2D
immediately has a 3D representation (extruded by wall height) with no
separate authoring step. This dual-view consistency is why the design
document (§F) models walls/rooms/objects generically rather than as
2D-specific or 3D-specific shapes.

---

## D. 3D Engine Architecture

**Rendering:** React Three Fiber scene tree mirrors the design-document
tree: `<House><Floor><Room><Walls/><Objects/></Room></Floor></House>`,
each level a thin component mapping document nodes to Three.js
primitives/instances. Actual furniture geometry is loaded GLTF (`useGLTF`
from drei, via `<Suspense>` boundaries per object so slow-loading assets
don't block the scene).

**Core systems:**
- **Scene graph ↔ document sync**: one-directional document → scene
  (Zustand state drives R3F props); user interactions (TransformControls
  drag) write back into the document store through the same command/undo
  pipeline as the 2D editor, so both editors share one history stack.
- **Camera system**: a `CameraRig` component swapping between
  `PerspectiveCamera`/`OrthographicCamera` and preset controllers
  (OrbitControls for orbit/exterior, PointerLockControls for
  walkthrough/first-person, fixed ortho for top/front/side).
- **Transform controls**: drei `TransformControls` gizmo bound to the
  selected object; writes go through the same `snap()` function as 2D
  (shared package) plus a 3D-specific collision/placement check (bounding
  box overlap against walls/floor).
- **Materials/lighting**: PBR materials (`MeshStandardMaterial`/
  `MeshPhysicalMaterial`) driven by the Material Library (§21) metadata
  (albedo/normal/roughness/metalness texture URLs); lighting rig built
  from `directionalLight` (sun) + `ambientLight`/environment map, swapped
  by the time-of-day system (§13/E).
- **Performance**: instancing (`InstancedMesh` via drei's `Merged`/
  `Instances`) for repeated assets (chairs, tiles), LOD (`three`'s
  `LOD` object or manual distance-based swap) for furniture models,
  frustum culling per-room (don't render rooms/floors not in view — hide
  floors above/below current unless "view all floors" is toggled), texture
  compression (KTX2/Basis via `three`'s `KTX2Loader`), and Web Workers for
  any heavy geometry processing (e.g. wall-boolean operations) via
  `comlink`.
- **View modes**: wireframe/solid/rendered are just material overrides
  applied scene-wide (a "view mode" context swaps material props, not
  separate scenes).

---

## E. 4D / Time-Based Architecture

4D is modeled as **a timeline of document deltas / phase snapshots**, not
a spatial dimension:

- **Construction timeline**: each `ProjectPhase` (Phase 1..N, or explicit
  day numbers) references a *predicate* over the design document — "which
  objects/elements exist and at what construction-completeness" — stored
  as `visible_from_day` / `phase_tag` metadata on document nodes (walls,
  roof, objects). The timeline UI is a slider driving a single derived
  value `currentDay`; the 3D scene filters/interpolates visibility and
  material state (e.g. unpainted → painted) based on `currentDay` vs. each
  node's phase metadata. No separate "4D document" — one document,
  time-parameterized rendering.
- **Sun/day-night**: pure function of time-of-day → sun `directionalLight`
  position + color temperature + sky/environment map, independent of the
  construction timeline (different "4D" axis, same slider UI pattern).
- **Seasonal exterior**: swaps a small set of environment presets
  (foliage material/color, sky) keyed by season, same pattern.

This keeps 4D cheap to implement: it's a *view/query* layer over the
existing document rather than new persisted geometry, which matters for
Phase 6 scoping (§46).

---

## F. Database ER Diagram & Schema

Design principle: **structural entities (house/floor/room/wall) are
normalized rows** for querying/validation/permissions; **object placement
and free-form properties live in JSONB** on the object row (position,
rotation, scale, material overrides) to avoid an explosion of narrow
tables for every property, while `asset_id`/`material_id` stay as real FKs
for integrity and search.

```
users ──┬──< projects >──┬── project_permissions >── users
         │                 │
         │                 └──< design_versions
         │
         └──< shared_designs

projects ──< houses ──< floors ──< rooms ──┬──< walls ──< wall_openings (door/window instances)
                                             ├──< scene_objects  (furniture/appliance/decoration instances)
                                             └──< room_finishes  (floor/ceiling material refs)

asset_categories ──< assets ──< asset_variants (color/material options)
materials ──< textures
scene_objects.asset_id -> assets.id
scene_objects.material_id -> materials.id (override)
wall_openings.asset_id -> assets.id (door/window model)

templates ──< template_documents (snapshot of a full design document)

ai_requests ── project_id, user_id, prompt, response_document_id
render_jobs ── project_id, requested_by, status, output_url
```

### Key tables (abbreviated DDL intent, Prisma-style)

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role     @default(CUSTOMER)   // ADMIN | DESIGNER | CUSTOMER
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  projects      Project[]
  permissions   ProjectPermission[]
}

model Project {
  id          String   @id @default(uuid())
  ownerId     String
  name        String
  thumbnailUrl String?
  description String?
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  owner       User     @relation(fields: [ownerId], references: [id])
  houses      House[]
  versions    DesignVersion[]
  permissions ProjectPermission[]
}

// A DesignVersion stores the FULL serialized design document (JSONB) —
// houses/floors/rooms/walls/objects tables below are a queryable
// PROJECTION of the *current* version, rebuilt on save, so validation,
// search ("rooms of type kitchen"), and permissions can use SQL, while
// undo/version-restore just swaps in a prior JSONB blob wholesale.
model DesignVersion {
  id          String   @id @default(uuid())
  projectId   String
  versionNum  Int
  document    Json      // full design-document snapshot
  createdBy   String
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id])
}

model House {
  id         String   @id @default(uuid())
  projectId  String
  name       String
  floors     Floor[]
}

model Floor {
  id         String   @id @default(uuid())
  houseId    String
  name       String
  levelIndex Int        // 0 = ground, 1 = first, -1 = basement
  heightMm   Int
  rooms      Room[]
}

model Room {
  id             String   @id @default(uuid())
  floorId        String
  name           String
  roomType       String     // enum-like, extensible via lookup table
  polygon        Json       // ordered [{x,y}] in mm, room boundary
  heightMm       Int
  ceilingType    String
  walls          Wall[]
  sceneObjects   SceneObject[]
}

model Wall {
  id           String  @id @default(uuid())
  roomId       String
  startPoint   Json    // {x,y} mm
  endPoint     Json
  thicknessMm  Int
  interiorMaterialId String?
  exteriorMaterialId String?
  openings     WallOpening[]
}

model WallOpening {   // doors & windows
  id          String  @id @default(uuid())
  wallId      String
  assetId     String
  offsetMm    Int      // distance along wall from start
  widthMm     Int
  heightMm    Int
  sillHeightMm Int?    // for windows
  type        String   // DOOR | WINDOW
}

model SceneObject {
  id          String  @id @default(uuid())
  roomId      String
  assetId     String
  materialOverrideId String?
  position    Json    // {x,y,z} mm
  rotation    Json    // {x,y,z} degrees
  scale       Json    // {x,y,z} multiplier
  colorOverride String?
  locked      Boolean @default(false)
  hidden      Boolean @default(false)
  properties  Json?   // free-form per-instance metadata
}

model AssetCategory {
  id       String @id @default(uuid())
  name     String
  parentId String?
}

model Asset {
  id             String @id @default(uuid())
  categoryId     String
  name           String
  modelUrl       String     // local storage key, GLTF/GLB
  thumbnailUrl   String
  defaultWidthMm  Int
  defaultHeightMm Int
  defaultDepthMm  Int
  style          String[]
  supportedColors String[]
  metadata       Json?
  isActive       Boolean @default(true)
}

model Material {
  id        String @id @default(uuid())
  name      String
  type      String   // PAINT|WOOD|MARBLE|TILE|...
  albedoUrl String?
  normalUrl String?
  roughness Float?
  metalness Float?
  tint      String?
}

model Template {
  id          String @id @default(uuid())
  name        String
  category    String    // 1BHK, VILLA, etc.
  document    Json      // full design-document snapshot
  thumbnailUrl String
}

model ProjectPermission {
  id        String  @id @default(uuid())
  projectId String
  userId    String
  role      String   // OWNER|EDITOR|VIEWER
}

model SharedDesign {
  id         String @id @default(uuid())
  projectId  String
  token      String  @unique   // for share links
  accessType String  // VIEW_ONLY|COLLABORATE
  expiresAt  DateTime?
}

model AiRequest {
  id             String @id @default(uuid())
  projectId      String
  userId         String
  prompt         String
  responseDocId  String?   // DesignVersion.id if applied
  status         String    // PENDING|PROPOSED|APPLIED|REJECTED
  createdAt      DateTime @default(now())
}

model RenderJob {
  id          String @id @default(uuid())
  projectId   String
  requestedBy String
  tier        String   // PREVIEW|HQ|FINAL
  status      String   // QUEUED|PROCESSING|DONE|FAILED
  outputUrl   String?
  createdAt   DateTime @default(now())
}
```

All tables: UUID PK, `createdAt`/`updatedAt`, `deletedAt` (soft delete)
on user-facing entities, FK indexes, unique constraint on
`(projectId, versionNum)`, `(userId, email)`.

**Why JSONB for the document AND normalized tables**: this is the one
deliberate duplication in the schema. The JSONB `DesignVersion.document`
is authoritative for rendering (client fetches it whole) and for
undo/version-restore (atomic swap). The normalized `House/Floor/Room/
Wall/SceneObject` tables are a server-side projection rebuilt on save,
existing purely so the backend can do things SQL is good at without
parsing JSON: permission checks scoped to a room, search/filters
("projects with a kitchen > 10 rooms"), and admin asset-usage analytics.
The client never queries the normalized tables directly for editing.

---

## G. Backend API Architecture (NestJS)

Module boundaries (each a Nest module: controller + service + DTOs):

```
auth/            POST /auth/register, /auth/login, /auth/refresh, /auth/logout
users/           GET/PATCH /users/me, admin CRUD /admin/users
projects/        CRUD /projects, GET /projects/:id/versions
                 POST /projects/:id/versions (save) — validates + snapshots + projects into normalized tables
                 POST /projects/:id/versions/:versionId/restore
designs/         (design-document validation service, shared by projects + templates + ai)
assets/          CRUD /assets (admin write, public read), /assets/search, /asset-categories
materials/       CRUD /materials
templates/       GET /templates, POST /projects/from-template/:templateId
sharing/         POST /projects/:id/share, GET /shared/:token
ai/              POST /ai/prompt-to-design, POST /ai/image-to-design, POST /ai/suggest
                 (creates AiRequest, enqueues job, returns proposal id; GET /ai/requests/:id polls status)
render/          POST /render-jobs, GET /render-jobs/:id (polls; WS event on completion)
uploads/         POST /uploads (multipart upload, streamed to local storage) + GET /uploads/:key (signed, expiring download)
admin/           user mgmt, asset mgmt, subscription mgmt (guarded by ADMIN role)
websocket-gateway/  autosave heartbeats, render-job push notifications, (future) presence/collab events
```

Cross-cutting:
- **Guards**: `JwtAuthGuard` (all authenticated routes), `RolesGuard`
  (`@Roles('ADMIN')`), `ProjectAccessGuard` (checks `ProjectPermission`/
  ownership before any `/projects/:id/*` route proceeds).
- **Validation**: `class-validator` DTOs at the edge; a dedicated
  `DesignDocumentValidator` service (used by `projects.save`, `ai.apply`,
  `templates.instantiate`) enforcing §44's rules (doors need a wall,
  windows attach to walls, no invalid geometry) — this is business logic,
  not decorator validation, and runs server-side even though the client
  also runs it live for UX.
- **Rate limiting**: `@nestjs/throttler`, stricter limits on `/ai/*` and
  `/render-jobs` (expensive).
- **File uploads**: since there's no S3, uploads *do* proxy through the
  API (`multer` streaming to disk, not buffering the whole file in
  memory) rather than a presigned-URL flow. The `uploads` module
  validates file type (magic-byte sniffing, not just extension) and size
  before writing, then hands back a storage key; downloads are served
  through a `GET /uploads/:key` route that checks a signed, short-lived
  token (HMAC'd key+expiry, same purpose as an S3 presigned URL) rather
  than serving `storage/` directly via a static-file mount — this keeps
  private assets (e.g. a user's uploaded room photo for image-to-design)
  from being guessable/world-readable.

---

## H. Frontend Folder / Component Architecture

```
apps/web/
  app/
    (marketing)/                 # public pages, SSR
    (auth)/login, register
    dashboard/                   # project list, templates gallery
    editor/[projectId]/          # the main app — CSR-heavy
  components/
    editor/
      Editor2D/                  # Konva stage + layers
        layers/ GridLayer, WallLayer, RoomLayer, ObjectLayer, DimensionLayer
        tools/ WallTool, RoomTool, SelectTool, MeasureTool
      Editor3D/                  # R3F canvas
        scene/ HouseScene, FloorGroup, RoomGroup, WallMesh, ObjectInstance
        camera/ CameraRig, ViewPresetButtons
        controls/ TransformGizmo, OrbitRig, WalkthroughRig
      Editor4D/
        Timeline, SunClock, PhaseFilterProvider
      panels/
        LeftSidebar/ (asset categories, search)
        RightSidebar/ (PropertiesPanel: position/rotation/scale/material forms)
        TopToolbar/ (New/Open/Save/Undo/Redo/2D3D4D switch/Export/Share)
        BottomBar/ (Timeline mount point, zoom, grid/snap toggles, units)
        Hierarchy/ (scene tree panel, §25)
      shared/  (Gizmo helpers, MaterialThumbnail, UnitInput)
    ui/                           # shadcn/ui primitives
  lib/
    editor/
      document/                  # design-document types, zod schemas, (de)serialization
      commands/                  # command-pattern undo/redo objects
      snapping/                  # shared 2D/3D snap logic (pure functions)
      validation/                # client-side mirror of server DesignDocumentValidator
      selectors/                 # zustand selectors
    api/                          # typed API client (generated from OpenAPI or tRPC-like wrapper)
    auth/
  store/
    editorStore.ts                # zustand: design document + selection + tool state
    historyStore.ts                # undo/redo stack
    uiStore.ts                     # panel visibility, active view mode
  hooks/
    useAutosave.ts, useSnap.ts, useAssetSearch.ts, useUndoRedo.ts

packages/
  schema/          # shared Zod/TS types for the design document — imported by web AND api AND worker
  ui/              # shared design system if split later
```

State management split (important for perf):
- **`editorStore` (Zustand)** owns the live design document during
  editing — mutated via command objects, never directly, so every mutation
  is undo-able.
- **TanStack Query** owns everything that talks to the API (project list,
  asset search results, template gallery, render-job polling) — separate
  cache/invalidation lifecycle from the live-editing document.
- Component subscriptions use Zustand selectors scoped to the minimum
  slice (e.g. `ObjectInstance` subscribes only to its own object's
  transform, not the whole document) so a drag doesn't re-render the
  entire tree.

---

## I. 3D Asset Management Architecture

```
Asset (metadata row, Postgres)
 ├─ modelUrl        -> local storage key, GLTF/GLB, served via GET /uploads/:key
 ├─ thumbnailUrl     -> local storage key, pre-rendered PNG
 ├─ category/subcat  -> AssetCategory (self-referential, e.g. Furniture > Seating > Sofa)
 ├─ defaultWidth/Height/DepthMm
 ├─ style[]          -> ["modern","minimalist"] for style-filtering (§20)
 ├─ supportedColors[]
 └─ metadata (json)  -> arbitrary extensible fields (brand, price tier, LOD variants, anchor points)
```

Pipeline for adding a new asset (admin flow, **no deploy required**):
1. Admin uploads GLB + thumbnail via `POST /uploads` (streamed to
   `storage/assets/...` on disk).
2. Admin fills metadata form (category, dimensions, style tags,
   supported colors/materials) → `POST /assets`.
3. Optional: server-side job generates LOD variants / KTX2-compressed
   textures / auto thumbnail render (async worker), updates `metadata.lod`.
4. Asset immediately searchable/placeable in the editor — the left
   sidebar asset browser is just a paginated `/assets/search` query, not
   a hardcoded list.

Runtime loading:
- Editor never bulk-loads the library; the asset browser lazily fetches
  thumbnails (paginated/infinite-scroll), and the 3D scene lazy-loads a
  GLTF only when an instance of that asset is actually placed
  (`useGLTF` + `Suspense`, cached by drei's loader cache so repeated
  instances of the same sofa share one downloaded model — this is also
  what makes `InstancedMesh` batching straightforward).

---

## J. AI Architecture

```
Client ── "Design a modern 3-bedroom house" ──▶ POST /ai/prompt-to-design
                                                     │
                                              ai.service enqueues AiRequest
                                                     │
                                         ┌───────────▼────────────┐
                                         │   AI Worker             │
                                         │  - builds context       │
                                         │    (current document,   │
                                         │     asset catalog subset,│
                                         │     style presets)       │
                                         │  - calls Claude with a   │
                                         │    tool/schema forcing   │
                                         │    structured output     │
                                         │    matching the design-  │
                                         │    document schema       │
                                         │    (packages/schema)      │
                                         │  - validates output via  │
                                         │    DesignDocumentValidator│
                                         └───────────┬────────────┘
                                                     │
                                     AiRequest.status = PROPOSED
                                     response stored as a draft DesignVersion
                                                     │
                              Client polls/subscribes ──▶ shows DIFF/preview overlay
                                                     │
                          user clicks "Apply" ──▶ POST /ai/requests/:id/apply
                                                     │
                                     promotes draft version to current version
```

Principles:
- **AI never writes directly to the live document.** It always produces
  a proposed `DesignVersion` (or a scoped patch for small requests like
  "move the sofa near the window"), and the frontend renders it as a
  ghost/preview the user must accept — matching §19's explicit
  requirement.
- **Structured output, not free text.** The LLM call is constrained via
  Claude's tool-use / structured-output feature to emit JSON matching
  `packages/schema`'s Zod schema; the same validator used for manual saves
  re-validates AI output before it's ever shown as a proposal.
- **Small edits vs. full generation are different prompts/scopes**:
  "move the sofa" → a scoped patch request (current room's objects only in
  context); "design a 3-bedroom house" → full-document generation from
  templates/asset catalog context. Keeping context small for scoped edits
  controls cost and reduces hallucination risk (the model can't invent
  furniture ids that don't exist in the catalog if the catalog subset is
  in context).
- **Image-to-design** (§42) is a separate pipeline: vision-capable model
  call analyzes the uploaded photo → structured description (room type,
  approximate dimensions, detected furniture/style) → same
  prompt-to-design generator consumes that structured description instead
  of raw user text, then maps suggestions to real catalog asset ids (never
  freehand geometry) via a nearest-match search over `Asset` metadata.
- **Everything AI touches is logged** (`AiRequest` row) for cost tracking,
  abuse/rate-limit, and debugging model drift.

---

## K. Rendering Architecture

```
POST /render-jobs {projectId, versionId, tier, cameraId}
        │
   RenderJob row (QUEUED) + BullMQ job
        │
┌───────▼────────┐
│ Render Worker    │  headless process, loads the design document,
│ pool (horizontally│  builds the same R3F/three scene server-side
│  scalable)        │  (headless-gl / puppeteer+Chrome), positions the
└───────┬────────┘  requested camera, renders to an offscreen canvas
        │
  Writes PNG/JPG to local storage → RenderJob.outputUrl, status DONE
        │
  WS push to client (or client polls GET /render-jobs/:id)
```

- **Tiers** (§41) differ only in worker config: PREVIEW = low
  resolution/no shadows/fast; HQ = full resolution + shadows + reflections;
  FINAL = highest resolution, possibly routed to a different (slower,
  more expensive) pipeline later (e.g. Blender/Cycles) without changing
  the API contract — `tier` just selects a different worker
  implementation behind the same queue.
- Workers are stateless and horizontally scalable (separate deployment
  from the API), so render load never impacts editor API latency.
- Export-as-PDF/2D-floor-plan reuses the 2D (Konva) renderer server-side
  (headless) rather than the 3D pipeline.

---

## L. Authentication & Authorization Architecture

- **AuthN**: email/password (bcrypt) + JWT access token (short-lived,
  ~15 min) + rotating refresh token (httpOnly cookie), issued by a Nest
  `AuthModule` using Passport strategies. OAuth (Google) addable later via
  additional Passport strategies without touching the rest of the system.
- **AuthZ**: role stored on `User.role` (ADMIN/DESIGNER/CUSTOMER) for
  coarse, feature-level gating (`RolesGuard`); fine-grained *resource*
  access uses `ProjectPermission` rows checked by `ProjectAccessGuard` on
  every `/projects/:id/*` and nested route — so "can this user edit this
  specific project" is always a DB check, not inferred from role alone.
  This is what makes sharing (§28) and future collaboration (§39) work:
  a share adds a `ProjectPermission` row (or a `SharedDesign` token for
  anonymous view-only links) rather than a separate access system.
- **WebSocket auth**: same JWT validated on socket handshake; socket
  rooms scoped to `project:{id}` so autosave/presence events never leak
  across projects.
- **Uploads**: multipart uploads validated server-side (content-type
  sniffing, size limits) before being written under `storage/` and marked
  active; the `storage/` directory itself is never mounted as a public
  static path — every read goes through `GET /uploads/:key` with an
  HMAC-signed, short-lived token, so private assets (user-uploaded room
  photos) aren't guessable/world-readable even though there's no
  CDN/S3 in front of them.
- **Audit log**: a lightweight `AuditLog` table (actor, action, target,
  timestamp) on permission changes, admin asset changes, and design
  version restores — needed for §40 and for debugging "who changed this."

---

## M. MVP Feature List

Deliberately narrow — proves the core loop (create → edit → save →
reopen) before any 3D/AI investment:

1. Auth (register/login/JWT), single role tier initially (skip
   admin/designer distinction in DB only if needed — keep the column,
   just don't build admin UI yet)
2. Project CRUD, dashboard list
3. **2D editor only**: draw rooms/walls, add doors/windows, place
   furniture from a small seeded asset library (~30–50 assets across
   core categories), move/rotate/resize/delete/duplicate, grid+wall
   snapping, measurements, undo/redo
4. Manual save + autosave (design-document JSON, one version at a time —
   full version history can follow in Phase 1.5)
5. One usable template (e.g. "2BHK") to start from
6. Basic export: PNG snapshot of the 2D plan
7. No 3D, no 4D, no AI, no rendering pipeline, no sharing/collab in MVP —
   all explicitly deferred to phases 3/6/7/8 per the roadmap below.

This MVP is intentionally smaller than "Phase 2" in §46 to get something
end-to-end shippable first; Phase 1/2 in the roadmap below together
constitute this MVP.

---

## N. Phase-by-Phase Development Roadmap

Following §46, sequenced with explicit exit criteria:

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 — Foundation | Monorepo scaffold, auth, user mgmt, project CRUD, dashboard, Postgres schema for users/projects/versions | User can register, log in, create an empty project, see it in a dashboard |
| 2 — 2D Floor Plan | Konva editor: rooms, walls, doors, windows, furniture placement (seeded assets), transform tools, snapping, measurements, undo/redo, save/autosave | User can design a full 2D floor plan, save it, reload it identically |
| 3 — 3D | R3F scene mirroring the document, camera system, materials, lighting, object transforms in 3D | User can flip to 3D and see/edit the same plan created in 2D |
| 4 — Asset Library | Admin asset CRUD + local-storage upload pipeline, categories, search/filter, material library | Admin adds a new sofa without a deploy; it's searchable and placeable same day |
| 5 — Advanced Design | Multi-floor, exterior module, landscaping objects, advanced lighting (day/night), render job pipeline (preview/HQ tiers), export to PDF | Multi-floor house with exterior, user requests a render, gets an image back async |
| 6 — 4D | Construction timeline + phase tagging on document nodes, sun/day-night slider | Timeline slider visibly changes construction completeness and lighting |
| 7 — AI | Prompt-to-design (full + scoped edits), image-to-design, proposal/preview/apply flow | "Design a modern 3-bedroom house" produces an editable proposal the user can accept |
| 8 — Collaboration & SaaS | Sharing links, permission roles, subscription/billing, team accounts, analytics; real-time presence/co-editing as a stretch goal | A user can share a view-only link; a paid plan gates premium assets/rendering tiers |

Each phase, when started, gets its own implementation pass following the
12-step process in §47 (architecture → schema → API → components → state
→ scene architecture → implementation → run instructions → tests → risks
→ improvements) rather than being designed further here.

---

## O. Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 3D scene perf collapse with large houses (hundreds of objects) | Unusable editor on mid-tier hardware | Instancing + LOD + per-floor culling from Phase 3 onward, not retrofitted later; perf budget test with a "stress" seeded project (500+ objects) as a standing test fixture |
| Design-document schema churn breaking saved projects | Users lose designs after a schema change | Version the schema itself (`schemaVersion` field in `DesignVersion.document`); write migration functions per version bump, run on load, never mutate old versions in place |
| Floating-point drift in geometry (walls not meeting, gaps) | Visually broken floor plans | Store all lengths/positions as integer millimeters, only convert to float for rendering, never for storage/comparison |
| AI hallucinating asset ids / invalid geometry | Broken or nonsensical proposed designs | Constrain generation to catalog ids via tool schema + always re-validate through `DesignDocumentValidator` before showing a proposal; reject/re-prompt on validation failure rather than surfacing broken output |
| Render worker cost/scaling (photorealistic tier) | Runaway infra cost or slow turnaround at scale | Tiered rendering with cheap PREVIEW default, FINAL tier rate-limited/paywalled behind Pro+ plans from day one of that feature |
| Large 3D asset payloads slowing first load | Poor perceived performance, especially mobile | glTF + Draco/KTX2 compression mandatory at upload/processing step (§I), CDN caching, lazy per-instance loading |
| Undo/redo correctness across 2D+3D+multi-floor edits | Data corruption, user distrust of the tool | Single command-pattern history shared by both editors from the start (§H `commands/`), never per-editor local undo stacks that can diverge |
| Collaboration retrofit difficulty | Expensive rework in Phase 8 | Model all mutations as discrete command objects now (naturally CRDT/OT-adaptable later), keep WS gateway infrastructure in place from Phase 1 even if only used for autosave/render notifications pre-Phase 8 |
| Local-disk asset security (leaking private uploads) | Privacy/security incident | `storage/` never mounted as a public static path; signed, expiring download tokens by default from Phase 1's upload pipeline (§I/§L), never a "temporarily public" static route |
| Single-host disk exhaustion / no redundancy (consequence of local storage instead of S3) | Uploads fail or, worse, data loss if the host disk fails | Disk-space monitoring/alerting from Phase 1; scheduled `storage/` + Postgres backups to a separate disk (or cheap off-site target) from day one; document this as the trade-off accepted for zero cloud spend, revisit if/when budget allows real object storage |
| Vendor lock-in on rendering tech choice | Costly rewrite if Three.js/R3F hits a wall | Keep the design-document schema renderer-agnostic (packages/schema has no Three.js types) so a renderer swap only touches `Editor3D/`, not data model or API |

---

## P. Recommended Project Folder Structure

```
HomeInterior/
├── apps/
│   ├── web/                     # Next.js frontend (see §H for internal structure)
│   └── api/                     # NestJS backend
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── projects/
│           ├── designs/         # DesignDocumentValidator, shared logic
│           ├── assets/
│           ├── materials/
│           ├── templates/
│           ├── sharing/
│           ├── ai/
│           ├── render/
│           ├── uploads/
│           ├── admin/
│           ├── websocket/
│           └── common/          # guards, interceptors, filters, decorators
├── workers/
│   ├── render-worker/           # headless render job consumer
│   └── ai-worker/               # AI job consumer (calls Claude, validates output)
├── packages/
│   ├── schema/                  # design-document Zod/TS types — shared by web, api, workers
│   ├── config/                  # shared eslint/tsconfig/tailwind config
│   └── ui/                      # (later) shared design system
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── infra/
│   └── docker-compose.yml       # postgres, redis, api, worker; storage/ as a named volume
├── storage/                      # local object store root (gitignored) — assets, textures, thumbnails, renders, exports
├── docs/
│   └── ARCHITECTURE.md          # this document
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Summary / Next Step

This document covers system architecture, stack selection with rationale,
2D/3D/4D editor architecture, database schema, backend API surface,
frontend architecture, asset/AI/rendering/auth architecture, MVP scope,
phased roadmap, risks, and folder structure, per the requested first task.

No application code has been written. Per the project instructions,
implementation should begin only on explicit go-ahead — starting with
**Phase 1 (Foundation)**: monorepo scaffold, auth, project CRUD, and
dashboard, as scoped above.

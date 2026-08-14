# RAG System Implementation Plan

> **For the human implementer (this project's rule, overriding the usual agentic default):** This plan is a guide, not code to paste in. Tasks define file targets, responsibilities, and the interfaces between pieces (so ingestion and the chat route agree on data shapes) — but no implementation code is included, and none should be written on the user's behalf, unless the user explicitly asks otherwise for a specific step. Work through tasks in order; talk through the approach for each with your guide before writing it.

**Goal:** Build a local RAG "chat with your docs" system — ingest `.txt`/`.md`/`.pdf` files, embed and store them in SQLite, and answer questions about them via a chat UI with citations.

**Architecture:** Two independent pieces sharing one SQLite file: an ingestion script (`scripts/ingest.ts`) that populates it, and a Next.js chat app that reads from it. See `docs/superpowers/specs/2026-08-09-rag-system-design.md` for full rationale.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, `better-sqlite3`, Voyage AI (embeddings), Anthropic Claude via Vercel AI SDK (`streamText`, `useChat`), `pdf-parse`.

## Global Constraints

- No browser-based upload UI — files live in `document_library/`, already present at repo root.
- No auth, no multi-user support, no deployment hardening.
- No hosted/external vector DB — brute-force cosine similarity in TypeScript over SQLite rows.
- Fixed-size chunking only for this pass (~500 tokens, ~50 token overlap) — structural chunking is future work, not part of this plan.
- Error handling matched to demo scope: log-and-skip on ingestion failures, surface API errors to the UI on chat failures, no retries/backoff.
- No automated test suite in this plan — verification is manual (see Task 9). Automated testing is an explicit future exercise per the design spec.
- Both embedding calls (ingestion and query) must use the same Voyage model — vectors from different models aren't comparable.
- Search is corpus-wide across all documents, never scoped to a single document.

---

### Task 1: Project setup — dependencies, env, scripts

**Files:**
- Modify: `package.json` (dependencies + `"ingest"` script)
- Create: `.env.local` (not committed — verify `.gitignore` already excludes it)
- Modify: `.gitignore` (confirm `.env.local` is listed; add if missing)

**Interfaces:**
- Produces: `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` environment variables, available to both the ingestion script and the Next.js app.
- Produces: `npm run ingest` script wired to run `scripts/ingest.ts` (you'll need a TS runner — check what's already available in this Next.js version, e.g. `tsx`, before adding a new dependency).

- [x] **Step 1:** Decide and install the packages this system needs: `better-sqlite3` (+ its `@types` package), a Voyage AI client (check whether Voyage publishes an official SDK or if this should be a plain `fetch` wrapper — worth 5 minutes of research before choosing), the Vercel AI SDK packages for Anthropic + `useChat` (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` or equivalent — check current package names against `node_modules/next/dist/docs/` and the AI SDK's own docs, since names shift between versions), and `pdf-parse`.
- [x] **Step 2:** Create `.env.local` with `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY`. Get real keys from your Anthropic and Voyage accounts.
- [x] **Step 3:** Confirm `.env.local` is gitignored. Run `git status` — it must not appear as untracked/stageable.
- [x] **Step 4:** Add an `"ingest"` script to `package.json` that runs `scripts/ingest.ts` (the file doesn't exist yet — that's fine, Task 6 creates it; this just wires the command).
- [x] **Step 5:** Commit (`package.json`, `package-lock.json`, `.gitignore` — never `.env.local`).

---

### Task 2: SQLite database module

**Files:**
- Create: `lib/db.ts`

**Interfaces:**
- Produces: a way to get a shared database connection (e.g. `getDb(): Database`).
- Produces: the `chunks` table schema from the spec, created if it doesn't exist:
  ```sql
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL
  );
  ```
- Produces: functions later tasks depend on — exact names/signatures are your call, but Task 6 (ingestion) needs something like "delete all chunks for a given `document_name`" and "insert a chunk row," and Task 7 (chat route) needs "get all chunks" (id, document_name, chunk_index, content, embedding as a deserializable value). Decide the real signatures yourself and note them here once written, so Task 6/7 descriptions below stay accurate — update this file if they drift.
- Produces: a decision for where the `.sqlite` file lives on disk (repo root vs. a `data/` folder) — pick one and gitignore it, since it's generated data.

**Notes:** This is a good place to think about the `Float32Array` ↔ `BLOB` serialization boundary — where does that conversion happen? In this module (so callers only ever see arrays of numbers), or in the caller? Recommend keeping it in this module so `lib/db.ts` is the only place that knows about the byte-level representation.

- [x] **Step 1:** Write `lib/db.ts`: connection setup, schema creation, insert/delete/read functions per the interfaces above.
- [x] **Step 2:** Manually verify: write a throwaway script (or use `node -e` / a scratch file) that opens the DB, inserts one fake chunk with a small embedding array, reads it back, and confirms the embedding round-trips correctly (same length, same values). Delete the scratch file when done — this isn't a permanent test, just a sanity check.
- [x] **Step 3:** Commit.

---

### Task 3: Chunking module

**Files:**
- Create: `lib/chunk.ts`

**Interfaces:**
- Produces: `chunkText(text: string, options?: { chunkSize?: number; overlap?: number }): string[]` — fixed-size chunking, ~500 tokens default, ~50 token overlap default. (Decide whether "tokens" here means a real tokenizer or a word/character approximation — document your choice as a comment, since it's a real trade-off worth having an opinion on for the README.)
- Consumes: nothing — pure function, no I/O, no dependency on `lib/db.ts` or anything network-related. This isolation is what makes structural chunking swappable later per the spec's future work section.

- [x] **Step 1:** Write `chunkText()`.
- [x] **Step 2:** Manually verify with a few inline test calls (short string, string shorter than one chunk, string spanning several chunks) — check chunk boundaries and overlap look right by eyeballing output. Formal test coverage is deferred (see Global Constraints).
- [x] **Step 3:** Commit.

---

### Task 4: Embeddings module

**Files:**
- Create: `lib/embeddings.ts`

**Interfaces:**
- Produces: `embed(texts: string[]): Promise<number[][]>` — sends texts to Voyage's embeddings API, returns one vector per input text, same order as input.
- Consumes: `VOYAGE_API_KEY` from environment (Task 1).

**Notes:** Decide on the specific Voyage model (e.g. `voyage-3.5-lite`, per the spec) and hardcode it here as a constant — both ingestion and the chat route call through this module, which is what guarantees they use the same model without duplicating the model name in two places.

- [x] **Step 1:** Write `embed()`.
- [x] **Step 2:** Manually verify: call `embed(["hello world"])` from a scratch script, confirm you get back an array of one vector with a sane length (should match the model's known dimension). Delete the scratch script when done.
- [x] **Step 3:** Commit.

---

### Task 5: Similarity module

**Files:**
- Create: `lib/similarity.ts`

**Interfaces:**
- Produces: `cosineSimilarity(a: number[], b: number[]): number` — pure function, no I/O.

- [x] **Step 1:** Write `cosineSimilarity()`.
- [x] **Step 2:** Manually verify with known cases: identical vectors → ~1, orthogonal vectors → ~0, opposite vectors → ~-1.
- [x] **Step 3:** Commit.

---

### Task 6: Ingestion script

**Files:**
- Create: `scripts/ingest.ts`

**Interfaces:**
- Consumes: `chunkText()` (Task 3), `embed()` (Task 4), the DB functions from `lib/db.ts` (Task 2).
- Produces: nothing other tasks depend on directly — this is the pipeline's entry point, run via `npm run ingest`.

- [x] **Step 1:** File discovery — read `document_library/`, filter to `.txt`/`.md`/`.pdf`, log and skip anything else.
- [x] **Step 2:** Text extraction per type — `.txt`/`.md` read as plain strings; `.pdf` via `pdf-parse`. Wrap each file's processing in error handling that logs and continues on failure, per the spec (one bad file shouldn't kill the run).
- [x] **Step 3:** Chunk each file's text via `chunkText()`.
- [x] **Step 4:** Embed the chunks via `embed()` — decide on batch size (the spec says "small batches"; check Voyage's API docs for any batch limits before picking a number).
- [x] **Step 5:** Store — delete existing chunks for that `document_name` first (idempotent re-ingestion), then insert the new chunks + embeddings.
- [x] **Step 6:** Log progress per file/chunk so a run is visible in the console.
- [x] **Step 7:** Manually verify: put 1-2 real sample files in `document_library/`, run `npm run ingest`, inspect the SQLite file (e.g. via the `sqlite3` CLI or a DB browser) to confirm rows look right — correct chunk counts, non-null embeddings, sane content.
- [x] **Step 8:** Commit.

---

### Task 7: Chat API route

**Files:**
- Create: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `embed()` (Task 4), `cosineSimilarity()` (Task 5), the "get all chunks" DB function (Task 2), Vercel AI SDK's `streamText` + `@ai-sdk/anthropic`.
- Produces: a `POST` handler compatible with `useChat`'s expected request/response shape (check the AI SDK docs for the current contract — this has changed across versions, and per `AGENTS.md` this project's Next.js/AI SDK versions may not match your training data).

- [x] **Step 1:** Parse the incoming request to get the user's latest message/question (per whatever shape `useChat` sends — confirm this before writing the rest).
- [x] **Step 2:** Embed the question via `embed()`.
- [x] **Step 3:** Load all chunks, compute cosine similarity between the question vector and each chunk vector, take the top-k (e.g. top 4).
- [x] **Step 4:** Build the prompt: include retrieved chunks labeled with `document_name` + `chunk_index`, instruct Claude to answer using only that context and reference which sources it used.
- [x] **Step 5:** Call `streamText` with the Anthropic provider and return its streaming response in the shape `useChat` expects.
- [x] **Step 6:** Add error handling that surfaces Voyage/Anthropic API failures clearly (per Global Constraints — no retry logic, just clear surfacing).
- [x] **Step 7:** Manually verify with a raw HTTP request (e.g. `curl` or a REST client) against the running dev server, once Task 6's ingestion has populated real data — confirm you get a streamed response referencing real chunk content.
- [x] **Step 8:** Commit.

---

### Task 8: Chat UI

**Files:**
- Create or modify: `app/page.tsx` (or a dedicated `app/chat/page.tsx` — your call, note the choice here)
- Modify: `app/layout.tsx` if page structure requires it

**Interfaces:**
- Consumes: `useChat` from the AI SDK, pointed at `app/api/chat/route.ts` (Task 7).

- [x] **Step 1:** Build the chat page: message list (rendering both user and assistant turns), a text input, submit on enter/button.
- [x] **Step 2:** Wire it to `useChat`, pointed at the Task 7 route.
- [x] **Step 3:** Basic styling with Tailwind (already scaffolded) — enough to be usable, not polished.
- [x] **Step 4:** Manually verify in the browser: `npm run dev`, ask a question about the ingested sample docs, confirm the streamed answer appears and cites sources.
- [x] **Step 5:** Commit.

---

### Task 9: End-to-end manual verification

**Files:** None created — this is a verification pass, not new code.

- [x] **Step 1:** Add a small, varied set of real sample documents to `document_library/` (mix of `.txt`, `.md`, `.pdf`) if you haven't already.
- [x] **Step 2:** Run `npm run ingest` fresh (delete the SQLite file first to confirm a clean run works, not just idempotent re-ingestion).
- [x] **Step 3:** Ask several questions via the chat UI: one clearly answerable from a single doc, one that should draw from multiple docs, one that shouldn't be answerable from the corpus at all (confirm the model says so rather than hallucinating).
- [ ] **Step 4:** Note anywhere retrieval quality looks off (wrong chunks retrieved, citations don't match) — this is exactly the kind of observation worth capturing for the README's "what would you do differently" section.
- [ ] **Step 5:** Commit any final fixes.

---

## After this plan

Two things explicitly deferred and tracked for later, per the design spec and your own request:
- **Testing** — revisit and build real test coverage (unit tests for `chunkText`/`cosineSimilarity`, integration test for the chat route) as a dedicated learning exercise.
- **README** — once the system works end-to-end, write it up: setup instructions, architecture, productionization discussion, RAG/LLM decisions and why, AI tool usage (tracked honestly throughout this build), and what you'd do differently — using the decisions and trade-offs noted throughout these tasks as raw material.

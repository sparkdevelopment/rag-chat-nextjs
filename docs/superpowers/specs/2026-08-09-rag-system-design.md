# RAG System — Design Spec

**Date:** 2026-08-09
**Status:** Approved (pending final written-spec review)

## Goal

Build a local RAG (retrieval-augmented generation) system to learn Next.js, TypeScript, and RAG mechanics hands-on. Ingest documents from a local folder, embed and store them, and answer questions about them via a chat UI with source citations.

This is a learning project, not a production system — implementation will be done by the user directly, with guidance rather than code written on their behalf. Rigor (error handling, testing) is intentionally minimal and matched to a demo scale.

## Non-goals

- No browser-based file upload UI — documents are placed directly in `document_library/`.
- No multi-user support, auth, or deployment hardening.
- No production-grade error handling, retries, or rate-limit backoff.
- No formal automated test suite (see "Future work").
- No hosted/external vector database — everything runs locally.

## Architecture

Two independent pieces sharing one SQLite database file:

1. **Ingestion script** (`scripts/ingest.ts`, run via `npm run ingest`) — reads files from `document_library/`, parses them, chunks them, embeds each chunk via Voyage AI, and writes chunks + embeddings into SQLite.
2. **Chat app** (Next.js App Router) — a page with a chat UI (AI SDK's `useChat`) talking to a route handler (`app/api/chat/route.ts`). On each question, the route embeds the question, does a cosine-similarity search over the SQLite chunks, builds a prompt with the top matches, and streams Claude's answer back with citations.

The two pieces only interact through the SQLite file. The app reads from it; only ingestion writes to it.

## Tech stack

- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind (already scaffolded)
- **Embeddings:** Voyage AI (`voyage-3.5-lite` or similar) — Anthropic's recommended embedding partner
- **Chat/generation:** Anthropic Claude, via the Vercel AI SDK's `streamText`
- **Chat UI:** Vercel AI SDK's `useChat` hook
- **Storage:** SQLite via `better-sqlite3`, no ORM
- **PDF parsing:** `pdf-parse` (or equivalent) for `.pdf` files

## Data model

Single table, no `documents` table needed at this scale:

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  document_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL     -- Float32Array serialized to bytes
);
```

- `id` — auto-incrementing row index.
- `document_name` + `chunk_index` — identify which document a chunk came from and its position within it; used for citations.
- `content` — the chunk's raw text, used both for the LLM prompt context and for display in citations.
- `embedding` — a single vector (array of floats) representing the chunk's meaning, stored as a serialized `Float32Array` blob, deserialized in JS for similarity math.

Similarity search is done via cosine similarity computed in plain TypeScript over rows loaded from SQLite — no `sqlite-vec` or vector index for the initial version, per the choice to start brute-force and keep the mechanism visible.

## Ingestion pipeline (`scripts/ingest.ts`)

1. **Discover files** — read all entries in `document_library/`, filter to `.txt`, `.md`, `.pdf`; skip and warn on anything else.
2. **Extract text** per file type:
   - `.txt` / `.md` — read directly as a string (treated as plain text, no markdown-aware parsing for now).
   - `.pdf` — extract raw text via a parsing library.
3. **Chunk** — split extracted text into fixed-size chunks (~500 tokens, ~50 token overlap). Implemented as an isolated, swappable function (e.g. `chunkText()`) so structural chunking (paragraphs/headings/pages) can be added later as a phase-2 comparison, without touching the rest of the pipeline.
4. **Embed** — send chunk text to Voyage's embeddings API in small batches, receive back one vector per chunk.
5. **Store** — delete existing rows for that `document_name` (idempotent re-ingestion), then insert new chunks + embeddings.
6. Log progress per file/chunk to the console for visibility into each step.

Error handling: if a file fails to parse, log and skip it — don't crash the whole run.

## Query / chat pipeline

1. **UI** — a chat page using `useChat`: message list, text input, submit on enter.
2. **Route handler** (`app/api/chat/route.ts`):
   - Embeds the incoming question via Voyage (same model as ingestion — required, since vectors from different models aren't comparable).
   - Loads all chunks from SQLite, computes cosine similarity between the question vector and each chunk vector.
   - Takes the top-k (e.g. top 4) chunks by similarity.
3. **Prompt construction** — includes the retrieved chunks as labeled context (document name + chunk index) plus the user's question; instructs Claude to answer using only that context and reference which sources it used.
4. **Streaming** — `streamText` via the AI SDK streams Claude's response back to `useChat` as it generates.
5. **Citations** — since chunks are labeled in the prompt, Claude's answer naturally references sources inline (e.g. "According to `notes.md` (chunk 3)..."); displayed as-is in the UI rather than building a separate structured citation system.

Search is corpus-wide across all documents in `document_library/`, not scoped to a single document — this is core to what makes it a genuine RAG system rather than single-document summarization.

## Error handling & testing

Matched to demo scope, not production:

- Ingestion failures are logged and skipped, not fatal.
- Chat route surfaces API errors (Voyage/Claude failures) to the UI clearly, for debugging — no retry/backoff logic.
- No automated test suite. Verification is manual: run `npm run ingest` against sample docs, ask questions, inspect the SQLite file and citations to confirm retrieval looks right.

## Future work (explicitly deferred)

- **Structural chunking** — chunk by paragraph/heading (markdown) or page (PDF) instead of fixed-size, and compare retrieval quality against the fixed-size baseline.
- **`sqlite-vec`** — swap the brute-force cosine similarity loop for a proper vector index, once the baseline mechanism is understood.
- **Testing** — revisit and build out a more formal understanding of testing (unit/integration) once the core system works, as a deliberate follow-up learning exercise.

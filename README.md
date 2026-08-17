# Gen AI Demo — Chat With Your Documents (RAG)

A small Next.js + TypeScript app demonstrating a full retrieval-augmented
generation (RAG) pipeline: ingest your own documents, embed them, and chat
with them using Claude.

Built as a hands-on exploration of agentic and RAG patterns — ingestion,
chunking, embedding, retrieval and generation — using a modern TypeScript
stack (Next.js, App Router, Claude API, Voyage embeddings).

## What it does

- Ingests `.txt`, `.md` and `.pdf` files from a local document library
- Chunks and embeds them (Voyage AI)
- Stores the embeddings for retrieval
- Lets you chat with your documents through a simple UI, with Claude
  generating answers grounded in the retrieved chunks

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Claude API** for generation
- **Voyage AI** for embeddings
- Simple local vector storage for the demo — no external DB required

## Getting started

1. Add `.txt`, `.md`, or `.pdf` files to `document_library/` (a sample doc
   is included so you can try it out immediately).
2. Set `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in `.env.local`.
3. Ingest your documents:

```bash
   npm install
   npm run ingest
```

4. Run the app:

```bash
   npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) and start chatting
   with your documents.

## Why I built this

I wanted a clean, minimal reference for how a RAG pipeline actually fits
together end to end — ingestion through to grounded generation — rather
than relying on a framework that hides the mechanics. It's part of a
series of small demos I'm building to stay hands-on with current
AI/LLM tooling alongside client and product work.

## Author

Ryan Jarrett — [linkedin.com/in/ryanajarrett](https://linkedin.com/in/ryanajarrett)

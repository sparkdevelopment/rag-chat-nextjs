This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Chatting with your documents

This project also includes a RAG ("chat with your docs") feature. Before you
can ask questions, you need to ingest some documents:

1. Add `.txt`, `.md`, or `.pdf` files to `document_library/`. A small sample
   doc (`sample-welcome.md`) is included so you can try it out immediately —
   feel free to add your own alongside or in place of it.
2. Set `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` in `.env.local`.
3. Run `npm run ingest` to chunk, embed, and store your documents.
4. Run `npm run dev` and open the app to chat with your documents.

`document_library/` is gitignored (aside from the sample doc) since it's
meant to hold your own local files, not project source.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

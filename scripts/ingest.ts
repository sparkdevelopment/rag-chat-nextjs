import fs from "fs";
import path from "path";
import { chunkText } from "../lib/chunk.ts";
import { insertChunk, deleteChunksForDocument } from "../lib/db.ts";
import { embed } from "../lib/embeddings.ts";
import { PDFParse } from "pdf-parse";
import type { TextResult } from "pdf-parse";

function discoverFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...discoverFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".pdf")) {
            files.push(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".txt")) {
            files.push(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
            files.push(fullPath);
        } else {
            console.warn(`Unsupported file type: ${entry.name}`);
        }
    }

    return files;
}

async function processFile(filePath: string): Promise<void> {
    // Placeholder for file processing logic
    console.log(`Processing file: ${filePath}`);

    // Establish filetype
    const fileType: string = path.extname(filePath).toLowerCase();
    console.log(`File type: ${fileType}`);

    let chunksArray: string[] = [];

    switch (fileType) {
        case ".pdf":
            await extractTextFromPDF(filePath).then((text: TextResult) => {
                const extractedText = text.text;
                chunksArray = buildChunksArray(extractedText, filePath);
            });
            break;
        case ".txt":
            await extractTextFromPlainText(filePath).then((text) => {
                const extractedText = text;
                chunksArray = buildChunksArray(extractedText, filePath);
            });

            break;
        case ".md":
            await extractTextFromPlainText(filePath).then((text) => {
                const extractedText = text;
                chunksArray = buildChunksArray(extractedText, filePath);
            });
            break;
        default:
            console.warn(`Unsupported file type: ${fileType}`);
    }

    let processedCount = 0;

    while (chunksArray.length > 0) {
        // get next 128 chunks for embedding
        const chunksToProcess = chunksArray.slice(0, 128);
        await embed(chunksToProcess).then((embeddings) => {
            embeddings.forEach((embedding, index) => {
                insertChunk({
                    documentName: path.basename(filePath),
                    chunkIndex: processedCount + index,
                    content: chunksToProcess[index],
                    embedding: embedding,
                });
            });
            // remove processed chunks from the array
            chunksArray = chunksArray.slice(128);
            processedCount += chunksToProcess.length;
        });
    }
}

function buildChunksArray(text: string, filePath: string): string[] {
    let chunks: string[] = [];
    let chunksArray: string[] = [];

    if (text) {
        chunks = chunkText(text, { chunkSize: 500, overlap: 50 });
        console.log(`Created ${chunks.length} chunks for file: ${filePath}`);
    }

    if (chunks.length > 0) {
        deleteChunksForDocument(path.basename(filePath));
        chunks.forEach((chunk, index) => {
            chunksArray.push(chunk);
        });
    }

    return chunksArray;
}

async function extractTextFromPDF(filePath: string): Promise<TextResult> {
    const pdfText = new PDFParse(fs.readFileSync(filePath));
    return Promise.resolve(pdfText.getText());
}

async function extractTextFromPlainText(filePath: string): Promise<string> {
    const plainText = fs.readFileSync(filePath, "utf-8");
    return Promise.resolve(plainText);
}

async function main() {
    const directoryToScan = path.join(import.meta.dirname, "..", "document_library");
    const pdfFiles = discoverFiles(directoryToScan);

    for (const pdfFile of pdfFiles) {
        try {
            await processFile(pdfFile);
        } catch (error) {
            console.error(`Error processing file ${pdfFile}:`, error);
        }
    }
}

await main();
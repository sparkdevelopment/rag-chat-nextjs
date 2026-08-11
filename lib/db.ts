import Database from "better-sqlite3";

type SqliteDatabase = InstanceType<typeof Database>;

interface Chunk {
    id: number;
    documentName: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
}

interface ChunkInsert {
    documentName: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
}

interface ChunkRow {
    id: number;
    document_name: string;
    chunk_index: number;
    content: string;
    embedding: Buffer;
}

const globalForDb = globalThis as typeof globalThis & {
    db?: SqliteDatabase;
};

function getDb(): SqliteDatabase {
    // lazy singleton pattern
    if (!globalForDb.db) {
        globalForDb.db = new Database("db.sqlite");

        // run create statement
        let createStatement = `CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY,
            document_name TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB NOT NULL
        );`

        globalForDb.db.exec(createStatement);
    }

    return globalForDb.db;
}

export function insertChunk(chunk: ChunkInsert): void {
    const db = getDb();

    const insertStatement = db.prepare(`
        INSERT INTO chunks (document_name, chunk_index, content, embedding)
        VALUES (?, ?, ?, ?)
    `);
    
    insertStatement.run(
        chunk.documentName,
        chunk.chunkIndex,
        chunk.content,
        Buffer.from( new Float32Array(chunk.embedding).buffer )
    );
}

export function deleteChunksForDocument(
    documentName: string
): void {
    const db = getDb();

    const deleteStatement = db.prepare(`
        DELETE FROM chunks WHERE document_name = ?
    `);

    deleteStatement.run(documentName);
}

export function getAllChunks(): Chunk[] {
    const db = getDb();

    const selectStatement = db.prepare<[], ChunkRow>(`
        SELECT id, document_name, chunk_index, content, embedding FROM chunks
    `);

    const rows = selectStatement.all();

    return rows.map((row: ChunkRow): Chunk => ({
        id: row.id,
        documentName: row.document_name,
        chunkIndex: row.chunk_index,
        content: row.content,
        embedding: Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4))
    }));
}
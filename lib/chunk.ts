export function chunkText(
    text: string,
    options?: {
        chunkSize?: number;
        overlap?: number;
    }): string[] {
    const chunkSize = options?.chunkSize ?? 500;
    const overlap = options?.overlap ?? 50;

    if (chunkSize <= 0) {
        throw new Error("chunkSize must be greater than 0");
    }

    if (overlap < 0) {
        throw new Error("overlap must be greater than or equal to 0");
    }

    if (overlap >= chunkSize) {
        throw new Error("overlap must be less than chunkSize");
    }

    const chunks: string[] = [];
    let startIndex = 0;

    // split on whitespace and punctuation, but keep the delimiters
    const regex = /(\s+)/g;
    const parts = text.split(regex);

    while (startIndex < parts.length) {
        let endIndex = startIndex + chunkSize;
        if (endIndex > parts.length) {
            endIndex = parts.length;
        }

        const chunk = parts.slice(startIndex, endIndex).join("");
        chunks.push(chunk);

        // Move the start index forward by chunkSize - overlap
        startIndex += chunkSize - overlap;
    }

    return chunks;
}

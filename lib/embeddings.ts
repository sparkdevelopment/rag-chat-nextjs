import { VoyageAIClient } from "voyageai";
import type { EmbedResponse } from "voyageai";

function createVoyageAIClient(): VoyageAIClient {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
        throw new Error("VOYAGE_API_KEY environment variable is not set.");
    }

    return new VoyageAIClient({ apiKey });
}

export function embed(texts: string[]): Promise<number[][]> {
    const client = createVoyageAIClient();
    const response = Promise.resolve(client.embed({
        model: "voyage-3.5-lite",
        input: texts,
    }))
        .then((response: EmbedResponse) => {
            if (!response.data) {
                throw new Error("Embedding response is missing data.");
            }

            return response.data.map((item) => {
                if (!item.embedding) {
                    throw new Error("Embedding is missing in the response item.");
                }
                return item.embedding;
            });
        })
        .catch((error) => {
            console.error("Error during embedding request:", error);
            throw error;
        });

    return response;
}
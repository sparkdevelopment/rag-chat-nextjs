import { embed } from "../../../lib/embeddings";
import { getAllChunks } from "../../../lib/db";
import { cosineSimilarity } from "../../../lib/similarity";
import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropicClient = createAnthropic({
    baseURL: "https://api.anthropic.com",
});

export async function POST(req: Request) {
    const { messages } = await req.json();

    const lastMessage = messages.at(-1).parts.filter((part: any) => part.type === "text").map((part:any) => part.text).join("\n");
    
    let embedding: number[][];
    try {
        if (!lastMessage) {
            return new Response("No message provided", { status: 400 });
        }
         embedding = await embed([lastMessage]);
    } catch (error) {
        console.error("Error generating embedding:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
    
    const chunks = await getAllChunks();

    const similarities = chunks.map((chunk) => {
        const similarity = cosineSimilarity(embedding[0], chunk.embedding);
        return {
            ...chunk,
            similarity,
        };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topK = similarities.slice(0, 5);
    const context = topK.map((chunk) => `[${chunk.documentName} #${chunk.chunkIndex}]\n${chunk.content}`).join("\n\n");

    const prompt = `You are a helpful assistant. Use the following context to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer. Reference the sources you used. Context: ${context} Question: ${lastMessage}`;

    let result = null;
    try {
        result = streamText({
            model: anthropicClient("claude-haiku-4-5"),
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });
    } catch (error) {
        console.error("Error streaming text:", error);
        return new Response("Internal Server Error", { status: 500 });
    }

    if (!result) {
        return new Response("No response generated", { status: 500 });
    }

    return createUIMessageStreamResponse(
        {stream: toUIMessageStream({
            stream: result.stream,
            onError: (error) => {
                console.error("Error in UI message stream:", error);
                return "Something went wrong while generating the response. Please try again.";
            }
        })}
    );
}

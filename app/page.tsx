"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { TextUIPart } from "ai";
import ReactMarkdown from "react-markdown"

export default function Home() {
  const { messages, sendMessage } = useChat();
  const [message, setMessage] = useState("");

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.map((currentMessage) => {
          const text = currentMessage.parts
            .filter((part): part is TextUIPart => part.type === "text")
            .map((part) => part.text)
            .join();

          const isUser = currentMessage.role === "user";

          return (
            <div
              key={currentMessage.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-gray-900 ${
                isUser
                  ? "self-end bg-blue-100 rounded-br-sm"
                  : "self-start bg-white border border-gray-200 rounded-bl-sm"
              }`}
            >
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                {currentMessage.role}
              </span>
              <span className="whitespace-pre-wrap"><ReactMarkdown>{text}</ReactMarkdown></span>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const input = message.trim();
          setMessage("");
          await sendMessage({ text: input });
        }}
        className="flex w-full max-w-2xl gap-2 border-t border-gray-200 bg-zinc-50 dark:bg-zinc-950 pt-4"
      >
        <input
          type="text"
          className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ask a question about your documents..."
          onChange={(e) => setMessage(e.target.value)}
          value={message}
        />
        <input
          type="submit"
          value="Send"
          className="rounded-full bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 cursor-pointer"
        />
      </form>
    </main>
  );
}

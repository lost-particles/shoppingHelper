"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductGrid } from "@/components/product-card";
import type { Product } from "@/lib/data/types";

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

type Mode = "chat" | "agent";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function MessagePart({
  part,
  messageId,
  index,
}: {
  part: UIMessage["parts"][number];
  messageId: string;
  index: number;
}) {
  if (part.type === "text") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{part.text}</p>
    );
  }

  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.url}
        alt={part.filename ?? "Uploaded image"}
        className="mt-2 max-h-48 rounded-lg border border-zinc-800 object-contain"
      />
    );
  }

  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";

    if (
      part.type === "tool-searchProducts" &&
      state === "output-available" &&
      "output" in part &&
      part.output &&
      typeof part.output === "object" &&
      "products" in part.output
    ) {
      const products = (part.output as { products: Product[] }).products;
      return (
        <div key={`${messageId}-tool-${index}`}>
          <div className="rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-1.5 text-xs">
            <span className="font-medium text-[#FF5C28]">
              Found {products.length} picks
            </span>
          </div>
          <ProductGrid products={products} />
        </div>
      );
    }

    return (
      <div
        key={`${messageId}-tool-${index}`}
        className="mt-2 rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-2 text-xs"
      >
        <div className="font-medium text-[#FF5C28]">Tool: {label}</div>
        <div className="mt-1 text-zinc-400">
          {state === "input-available" && "Calling..."}
          {state === "output-available" && "Done"}
          {state === "output-error" && "Error"}
        </div>
      </div>
    );
  }

  return null;
}

export function ChatApp() {
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  });
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [ttsSupported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setInput("");
      try {
        recognition.start();
        setIsListening(true);
      } catch {
        // recognition may already be running; ignore.
      }
    }
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode },
      }),
    [mode],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const isBusy = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!autoSpeak) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if (isBusy) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (lastSpokenIdRef.current === last.id) return;

    const text = last.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
    lastSpokenIdRef.current = last.id;
  }, [messages, isBusy, autoSpeak]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    const text = input.trim();
    if (!text && !imageFile) return;

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
    > = [];

    if (imageFile) {
      parts.push({
        type: "file",
        mediaType: imageFile.type || "image/png",
        url: await fileToDataUrl(imageFile),
        filename: imageFile.name,
      });
    }

    if (text) {
      parts.push({ type: "text", text });
    }

    sendMessage({ parts });
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex min-h-full flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
              Wayfair Concierge
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Shop by Conversation
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Tell me about your space. I&apos;ll find pieces that fit.
            </p>
          </div>

          <div className="flex rounded-full border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                mode === "chat"
                  ? "bg-[#FF5C28] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setMode("agent")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                mode === "agent"
                  ? "bg-[#FF5C28] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Agent
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          {mode === "chat" ? (
            <p>
              <span className="font-medium text-[#FF5C28]">Chat mode</span> -
              fast replies with basic tools. Attach an image for multimodal
              reasoning (use data URLs; see{" "}
              <code className="rounded bg-zinc-900 px-1 text-zinc-200">
                lib/subconscious.ts
              </code>
              ).
            </p>
          ) : (
            <p>
              <span className="font-medium text-[#FF5C28]">Agent mode</span> -
              long-running multi-step agent with web search, background tasks,
              and MCP tool stubs. Kick off research and let it run up to 30 tool
              steps.
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-zinc-500">
              <p className="text-lg font-medium text-zinc-200">
                Try something to get started
              </p>
              <ul className="mt-4 max-w-md space-y-2 text-sm">
                <li>
                  &quot;I need a reading chair for a small apartment, under
                  $500&quot;
                </li>
                <li>
                  &quot;Cozy reading nook, warm tones, around $800 total&quot;
                </li>
                <li>&quot;Is the Linen Slope Armchair good for cats?&quot;</li>
                <li>&quot;Compare two midcentury floor lamps for me&quot;</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-[#FF5C28] text-black"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-100"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                    message.role === "user"
                      ? "text-black/60"
                      : "text-[#FF5C28]"
                  }`}
                >
                  {message.role}
                </div>
                {message.parts.map((part, index) => (
                  <MessagePart
                    key={`${message.id}-${index}`}
                    part={part}
                    messageId={message.id}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#FF5C28]" />
              {mode === "agent" ? "Agent running..." : "Thinking..."}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {error.message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {imageFile && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>
                Image:{" "}
                <span className="text-[#FF5C28]">{imageFile.name}</span>
              </span>
              <button
                type="button"
                className="text-[#FF5C28] hover:text-[#ff7347] hover:underline"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setImageFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
              title="Attach image for multimodal reasoning"
            >
              Image
            </button>
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={isBusy}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                  isListening
                    ? "animate-pulse border-[#FF5C28] bg-[#FF5C28] text-black"
                    : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
                }`}
                title={isListening ? "Stop listening" : "Speak (push-to-talk)"}
              >
                {isListening ? "Listening..." : "Speak"}
              </button>
            )}
            {ttsSupported && (
              <button
                type="button"
                onClick={() => setAutoSpeak((v) => !v)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  autoSpeak
                    ? "border-[#FF5C28] bg-[rgb(255_92_40/0.18)] text-[#FF5C28]"
                    : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
                }`}
                title={autoSpeak ? "Stop reading replies aloud" : "Read replies aloud"}
              >
                {autoSpeak ? "Audio On" : "Audio Off"}
              </button>
            )}
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                mode === "agent"
                  ? "Kick off a long-running agent task..."
                  : "Send a message..."
              }
              className="min-w-0 flex-[1_1_16rem] rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#FF5C28] focus:ring-2 focus:ring-[#FF5C28]/30"
              disabled={isBusy}
            />
            {isBusy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28]"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !imageFile}
                className="shrink-0 rounded-xl bg-[#FF5C28] px-4 py-2 text-sm font-medium text-black hover:bg-[#ff7347] disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

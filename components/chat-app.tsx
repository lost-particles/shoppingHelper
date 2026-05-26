"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

interface ProductData {
  id: string;
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  category: string;
  styles: string[];
  url?: string;
}

interface ShortlistEntry {
  product: ProductData;
  query: string;
  savedAt: string;
}

const SHORTLIST_KEY = "wayfair-shortlist";

function loadShortlist(): ShortlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveToShortlist(entry: ShortlistEntry) {
  const list = loadShortlist();
  if (list.some((e) => e.product.id === entry.product.id)) return;
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...list, entry]));
  window.dispatchEvent(new Event("shortlist-updated"));
}

function removeFromShortlist(productId: string) {
  const list = loadShortlist().filter((e) => e.product.id !== productId);
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("shortlist-updated"));
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-xs ${i < full ? "text-amber-400" : i === full && half ? "text-amber-400/60" : "text-zinc-600"}`}>
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-zinc-400">{rating.toFixed(1)}</span>
    </span>
  );
}

function ProductCard({ product, query }: { product: ProductData; query: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const check = () => setSaved(loadShortlist().some((e) => e.product.id === product.id));
    check();
    window.addEventListener("shortlist-updated", check);
    return () => window.removeEventListener("shortlist-updated", check);
  }, [product.id]);

  function toggle() {
    if (saved) {
      removeFromShortlist(product.id);
    } else {
      saveToShortlist({ product, query, savedAt: new Date().toISOString() });
    }
    setSaved(!saved);
  }

  const wayfairUrl = product.url ?? `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(product.name)}`;

  return (
    <div className="flex w-52 flex-none flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 transition hover:border-zinc-500">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt={product.name}
        className="h-40 w-full object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-100">
          {product.name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-white">${product.price.toFixed(2)}</span>
          {product.reviewCount > 0 && (
            <span className="text-xs text-zinc-500">({product.reviewCount.toLocaleString()})</span>
          )}
        </div>
        <StarRating rating={product.rating} />
        <div className="mt-auto flex gap-1.5 pt-1">
          <a
            href={wayfairUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-center text-xs font-medium text-zinc-300 transition hover:border-[#FF5C28] hover:text-[#FF5C28]"
          >
            View ↗
          </a>
          <button
            onClick={toggle}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              saved
                ? "border-[#FF5C28] bg-[rgb(255_92_40/0.15)] text-[#FF5C28]"
                : "border-zinc-700 text-zinc-400 hover:border-[#FF5C28] hover:text-[#FF5C28]"
            }`}
            title={saved ? "Remove from shortlist" : "Save to shortlist"}
          >
            {saved ? "♥ Saved" : "♡ Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCards({ products, query }: { products: ProductData[]; query: string }) {
  if (!products.length) return null;
  return (
    <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} query={query} />
      ))}
    </div>
  );
}

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
  lastUserQuery,
}: {
  part: UIMessage["parts"][number];
  messageId: string;
  index: number;
  lastUserQuery: string;
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
    const toolName = part.type.replace("tool-", "");
    const state = "state" in part ? (part as { state: string }).state : "unknown";
    const output = "output" in part ? (part as { output: unknown }).output : undefined;

    // Rich product cards for searchProducts
    if (toolName === "searchProducts" && state === "output-available" && output) {
      const result = output as { products?: ProductData[]; query?: string };
      if (result.products?.length) {
        return (
          <ProductCards
            products={result.products}
            query={result.query ?? lastUserQuery}
          />
        );
      }
    }

    return (
      <div
        key={`${messageId}-tool-${index}`}
        className="mt-2 rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-2 text-xs"
      >
        <div className="font-medium text-[#FF5C28]">
          {toolName === "searchProducts" ? "🔍 Searching catalog" :
           toolName === "getReviews" ? "💬 Fetching reviews" :
           toolName === "getProductDetails" ? "📦 Loading details" :
           `Tool: ${toolName}`}
        </div>
        <div className="mt-1 text-zinc-400">
          {state === "input-available" && "Running…"}
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
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [shortlistCount, setShortlistCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setShortlistCount(loadShortlist().length);
    update();
    window.addEventListener("shortlist-updated", update);
    return () => window.removeEventListener("shortlist-updated", update);
  }, []);

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
    setVoiceSupported(true);
    return () => { recognition.abort(); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("speechSynthesis" in window) setTtsSupported(true);
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
      try { recognition.start(); setIsListening(true); } catch { /* already running */ }
    }
  }

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { mode } }),
    [mode],
  );

  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const isBusy = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBusy]);

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

  // Track the last user message text for product card context
  const lastUserQuery = messages.findLast((m) => m.role === "user")
    ?.parts.find((p) => p.type === "text")
    // @ts-expect-error text is on text parts
    ?.text ?? "";

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
      parts.push({ type: "file", mediaType: imageFile.type || "image/png", url: await fileToDataUrl(imageFile), filename: imageFile.name });
    }
    if (text) parts.push({ type: "text", text });

    sendMessage({ parts });
    setInput("");
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex min-h-full flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
              Wayfair Shopping Concierge
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Find your perfect piece
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/shortlist"
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-[#FF5C28] hover:text-[#FF5C28]"
            >
              ♡ Shortlist
              {shortlistCount > 0 && (
                <span className="rounded-full bg-[#FF5C28] px-1.5 py-0.5 text-xs font-bold text-black">
                  {shortlistCount}
                </span>
              )}
            </Link>

            <div className="flex rounded-full border border-zinc-800 bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  mode === "chat" ? "bg-[#FF5C28] text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode("agent")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  mode === "agent" ? "bg-[#FF5C28] text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                Agent
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center text-zinc-500">
              <p className="text-lg font-medium text-zinc-200">What are you looking for?</p>
              <ul className="mt-4 max-w-sm space-y-2 text-sm">
                {[
                  '"I need a reading chair under $400, warm tones"',
                  '"Floor lamp that arcs over a sofa, not too bright"',
                  '"Small rug for a 10x12 living room, boho vibe"',
                  '"Compare the cheapest bookshelves you have"',
                ].map((s) => (
                  <li
                    key={s}
                    onClick={() => setInput(s.replace(/^"|"$/g, ""))}
                    className="cursor-pointer rounded-lg px-3 py-1.5 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-[#FF5C28] text-black"
                    : "border border-zinc-800 bg-zinc-900 text-zinc-100"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-medium uppercase tracking-wide ${
                    message.role === "user" ? "text-black/60" : "text-[#FF5C28]"
                  }`}
                >
                  {message.role === "user" ? "You" : "Concierge"}
                </div>
                {message.parts.map((part, index) => (
                  <MessagePart
                    key={`${message.id}-${index}`}
                    part={part}
                    messageId={message.id}
                    index={index}
                    lastUserQuery={lastUserQuery}
                  />
                ))}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#FF5C28]" />
              {mode === "agent" ? "Agent searching…" : "Thinking…"}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            {error.message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {imageFile && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Image: <span className="text-[#FF5C28]">{imageFile.name}</span></span>
              <button
                type="button"
                className="text-[#FF5C28] hover:underline"
                onClick={() => {
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setImageFile(f); }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
              title="Attach room photo"
            >
              📷
            </button>
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={isBusy}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${
                  isListening
                    ? "animate-pulse border-[#FF5C28] bg-[#FF5C28] text-black"
                    : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
                }`}
                title={isListening ? "Stop listening" : "Speak"}
              >
                {isListening ? "🔴" : "🎤"}
              </button>
            )}
            {ttsSupported && (
              <button
                type="button"
                onClick={() => setAutoSpeak((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  autoSpeak
                    ? "border-[#FF5C28] bg-[rgb(255_92_40/0.18)] text-[#FF5C28]"
                    : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-[#FF5C28] hover:text-[#FF5C28]"
                }`}
                title={autoSpeak ? "Mute" : "Read replies aloud"}
              >
                {autoSpeak ? "🔊" : "🔇"}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you're looking for…"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#FF5C28] focus:ring-2 focus:ring-[#FF5C28]/30"
              disabled={isBusy}
            />
            {isBusy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-[#FF5C28]"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && !imageFile}
                className="rounded-xl bg-[#FF5C28] px-4 py-2 text-sm font-medium text-black hover:bg-[#ff7347] disabled:opacity-40"
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

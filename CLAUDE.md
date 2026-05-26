# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev        # start dev server at http://localhost:3000
pnpm build      # production build
pnpm start      # run production build
pnpm lint       # ESLint (Next.js config)
```

Requires `.env.local` with `SUBCONSCIOUS_API_KEY=sky_...` — get one at https://www.subconscious.dev/platform.

## Architecture

This is a **Next.js 16** app (breaking changes from prior versions — read `node_modules/next/dist/docs/` before using any Next.js API you're not certain about). The stack:

- **Model**: Subconscious `tim-qwen3.6-27b` via an OpenAI-compatible API (`lib/subconscious.ts`)
- **Agent runtime**: Vercel AI SDK v6 `ToolLoopAgent` + `createAgentUIStreamResponse`
- **Streaming API**: `app/api/chat/route.ts` — routes `mode: "chat"` vs `mode: "agent"` to different agents
- **UI**: `components/chat-app.tsx` — single React component, `useChat` from `@ai-sdk/react`, supports image attachments as data URLs

### Two agents (`lib/agents/index.ts`)

| Agent | Tools | Max steps | Token limit |
|-------|-------|-----------|-------------|
| `chatAgent` | `getWeather`, `calculate` | 8 | 2000 |
| `researchAgent` | above + `webSearch`, `runLongTask`, MCP stubs | 30 | 4000 |

The API route `maxDuration` is 300 seconds to support long agent runs.

### Adding tools (`lib/tools/index.ts`)

Define a tool with `tool({ description, inputSchema, execute })` from `"ai"`, export it, and add it to `chatTools` and/or `agentTools`. Customize the agent prompt in `lib/agents/index.ts`.

### MCP integration (`lib/tools/mcp-tools.ts`)

Wrap MCP server tools as AI SDK `tool()` definitions — `execute` calls `client.callTool(...)`. Install `@modelcontextprotocol/sdk` first. `createMcpTools()` is spread into `researchAgent`.

## Subconscious API key quirks

- **Thinking is OFF by default** in this repo (`lib/subconscious.ts` sets `enable_thinking: false` via a fetch interceptor). To enable, change `createSubconsciousProvider(false)` to `true`.
- Only `temperature` and `stop` sampling parameters are honored; others (`top_p`, `seed`, etc.) are silently dropped.
- Only `function` tool type works — `custom` and MCP tool types return 400.
- `POST /v1/responses` is not functional — the repo correctly uses `/v1/chat/completions` via the OpenAI SDK adapter.
- Vision works via data URLs; audio/file/video inputs return 400/500.
- Thinking tokens count as output tokens (expensive for short prompts — ~32–88× overhead).

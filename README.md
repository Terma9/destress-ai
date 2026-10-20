# Destress AI

**An AI companion for everyday stress.** Instead of filling in mood sliders, you talk with Destress AI for a few minutes each evening. It reads your stress, sleep and mood from the conversation, finds the patterns in your days, and helps you calm down in the moment or solve what keeps coming back.

**[▶ Try the live demo](https://destress-ai.vercel.app)** · works in any browser, on desktop with a phone frame · "Load the demo" shows four weeks of the demo persona Jonas

<p align="center">
  <img src="docs/screenshots/phone/01-start.png" width="200" alt="Start screen">
  &nbsp;
  <img src="docs/screenshots/phone/02-today.png" width="200" alt="Today with Weekly Insights">
  &nbsp;
  <img src="docs/screenshots/phone/06-calendar-chart.png" width="200" alt="Calendar with the month chart">
  &nbsp;
  <img src="docs/screenshots/phone/07-untangle.png" width="200" alt="Untangle: Calm Now and Stress Solving">
</p>

---

## Contents

- [The idea](#the-idea)
- [Features](#features)
- [Architecture at a glance](#architecture-at-a-glance)
- [How the AI works](#how-the-ai-works)
- [Key decisions](#key-decisions)
- [Security, privacy and cost](#security-privacy-and-cost)
- [Observability](#observability)
- [Lessons learned](#lessons-learned)
- [What's next](#whats-next)
- [How it was built](#how-it-was-built)
- [Tech stack and running it](#tech-stack-and-running-it)

**Deeper reading:** [Architecture](docs/architecture.md) · [Decisions](docs/decisions.md) · [Lessons learned](docs/lessons-learned.md)

---

## The idea

Stress and mood trackers are popular in the app stores, but most of them are generic: you type in the same numbers every day, and nothing much happens with them. Destress AI replaces the manual tracking with a short evening conversation. The AI picks up stress, sleep and mood on the way, suggests the values with a short reason each (you confirm or adjust), remembers what matters, and connects the dots across weeks: *"Saying yes to late tasks stresses you. Walks and football bring back your sleep."* When stress hits, it helps right away. When something keeps coming back, it works out a plan with you, based on your own history.

## Features

<table>
<tr>
<td width="260" valign="top"><img src="docs/screenshots/phone/03-checkin.png" width="240" alt="The evening check-in conversation"></td>
<td valign="top">

### 🌙 Evening check-in

A warm 2-minute conversation, typed or spoken. Afterwards: stress, sleep and mood (0–10) with a reason each, to confirm or adjust. One entry per day, in a calendar.

**Under the hood**
- **Streamed replies** (`checkin-chat`). The system prompt is rebuilt on every turn from: the user's **memory profile** (a short text the AI rewrites after each check-in), the **last 3 check-ins** and **7 days of values**, the last 3 **reflection answers**, open **Stress Solving plans** to follow up on, this week's **question** from Weekly Insights, and up to **2 related past conversations** from RAG (the last message is embedded → vector search over topic chunks → the whole original conversations).
- **Finishing** (`checkin-complete`): one structured-output call (strict JSON schema) returns title, summary, mood, stress/sleep/mood **with a reason each**, themes, a risk level, the **topics** for the RAG index, how open plans went, and the **updated memory**. The topics are embedded, then everything is saved in one database transaction.
- **Voice:** speech-to-text; the audio is never stored.

</td>
</tr>
<tr>
<td width="260" valign="top"><img src="docs/screenshots/phone/04-weekly-insights.png" width="240" alt="Weekly Insights with patterns and evidence"></td>
<td valign="top">

### 📈 Weekly Insights

Once a week: the week vs. the last, three patterns with numbers, what helped, a question for the week ahead. Every finding links to the days behind it.

**Under the hood**
- **Code first:** this week vs. last week (averages, changes) and recurring themes are computed in TypeScript, not by the model.
- **One structured-output call** gets those numbers as facts, plus up to **40 recent entries labelled `E1 … E40`** and how Untangle plans worked out. It returns a one-sentence summary, 1–3 patterns whose findings must **cite at least 2 entries**, what worked, and a question for the week ahead.
- **Validation in code:** labels are mapped back to real entry ids, unknown labels are dropped, and findings with fewer than 2 valid citations are removed. That's why every "Based on 5 of your entries" opens real days.
- **When:** automatically on app open, at least 7 days after the last insights and with at least 3 new check-ins.

</td>
</tr>
<tr>
<td width="260" valign="top"><img src="docs/screenshots/phone/08-calm-now.png" width="240" alt="Calm Now with the stress slider"></td>
<td valign="top">

### 🍃 Calm Now

Stressed right now? A stress slider, a calming minute of guided breathing when it's high, then a short conversation with exercises that fit where you are. Before → after rating.

**Under the hood**
- **Guided breathing first** at stress 7 or higher; the app then sends `breathed: true`, so the model won't suggest breathing again.
- **The system prompt is assembled for every message** from:
  - the stress level and what the user described,
  - their **memory profile**,
  - the **patterns from their latest Weekly Insights** and their last 3 **reflection answers**,
  - their last **8 Calm Now sessions and plans** with before → after intensity, which steps they actually did, and what helped,
  - their **active plans** (so it can point to one),
  - up to **3 related past check-ins from RAG**: all of the user's messages in this session are embedded, matched against the topic chunks, and the whole conversations are added as `E1 … E3`, marked so that old AI lines aren't taken as facts.
- **Rules in the prompt:** every exercise must fit where the user is (in bed: eyes closed, no "look around"; at work: nothing visible; unclear: ask first), never repeat an exercise, at most 2 short sentences ending with a question or one small task.
- **"I feel calmer"** saves the before → after rating, which feeds the next sessions.

</td>
</tr>
<tr>
<td width="260" valign="top"><img src="docs/screenshots/phone/09-plan.png" width="240" alt="A Stress Solving plan with evidence"></td>
<td valign="top">

### 〰️ Stress Solving

For stress that keeps coming back: the AI asks until it understands, then makes a plan from your own check-ins. Give updates and the plan adapts; mark it solved to get a success story.

**Under the hood**
- **Same context as Calm Now** (memory, insight patterns, past sessions with their outcomes, RAG), but a different job: find out the trigger, what's in the user's control and what they already tried.
- **Readiness signal:** the model appends a hidden `[[ready]]` once it knows enough (allowed after 2 answers, forced after 5). The app strips it and only then shows **Make my plan**.
- **The plan** is one structured-output call: title, problem, an approach of at most 30 words based on one concrete thing from the user's history, 1–3 steps, what to watch for, and "what your past shows" lessons that **cite past check-ins** (`E1 …`, validated in code like the insights).
- **A living plan:** updates continue the same thread with the current plan in the prompt; "Update my plan" saves a new version and keeps the old one in `plan_history`. Evening check-ins ask about open plans, and the extraction records how each one went.

</td>
</tr>
<tr>
<td width="260" valign="top"><img src="docs/screenshots/phone/11-story.png" width="240" alt="A community story with comments"></td>
<td valign="top">

### 💬 Community

Short, anonymous stories from people who solved similar stress, matched to what you're dealing with. Share your own; comment.

**Under the hood**
- **Writing:** from a solved plan, one structured-output call drafts a short first-person post from the plan and the user's own words in the conversation. It returns `allowed`, `reason`, `crisis`, `personal_details` (what it removed, e.g. names or employers), `title` and `body`; the user edits the draft.
- **Moderation:** the final text is reviewed again before publishing, and every comment gets the same check. Only the server can set a story to published.
- **"For you":** each story is embedded; the feed ranks stories by cosine similarity to the **average of the reader's own check-in vectors**, inside a database function that never returns user ids.

</td>
</tr>
</table>

## Architecture at a glance

```mermaid
flowchart LR
    App["📱 App<br/>Expo / React Native<br/>iOS · Android · Web"]
    subgraph Supabase["Supabase (EU)"]
        Auth["Auth<br/>anonymous accounts"]
        EF["Edge Functions (Deno)<br/>10 functions, all AI calls"]
        DB[("Postgres<br/>row-level security<br/>pgvector")]
    end
    OpenAI["OpenAI<br/>chat · structured output<br/>embeddings · speech-to-text"]
    Langfuse["Langfuse (EU)<br/>tracing"]

    App -- "reads/writes own data (RLS)" --> DB
    App -- "AI features" --> EF
    App --> Auth
    EF --> DB
    EF --> OpenAI
    EF -. "traces, after the response" .-> Langfuse
```

- **The app never talks to the AI directly.** Every AI call runs in an Edge Function; API keys exist only there.
- **The database protects itself.** Row-level security on every table: a user can only ever read and write their own rows, whatever the client sends.
- **One request, one function.** E.g. `checkin-chat` streams the evening conversation, `checkin-complete` extracts the values and saves the entry in one transaction.

→ Request flows, data model and all functions: [docs/architecture.md](docs/architecture.md)

## How the AI works

The AI patterns used, and where:

| Pattern | Where | Why |
|---|---|---|
| **Streaming** | Check-in, Calm Now, Stress Solving | The reply appears word by word as soon as the model starts writing, instead of all at once at the end |
| **Structured outputs** (strict JSON schema) | Check-in values, plans, insights, moderation | The model must return exactly the fields the app needs; no parsing of free text |
| **RAG, small-to-big** | Check-in chat, Untangle, search | Each check-in is split into topic chunks for the search, but the model gets the *whole* original conversation |
| **"Code counts, the model interprets"** | Weekly Insights | Averages and comparisons are computed in code; the model only explains them, so numbers can't be hallucinated |
| **Validated citations** | Insights, plans | The model cites entries by short labels (E1, E2 …); code maps them back to real ids and drops findings without valid evidence |
| **LLM as moderator** | Community posts and comments | Checks kindness, privacy (names, places) and crisis signals before anything is published |
| **Hidden control signals** | Stress Solving | The model appends `[[ready]]` when it knows enough; the app strips it and shows "Make my plan" |
| **Memory** | Check-in | After each check-in the model updates a short profile ("what matters to Jonas"), used in the next conversation |
| **Provider-neutral interface** | All AI calls | Functions talk to an `LLMProvider` interface; OpenAI is one adapter, models are set per task via secrets |

→ Pipelines in detail: [docs/architecture.md](docs/architecture.md#ai-pipelines)

## Key decisions

| Decision | Why | Alternative considered |
|---|---|---|
| **Expo / React Native** | One codebase for iOS, Android and a web demo | Native apps (twice the work), web-only (not a real app) |
| **Supabase** (Postgres, RLS, Edge Functions, Auth) | Security in the database, server code next to the data, EU region | Firebase (no SQL, no pgvector), own backend (more to run) |
| **AI only on the server** | Keys never ship in the app; quotas and moderation can't be bypassed | Calling OpenAI from the app (key would be public) |
| **AI suggests, the user decides** | Values come with reasons and can be adjusted; values set by hand always win | Fully automatic tracking (no trust, no correction) |
| **pgvector in the same database** | RAG search respects the same row-level security; one system | Separate vector database (second system, own access rules) |
| **One transaction for saving a check-in** | Five writes either all succeed or none; AI calls happen before it | Separate writes (half-saved check-ins on errors) |
| **Quota fails closed, tracing fails open** | Cost protection must never be skipped; observability must never break the app | Treating all checks the same |

→ All decisions with context: [docs/decisions.md](docs/decisions.md)

## Security, privacy and cost

- **Row-level security** on every table; the community feed is read only through database functions that never expose user ids.
- **Anonymous accounts** on first start: no email or name needed. User ids in logs and traces are pseudonymous.
- **Keys only in Edge Functions** (Supabase secrets); the app only holds the public project key.
- **Voice input** is transcribed and immediately discarded; audio is never stored.
- **AI moderation** before anything is published; stories are anonymized, and comments are checked too.
- **Crisis detection:** check-ins and Untangle classify a risk level; at elevated risk the app shows help resources instead of tips.
- **Cost limits:** per-user (80) and global (4000) daily AI calls, enforced in the database, failing closed, plus a spending limit at OpenAI.
- **Tracing privacy:** for real users, all text is masked before it leaves the server; only demo accounts (fictional data) are traced in full. Data stays in the EU.

## Observability

Every request is traced with **[Langfuse](https://langfuse.com)** (EU region): the whole path from receiving the request to the last streamed byte, with the database steps and AI calls nested inside.

```
checkin-chat                      6.6 s   (the request: user message in, reply out)
 ├─ check-quota                           database
 ├─ load-context                          database: memory, recent check-ins, metrics, plans
 ├─ find-related                          RAG
 │   ├─ embed                             AI: the message as a vector
 │   ├─ match-chunks                      database: vector search (titles + similarity)
 │   └─ load-conversations                database
 └─ chat                                  AI: the streamed reply (tokens, cost, time to first token)
```

Built without an SDK: spans are sent as OpenTelemetry JSON over HTTP, after the response (`waitUntil`), and nested automatically via `AsyncLocalStorage`. → [docs/architecture.md](docs/architecture.md#observability)

## Lessons learned

The short version; each with the full story in [docs/lessons-learned.md](docs/lessons-learned.md).

1. **One vector per conversation dilutes the meaning.** A check-in about four topics wasn't found for any of them. Topic chunks + small-to-big retrieval: the exam query went from *not found* to rank 2, rent from rank 3 to rank 1.
2. **Models believe their own words.** Old AI suggestions in the context were later treated as facts about the user. Fix: label who said what, and tell the model its own lines aren't facts.
3. **Never let a model invent references.** Short labels instead of ids, validated in code: 0 hallucinated citations reached the user.
4. **A silent `catch` hid a broken feature.** After a refactor, RAG in the check-in chat quietly returned nothing. The traces made it visible: the `embed` step was simply missing.
5. **Prompts need context rules, not just tone.** Calm Now suggested "look around the room" to someone lying in bed in the dark, and repeated breathing right after a guided breathing minute.
6. **Shared state in a public demo needs care.** Every demo restart published the demo story again; the feed filled with duplicates until demo stories became private to their account.
7. **Measure before claiming a fix.** A warm-up ping takes over the ~3 s function start, but the first real search still took 10.7 s (then 2.8 s, then 1.0 s): the rest happens inside the first real request, where a ping can't reach.
8. **Keep AI calls out of transactions.** Saving a check-in wrote to five places one after another; now all AI work runs first and one database transaction saves everything or nothing.

## What's next

- **Quality scores in Langfuse** from real use: Calm Now stress drop, how often users correct the AI's values.
- **Evals:** a small dataset (crisis, Calm Now rules, extraction) run against each prompt change, with rule checks and an LLM judge.
- **Faster check-in save:** saving takes ~18 s, mostly one structured-output call; candidates are a faster extraction model and moving memory/indexing to the background.
- **Real accounts:** upgrade anonymous accounts to email or Apple/Google sign-in without losing data.

## How it was built

I designed Destress AI starting from my own concept and mockups. The project was set up in July 2026; the main build followed in October 2026. I made the product, UX and architecture decisions (for example the topic-chunk RAG design, the Untangle and community concepts, and the demo persona) and wrote the implementation together with **Claude Code** (Anthropic's coding agent) as a pair programmer: I directed each step, reviewed the code, tested it in the browser and on my phone, and iterated on the details. I can explain every part of it, and the [decisions](docs/decisions.md) and [lessons](docs/lessons-learned.md) are written down so that's easy to check.

## Tech stack and running it

**App:** Expo SDK 57 · React Native 0.86 · TypeScript · expo-router · Reanimated · react-native-svg · zustand
**Backend:** Supabase (Postgres, pgvector, row-level security, Auth, Edge Functions on Deno)
**AI:** OpenAI Responses API (chat, structured outputs), `text-embedding-3-small`, speech-to-text · Langfuse tracing
**Web demo:** static export on Vercel, with a phone frame on desktop

```bash
npm install
cp .env.example .env          # Supabase URL + publishable key (public by design)
npm run web                   # or: npx expo start (iOS/Android via Expo Go)
```

Server side: `supabase/migrations` (schema), `supabase/functions` (Edge Functions). Secrets (`OPENAI_API_KEY`, `LANGFUSE_*`, model names) are set in Supabase, never in the repo. End-to-end tests with the real AI (written during development, not re-run after the latest changes): `npm run test:checkin`, `test:rag`, `test:untangle`, `test:community`, `test:deep-dives`, `test:rls`.

<sub>Screenshots: `node scripts/screenshots.mjs && python scripts/optimize-screenshots.py`</sub>

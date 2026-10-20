# Decisions

The important decisions behind Destress AI, each as a short record: what the situation was, what was decided, which alternatives were considered, and what follows from it. Grouped by area, roughly in the order they were made.

- **Platform:** [1 Expo](#1-expo--react-native-one-codebase) · [2 Supabase](#2-supabase-as-the-backend) · [3 AI only on the server](#3-every-ai-call-runs-on-the-server) · [4 Provider-neutral AI](#4-a-provider-neutral-ai-interface) · [5 Anonymous accounts](#5-anonymous-accounts-first)
- **Product:** [6 Conversation instead of sliders](#6-a-conversation-instead-of-sliders) · [7 AI suggests, user decides](#7-the-ai-suggests-the-user-decides) · [8 One check-in per day](#8-one-check-in-per-day-in-the-evening) · [9 Weekly Insights](#9-weekly-insights-automatic-once-a-week) · [10 Calm Now vs. Stress Solving](#10-two-ways-to-deal-with-stress) · [11 Community](#11-a-moderated-anonymous-community)
- **AI design:** [12 Structured outputs](#12-structured-outputs-for-everything-the-app-reads) · [13 Code counts, the model interprets](#13-code-counts-the-model-interprets) · [14 Citations by label](#14-citations-by-short-label-validated-in-code) · [15 RAG in Postgres](#15-rag-with-pgvector-in-the-same-database) · [16 Topic chunks, small-to-big](#16-topic-chunks-with-small-to-big-retrieval) · [17 When to make a plan](#17-the-model-decides-when-its-ready-to-make-a-plan)
- **Reliability and operations:** [18 Transactions](#18-saving-a-check-in-in-one-transaction) · [19 Quota](#19-a-daily-ai-quota-that-fails-closed) · [20 Tracing](#20-tracing-with-langfuse-without-an-sdk) · [21 Web demo](#21-a-web-demo-with-a-seeded-persona)
- **Design:** [22 Calm, not "AI-looking"](#22-a-calm-design-that-doesnt-look-like-a-typical-ai-app)

---

## Platform

### 1. Expo / React Native: one codebase
- **Context:** The app should be a real phone app, but also be easy to show to anyone with a link.
- **Decision:** Expo with React Native and TypeScript, expo-router for file-based navigation.
- **Alternatives:** Native Swift/Kotlin (twice the work, no web). Flutter (a weaker web build for the demo). A web-only app (not a real app, no microphone and notifications in the same way).
- **Consequences:** One codebase runs on iOS, Android and the web demo. Web has its own gotchas: no AsyncStorage during static rendering, the Vercel `node_modules` upload issue (see [lessons](lessons-learned.md)).

### 2. Supabase as the backend
- **Context:** Accounts, a database, server code for the AI, all with personal health data.
- **Decision:** Supabase in the EU: Postgres with row-level security, Auth, Edge Functions (Deno).
- **Alternatives:** Firebase (no SQL, no pgvector, rules language instead of SQL). An own backend server (more to run and secure).
- **Consequences:** Security lives in the database (RLS), so even a buggy client can't read someone else's data. Server code runs next to the data. The vector search for RAG can live in the same database (decision 15).

### 3. Every AI call runs on the server
- **Context:** The app needs OpenAI, but anything shipped in an app can be extracted.
- **Decision:** The app never calls OpenAI. Every AI feature is an Edge Function; keys are Supabase secrets.
- **Alternatives:** Calling OpenAI from the app (the key would be public within days).
- **Consequences:** Quotas, moderation and tracing can't be bypassed. One extra network hop per request.

### 4. A provider-neutral AI interface
- **Context:** The project started with an OpenAI key, but switching to Claude or another model later should be easy.
- **Decision:** Functions only talk to interfaces (`LLMProvider`, `Embedder`, `Transcriber`). OpenAI is one adapter. Models are set per task via secrets (chat, extraction, analysis, embeddings, speech-to-text).
- **Alternatives:** Using the OpenAI SDK directly in every function.
- **Consequences:** A new provider is one new adapter file. Changing a model needs no deploy. The same seam is used for tracing: the adapter reports each call, and something else decides what to do with it.

### 5. Anonymous accounts first
- **Context:** A sign-up wall before the first check-in loses people, and an interviewer shouldn't need an account.
- **Decision:** Every device gets an anonymous Supabase account on first start.
- **Alternatives:** Email sign-up from the start.
- **Consequences:** Zero friction, pseudonymous user ids everywhere. Data is tied to the device until accounts can be upgraded to email/Apple/Google (planned; Supabase keeps the same user id, so nothing is lost).

---

## Product

### 6. A conversation instead of sliders
- **Context:** Mood trackers ask you to rate yourself every day. That gets boring, and the numbers lack context.
- **Decision:** The core of the app is a short evening conversation. The AI picks up stress, sleep and mood from it.
- **Consequences:** The data has reasons attached ("you lay awake until 1"), which makes patterns explainable. Costs an AI call per message, hence the quota (decision 19).

### 7. The AI suggests, the user decides
- **Context:** Automatically extracted values can be wrong, and a health app that overrules you loses trust.
- **Decision:** After the check-in, the AI shows its suggested values with a short reason each. The user confirms or adjusts. Adjusted values are marked `manual` and always win, even if the check-in is continued later.
- **Consequences:** Users stay in control, and corrections are a quality signal (planned as a Langfuse score).

### 8. One check-in per day, in the evening
- **Context:** Several entries a day make the calendar and the statistics confusing.
- **Decision:** One entry per day. Opening the check-in again continues today's entry; it's analysed again as a whole.
- **Consequences:** A clean calendar with one value per metric and day. Requires the update-or-insert logic in `save_checkin`.

### 9. Weekly Insights, automatic once a week
- **Context:** Patterns need enough days to be real. An "analyse now" button invites over-interpretation of two entries.
- **Decision:** Generated automatically when the app opens, at least 7 days after the last one and with at least 3 new check-ins. Renamed from "Deep Dives" to make the rhythm clear.
- **Consequences:** Something to look forward to each week. The demo ships fixed insights, so they stay simple to read.

### 10. Two ways to deal with stress
- **Context:** "I'm panicking right now" and "this keeps happening every week" need very different help.
- **Decision:** Untangle has two modes. **Calm Now**: calming in the moment, small exercises and tips, no plan. **Stress Solving**: understand the stressor, make a plan from the user's own history, update it over time, mark it solved.
- **Consequences:** Each prompt can be focused. Calm Now can point to an existing plan. A solved plan feeds the community.

### 11. A moderated, anonymous community
- **Context:** Stories from people who solved similar stress are motivating, but personal details and unkind comments must never get through.
- **Decision:** Only solved plans can be shared. The AI drafts and anonymizes the post; the user edits it; a final AI check runs before publishing; comments are moderated the same way. The feed is read through database functions that never return user ids.
- **Alternatives:** Free posting (moderation risk), no community (less motivation).
- **Consequences:** Publishing needs the service role (users can't set `published` themselves). 10 example posts make the feed useful from day one.

---

## AI design

### 12. Structured outputs for everything the app reads
- **Context:** The app needs exact fields (scores, steps, citations), not prose.
- **Decision:** All non-chat calls use the Responses API with a strict JSON schema.
- **Consequences:** No fragile parsing. Schemas double as documentation of what each feature produces.

### 13. Code counts, the model interprets
- **Context:** Language models are bad at arithmetic and happily invent numbers.
- **Decision:** Weekly averages, deltas and counts are computed in code and given to the model as facts. The model only finds and explains patterns.
- **Consequences:** Numbers in the insights are always correct; the model's job is the part it's good at.

### 14. Citations by short label, validated in code
- **Context:** Every insight should link to the days behind it. Models garble long ids or invent them.
- **Decision:** Entries are shown to the model as `E1, E2 …` (and messages as `U1 …`, plans as `P1 …`). Code maps labels back to real ids, drops unknown ones, and drops findings with too few valid citations.
- **Consequences:** Every evidence chip in the app opens a real entry. The pattern is reused across features.

### 15. RAG with pgvector in the same database
- **Context:** The AI should remember similar past situations, not just the last three days.
- **Decision:** Embeddings live in Postgres (`pgvector`, HNSW index, cosine distance); the search is a SQL function under RLS.
- **Alternatives:** A separate vector database (a second system with its own access control to keep in sync).
- **Consequences:** A user can only ever find their own check-ins, enforced by the same RLS as everything else.

### 16. Topic chunks with small-to-big retrieval
- **Context:** One vector per check-in failed for long, multi-topic conversations ([lesson 1](lessons-learned.md#1-one-vector-per-conversation-dilutes-the-meaning)). One vector per message lacks context ("Maybe four hours.").
- **Decision:** The extraction that already runs splits each check-in into topics (category, title, summary, the user's words). Each topic gets a vector; the search finds the best topic, and the model gets the whole original conversation.
- **Consequences:** Much better recall at no extra AI call. Re-indexing is needed when the chunking changes.

### 17. The model decides when it's ready to make a plan
- **Context:** A "Make my plan" button from the start produced generic plans; a fixed number of questions felt robotic.
- **Decision:** The model appends a hidden `[[ready]]` marker once it knows the trigger, what's in the user's control and what they tried (allowed after 2 answers, forced after 5). The app strips the marker and shows the button.
- **Consequences:** Plans are based on real understanding. A simple, testable protocol between model and app.

---

## Reliability and operations

### 18. Saving a check-in in one transaction
- **Context:** Saving wrote to five places one after another; a failure in between left half a check-in, or an entry without its search index.
- **Decision:** All AI work (extraction, embeddings) first, then one Postgres function `save_checkin()` that does all writes in a single transaction, with the caller's rights (`security invoker`).
- **Alternatives:** Compensating deletes on failure (complicated and still racy). AI calls inside the transaction (holds locks for seconds).
- **Consequences:** All or nothing. The function is the single place that defines how a check-in is saved.

### 19. A daily AI quota that fails closed
- **Context:** A public demo link can be abused, and every AI call costs money.
- **Decision:** Before every AI call, a database function counts the call per user (80/day) and overall (4000/day). If the counter can't be checked, the request is refused. Plus a spending limit at OpenAI.
- **Consequences:** Costs are bounded even under abuse. A database problem makes the AI unavailable, deliberately.

### 20. Tracing with Langfuse, without an SDK
- **Context:** Without seeing inside requests, slow steps and silent failures stay invisible.
- **Decision:** Every request is a Langfuse trace with nested spans for database steps and AI calls. Spans are sent as OpenTelemetry JSON over HTTP in the background. Real users' text is masked; demo accounts are traced in full. Tracing **fails open**.
- **Alternatives:** The Langfuse SDK (another dependency in the Deno runtime, less visible). Logging only (no timeline, no token costs).
- **Consequences:** Latency, tokens, costs and errors per feature are visible. It already revealed a silent bug ([lesson 4](lessons-learned.md#4-a-silent-catch-hid-a-broken-feature)).

### 21. A web demo with a seeded persona
- **Context:** An interviewer won't install an app or write four weeks of check-ins.
- **Decision:** A web demo on Vercel. On desktop it shows the app in a phone frame with a pitch and a QR code. "Load the demo" fills a fresh anonymous account with Jonas: four weeks of check-ins, insights, plans and a community story, dated relative to today.
- **Consequences:** Every visitor gets their own isolated copy. Demo stories are private to their account (see [lesson 6](lessons-learned.md#6-shared-state-in-a-public-demo-needs-care)).

---

## Design

### 22. A calm design that doesn't look like a typical AI app
- **Context:** Blue-purple gradients and sparkles everywhere read as "generic AI". A stress app should feel calm and human.
- **Decision:** "Soft colour fields": ivory background, one colour per metric (clay for stress, indigo for sleep, sage for mood), DM Sans, rounded cards, gentle animations that respect reduce-motion. Sparkle marks only on AI-written content. No spinners: loading is a slowly breathing logo or soft dots, because a spinner signals hurry.
- **Consequences:** A recognisable look; the colours carry meaning across the app (the chart, the calendar, the insight cards).

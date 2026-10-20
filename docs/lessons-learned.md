# Lessons learned

What went wrong or surprised me while building Destress AI, how I found out, and what I changed. Each one: **problem → how it showed → fix → takeaway.**

**AI and RAG**
1. [One vector per conversation dilutes the meaning](#1-one-vector-per-conversation-dilutes-the-meaning)
2. [Models believe their own words](#2-models-believe-their-own-words)
3. [Never let a model invent references](#3-never-let-a-model-invent-references)
4. [A silent catch hid a broken feature](#4-a-silent-catch-hid-a-broken-feature)
5. [Prompts need context rules, not just tone](#5-prompts-need-context-rules-not-just-tone)

**Performance and operations**

6. [Shared state in a public demo needs care](#6-shared-state-in-a-public-demo-needs-care)
7. [Measure before claiming a fix](#7-measure-before-claiming-a-fix)
8. [Saving in several steps leaves half-saved data](#8-saving-in-several-steps-leaves-half-saved-data)
9. [Fail closed or fail open is a design decision](#9-fail-closed-or-fail-open-is-a-design-decision)

**Product**

10. [A demo is a product of its own](#10-a-demo-is-a-product-of-its-own)

**Small gotchas worth remembering**: [at the end](#small-gotchas)

---

## 1. One vector per conversation dilutes the meaning

- **Problem:** RAG v1 stored one embedding per check-in (title, summary and the user's words). That worked for short entries, but a long check-in about four topics (an exam, mum's health, rent, a walk) wasn't found for any of them.
- **How it showed:** A test query "panicking before an exam" didn't find that check-in at all; rent came at rank 3 (similarity 0.32), mum at rank 2 (0.40). One vector had become the *average* of four topics, close to none of them.
- **Rejected fix:** One vector per message. One topic often spans several messages, and single messages lack context ("Maybe four hours.").
- **Fix (my design):** The structured extraction that already runs after each check-in now also splits it into **topics**: a fixed category, a free-text title, a summary and the labels of the user's messages (`U2`, `U4`); code fills in the exact words. One vector per topic. The search finds the best topic per check-in, and the chat gets the **whole original conversation** (small-to-big / parent-document retrieval).
- **Result:** exam query: not found → rank 2 (0.56); rent: rank 3 → rank 1 (0.60); mum: rank 2 → rank 1 (0.54). No extra AI call.
- **Takeaway:** Chunk by meaning, not by size. Search with small pieces, answer with big ones.

## 2. Models believe their own words

- **Problem:** The memory extraction wrote the companion's *own suggestion* into the user's memory as if it were a fact about them. Later the same happened in Untangle: a "lesson from your past" came from an old AI suggestion, not from something the user said.
- **How it showed:** Reading the saved memory and the plan's "what your past shows" section next to the original conversations.
- **Fix:** Prompt rules: record only what the user said or experienced, never a suggestion Destress AI made. Old conversations in the context are labelled `Destress AI: …` with a note that those lines are the companion's own replies, not facts.
- **Takeaway:** Whatever sits in the context counts as truth for the model. Label who said what.

## 3. Never let a model invent references

- **Problem:** Every Weekly Insight should link to the check-ins behind it. Models garble long UUIDs or make up references that look plausible.
- **Fix:** Entries are shown with short labels (`E1`, `E2` …). The model cites labels; code maps them back to real ids, drops unknown labels, and drops findings with fewer than two valid citations (counted as `dropped_findings`).
- **Result:** In testing, 0 findings had to be dropped, and every evidence chip in the app opens a real entry. The same pattern is used for topic chunks (`U1`), plan lessons (`E1`) and plan outcomes (`P1`).
- **Takeaway:** Give the model easy handles and validate everything that points into your data.

## 4. A silent catch hid a broken feature

- **Problem:** When I added tracing, a script changed `getEmbedder()` to `getEmbedder(trace)` everywhere, including inside a helper function where `trace` didn't exist. That threw an error, which the helper's `try/catch` swallowed and turned into "no related check-ins".
- **How it showed:** Nothing failed visibly; the check-in chat simply lost its memory of past conversations. I found it while checking which AI calls each trace contains: the `embed` step was missing in `checkin-chat`. Supabase doesn't type-check functions on deploy, so the mistake went through.
- **Fix:** Pass the trace into the helper explicitly. Verified: the reply referred back to earlier nights and Markus again.
- **Takeaways:** A `catch` that returns an empty result needs at least a log line someone looks at. Observability shows what *didn't* happen. Type-check server code before deploying.

## 5. Prompts need context rules, not just tone

- **Problem:** Calm Now asked someone lying awake in the dark to "name three things you can see". Right after a guided breathing minute, it suggested breathing again. Its replies were often several statements in a row instead of a conversation.
- **Fix:** Explicit rules in the prompt: every exercise must fit where the user is (in bed: eyes closed, no walking, no screens; at work: only discreet things; if unclear, ask first), never repeat an exercise, at most two short sentences ending with a question or one small task. The app tells the AI when the guided breathing already happened.
- **Result:** In a later test, the AI first asked "Are you still with people right now?" before suggesting anything.
- **Takeaway:** "Be warm and supportive" isn't enough. Spell out the situations and the constraints.

## 6. Shared state in a public demo needs care

- **Problem:** Every "Load the demo" creates a fresh account and publishes Jonas's success story to the community. After a few restarts the feed showed the same post many times, for every visitor.
- **Fix:** Demo stories are flagged `is_demo` and only visible to the account that loaded them; earlier copies were marked too.
- **Takeaway:** Isolated per-user demo data is easy; anything that lands in a *shared* space needs a rule for who sees it.

## 7. Measure before claiming a fix

- **Problem:** The first search after a deploy took **22.4 s**, the next ones about **1 s**.
- **First fix:** A warm-up ping from the app to every function on start: a GET that each function rejects before the quota check or any AI call, but that starts the function.
- **Measured:** The pings each took ~3 s in the background, so the function start was covered. But the first real search still took **10.7 s**, then 2.8 s, then 1.0 s. The rest happens inside the first real request (first connection to OpenAI, cold database caches), where a ping can't reach.
- **Also measured:** Saving a check-in takes **~18 s** consistently (17.6 s, 17.9 s); the chat reply streams, so it feels faster. Next step: confirm in the trace that the structured-output call is the bottleneck, then try a faster extraction model or move work to the background.
- **Takeaway:** A plausible theory plus a fix isn't a result. Measure before and after, and separate "the user waited" from "my code ran".

## 8. Saving in several steps leaves half-saved data

- **Problem:** Saving a check-in wrote to five places one after another. A failure halfway left an entry without its values or memory. When continuing a day's entry, the old search chunks were deleted *before* the new ones were saved.
- **Fix:** All AI work first, then one Postgres function `save_checkin()` that does every write in a single transaction, with the caller's rights so row-level security still applies.
- **Takeaway:** Keep slow, unreliable work (AI calls) outside the transaction, and make the transaction itself small and all-or-nothing.

## 9. Fail closed or fail open is a design decision

- **Context:** Two checks run on every request: the AI quota and tracing.
- **Decision:** The quota **fails closed**: if the counter can't be checked, the request is refused, because it protects money. Tracing **fails open**: if Langfuse is down, the app works normally, because observability must never break the product.
- **Takeaway:** For every dependency, ask "what happens when this is down?" and decide on purpose.

## 10. A demo is a product of its own

- **Problem:** The first demo persona had too many threads (Sunday dread, football, a big presentation, plan versions). It showed every feature but was hard to grasp in a minute.
- **Fix:** One clear story: Jonas's boss gives him tasks after 5 pm, he says yes, works late and sleeps badly; walks and football help. Three insights, each one plain sentence with a number. One active plan, one solved plan with a community story.
- **Takeaway:** The person looking at a demo has a minute, not a week. Design the data for them: one story, short sentences, numbers that can be checked.

---

## Small gotchas

- **Bulk inserts with different keys:** PostgREST builds one column list for a multi-row insert; rows missing a key got `null` for it. Give every row the same keys.
- **The service role needs GRANTs too** when tables aren't exposed automatically.
- **Vercel never uploads folders named `node_modules`**, including `dist/assets/node_modules` from the Expo web export: fonts and icons vanished. Renamed the folder and rewrote the paths.
- **The Vercel CLI can create a `.env.local` with a token** inside the build folder. Never deploy env files: `.vercelignore` with `.env*`.
- **A streamed response can contain the reply twice** (two output items); only the first item is used.
- **Browser locale vs. app language:** the demo's AI texts came out in German because the browser was German; demo accounts now always use English, and dates are formatted in English everywhere.
- **Supabase doesn't type-check Edge Functions on deploy:** a reference to a variable that doesn't exist deploys fine and fails at runtime.

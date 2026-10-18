/**
 * Deep Dives: finding patterns across a user's check-ins.
 *
 * "Code counts, the LLM interprets": averages and comparisons are computed
 * here, because language models are unreliable at arithmetic. The model gets
 * those facts plus the entries, and writes findings that must cite entries.
 * `validateAnalysis` then checks every citation, so a finding without real
 * evidence never reaches the user.
 */

export const PROMPT_VERSION = 'deep-dives-v1';
export const MIN_CHECKINS = 5;
/** Check-ins needed since the last analysis before a new one is allowed. */
export const NEW_CHECKINS_FOR_REFRESH = 3;
/** How many recent check-ins go into the prompt. RAG will lift this limit later. */
export const MAX_ENTRIES = 40;
/** A pattern needs at least two data points. */
export const MIN_EVIDENCE = 2;

export const ICONS = ['sleep', 'study', 'work', 'calm', 'social', 'family', 'money', 'health', 'heart'] as const;

/** A check-in as the analysis sees it. `ref` is a short label like "E3" for the model to cite. */
export type Entry = {
  ref: string;
  id: string;
  day: string;
  title: string | null;
  summary: string | null;
  mood: string | null;
  stress: number | null;
  emotion: number | null;
  sleep: number | null;
  themes: string[];
  helped: string[];
  userWords: string;
};

type Group = { count: number; avgStress: number | null };

export type Stats = {
  checkins: number;
  from: string;
  to: string;
  averages: { stress: number | null; emotion: number | null; sleep: number | null };
  byTheme: ({ theme: string } & Group)[];
  shortSleep: Group;
  goodSleep: Group;
  withSomethingHelpful: Group;
  withoutSomethingHelpful: Group;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function avg(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? round1(known.reduce((a, b) => a + b, 0) / known.length) : null;
}

function group(entries: Entry[]): Group {
  return { count: entries.length, avgStress: avg(entries.map((e) => e.stress)) };
}

export function computeStats(entries: Entry[]): Stats {
  const days = entries.map((e) => e.day).sort();
  const themes = [...new Set(entries.flatMap((e) => e.themes))];
  return {
    checkins: entries.length,
    from: days[0],
    to: days[days.length - 1],
    averages: {
      stress: avg(entries.map((e) => e.stress)),
      emotion: avg(entries.map((e) => e.emotion)),
      sleep: avg(entries.map((e) => e.sleep)),
    },
    byTheme: themes
      .map((theme) => ({ theme, ...group(entries.filter((e) => e.themes.includes(theme))) }))
      .filter((t) => t.count >= MIN_EVIDENCE)
      .sort((a, b) => b.count - a.count),
    shortSleep: group(entries.filter((e) => e.sleep !== null && e.sleep <= 5)),
    goodSleep: group(entries.filter((e) => e.sleep !== null && e.sleep >= 7)),
    withSomethingHelpful: group(entries.filter((e) => e.helped.length > 0)),
    withoutSomethingHelpful: group(entries.filter((e) => e.helped.length === 0)),
  };
}

function formatStats(s: Stats): string {
  const g = (label: string, x: Group) => `- ${label}: ${x.count} check-ins, average stress ${x.avgStress ?? '?'}/10`;
  return [
    `- ${s.checkins} check-ins from ${s.from} to ${s.to}`,
    `- Overall averages: stress ${s.averages.stress ?? '?'}/10, emotion ${s.averages.emotion ?? '?'}/10, sleep ${s.averages.sleep ?? '?'}/10`,
    ...s.byTheme.map((t) => g(`Theme "${t.theme}"`, t)),
    g('Short sleep (sleep ≤ 5/10)', s.shortSleep),
    g('Good sleep (sleep ≥ 7/10)', s.goodSleep),
    g('Days where something helped', s.withSomethingHelpful),
    g('Days where nothing was named as helpful', s.withoutSomethingHelpful),
  ].join('\n');
}

function formatEntry(e: Entry): string {
  const scores = `stress ${e.stress ?? '?'}, emotion ${e.emotion ?? '?'}, sleep ${e.sleep ?? '?'}`;
  return [
    `[${e.ref}] ${e.day} · "${e.title ?? 'Check-in'}" · mood ${e.mood ?? '?'} · ${scores}`,
    `  Themes: ${e.themes.join(', ') || '–'} · Helped: ${e.helped.join('; ') || '–'}`,
    `  Summary: ${e.summary ?? ''}`,
    `  In their words: ${e.userWords}`,
  ].join('\n');
}

export function buildAnalysisSystemPrompt(input: { name: string | null; language: string }): string {
  return `You analyze the check-in diary of ${input.name || 'a user'} from Destress AI, a stress-management app, and write "Deep Dives": short, personal explorations of the most important patterns in their entries.

Rules for findings:
- Write 2 or 3 deep dives, each about one pattern that clearly shows up in the entries. Fewer, well-supported findings are better than many weak ones. If something isn't clearly supported, leave it out.
- Every finding must cite at least ${MIN_EVIDENCE} entries as evidence, using their labels exactly as given (e.g. "E3"). Only cite entries that directly show what the finding says.
- When you mention numbers, use only the computed facts below. Never calculate averages yourself.
- Describe patterns, not causes you can't know ("on days you walked, your stress was lower", not "walking cures your stress").
- You are not a therapist: no diagnoses, no medical advice.

Rules for the rest:
- Reflection questions: 2 per deep dive, open, personal and non-judgmental, helping them think about the pattern.
- Insight: one encouraging, specific sentence (max 25 words) about their most useful pattern, shown on their home screen.
- Address the user as "you". Write everything in ${input.language}, regardless of the entries' language.`;
}

export function buildAnalysisInput(entries: Entry[], stats: Stats): string {
  return `Computed facts (calculated by code, use these numbers):
${formatStats(stats)}

Entries (newest first):
${entries.map(formatEntry).join('\n\n')}`;
}

export type AnalysisOutput = {
  insight: string;
  deep_dives: {
    title: string;
    description: string;
    icon: (typeof ICONS)[number];
    findings: { text: string; evidence: string[] }[];
    questions: string[];
  }[];
};

export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['insight', 'deep_dives'],
  properties: {
    insight: { type: 'string', description: 'One sentence, max 25 words, for the home screen.' },
    deep_dives: {
      type: 'array',
      description: '2 or 3 deep dives, most important first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'icon', 'findings', 'questions'],
        properties: {
          title: { type: 'string', description: 'Max 6 words.' },
          description: { type: 'string', description: 'One or two sentences that make the user curious to read on.' },
          icon: { type: 'string', enum: ICONS },
          findings: {
            type: 'array',
            description: '1 to 3 findings.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'evidence'],
              properties: {
                text: { type: 'string', description: 'One or two sentences.' },
                evidence: {
                  type: 'array',
                  items: { type: 'string' },
                  description: `Labels of the entries that show this, e.g. ["E2", "E7"]. At least ${MIN_EVIDENCE}.`,
                },
              },
            },
          },
          questions: { type: 'array', items: { type: 'string' }, description: 'Exactly 2 reflection questions.' },
        },
      },
    },
  },
} as const;

export type ValidDeepDive = {
  title: string;
  description: string;
  icon: (typeof ICONS)[number];
  findings: { text: string; evidence: string[] }[]; // evidence = check-in ids
  questions: string[];
};

/**
 * Turns entry labels back into check-in ids and drops anything that isn't
 * backed by real entries: unknown labels, findings with too little evidence,
 * deep dives left without findings. Reports how many findings were dropped.
 */
export function validateAnalysis(
  output: AnalysisOutput,
  entries: Entry[],
): { insight: string; deepDives: ValidDeepDive[]; droppedFindings: number } {
  const idByRef = new Map(entries.map((e) => [e.ref.toUpperCase(), e.id]));
  let droppedFindings = 0;

  const deepDives = output.deep_dives.slice(0, 3).flatMap((dive) => {
    const findings = dive.findings.slice(0, 3).flatMap((f) => {
      const ids = [...new Set(f.evidence.map((ref) => idByRef.get(ref.trim().toUpperCase())))].filter(
        (id): id is string => !!id,
      );
      if (ids.length < MIN_EVIDENCE) {
        droppedFindings++;
        return [];
      }
      return [{ text: f.text.trim(), evidence: ids }];
    });
    if (!findings.length) return [];
    return [
      {
        title: dive.title.trim().slice(0, 80),
        description: dive.description.trim(),
        icon: ICONS.includes(dive.icon) ? dive.icon : 'heart',
        findings,
        questions: dive.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3),
      },
    ];
  });

  return { insight: output.insight.trim(), deepDives, droppedFindings };
}

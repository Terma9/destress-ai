/**
 * The demo persona an interviewer can load: Jonas, 28, project manager.
 *
 * One story, easy to grasp at a glance:
 *   Problem: his team lead Markus hands him tasks after 5 pm. Jonas says yes,
 *            works late and then lies awake (about 5 hours of sleep).
 *   Helps:   walks and football (about 8 hours of sleep afterwards).
 *   Plans:   "Saying no to my boss" (active) and "Falling asleep after
 *            stressful days" (solved, shared in the community).
 *   Arc:     weeks 1–2 hard, week 3 the plan starts, week 4 the talk with
 *            Markus and the calmest week.
 *
 * Dates are relative: `week` 1–4 are the four weeks ending on the most recent
 * Sunday before today, `weekday` 1 = Monday … 7 = Sunday. Week 5 entries fill
 * the days between that Sunday and today (only those already past). Today
 * stays empty for the live check-in. `sleep` is the night before the entry.
 */

type Msg = { role: 'assistant' | 'user'; content: string };

/** A conversation; lines alternate AI, user, AI, user, … */
const chat = (...lines: string[]): Msg[] =>
  lines.map((content, i) => ({ role: i % 2 === 0 ? 'assistant' : 'user', content }));

export type DemoCheckin = {
  key: string;
  week: number;
  weekday: number;
  title: string;
  summary: string;
  mood: 'great' | 'good' | 'ok' | 'low' | 'stressed';
  stress: number;
  sleep: number;
  emotion: number;
  themes: string[];
  helped: string[];
  reasons: { stress: string; sleep: string; mood: string };
  messages: Msg[];
};

export const name = 'Jonas';

export const memory =
  'Jonas, 28, project manager at a digital agency. His team lead Markus often hands him tasks after 5 pm; Jonas tends to say yes, works late and then lies awake. Walks and football with friends help him sleep. He is practising saying no ("I can do it first thing tomorrow") and agreed with Markus that tasks after 4 pm wait until the next morning. Prefers short, practical tips.';

export const checkins: DemoCheckin[] = [
  // ─── Week 1: late tasks, short nights ───────────────────────────────────
  {
    key: 'w1-mon', week: 1, weekday: 1, title: 'A report at 5:40 pm',
    summary: 'Markus asked for a client report at 5:40 pm, due the next morning. You said yes and worked until 10 pm.',
    mood: 'stressed', stress: 8, sleep: 7, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'A late task from Markus kept you at work until 10 pm.', sleep: 'You slept about seven hours.', mood: 'You felt frustrated and drained.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "Honestly annoying. At 5:40 Markus came over and asked for the client report 'by tomorrow 9, should be quick'. It wasn't quick. I just got home, it's 10:15.",
      "That's a long day, and a frustrating way to end it. How do you feel right now?",
      "Tired and angry. Mostly at myself, because I just said yes again without thinking.",
      "It makes sense that you're tired. Saying yes in the moment is very human, especially to your boss. For tonight: is there anything that would help you wind down before bed?",
      'Probably no more screens. I\'ll try.',
    ),
  },
  {
    key: 'w1-tue', week: 1, weekday: 2, title: 'Lay awake until 1',
    summary: 'You lay awake until 1 am going over the report and slept about five hours. A tired, slow day.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'You were tired and behind on your own tasks.', sleep: 'You lay awake until 1 am and slept about five hours.', mood: 'You felt tired and flat.' },
    messages: chat(
      'Hi Jonas, how did you sleep after last night?',
      'Badly. I lay awake until 1, my head kept going through the report and what Markus would say. Maybe 5 hours.',
      "That's rough. How was the day with so little sleep?",
      "Slow. Three coffees. And I didn't get to my own tasks because of the report yesterday.",
      'Sounds like yesterday cost you more than one evening. Try to get to bed a little earlier tonight.',
    ),
  },
  {
    key: 'w1-wed', week: 1, weekday: 3, title: '"Just a small change"',
    summary: 'At 6 pm Markus asked for "a small change" to the slides. It took until 9 pm.',
    mood: 'stressed', stress: 8, sleep: 6, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'Another late request from Markus.', sleep: 'About six hours.', mood: 'You sounded fed up.' },
    messages: chat(
      'Hi Jonas, how was today?',
      "Same story. 6 pm, Markus: 'just a small change to the slides'. Finished at 9. I had wanted to go to the gym.",
      'That\'s the second late evening this week. How are you holding up?',
      "I'm fed up. It's not even the work, it's that it always comes at the end of the day.",
      "That's an important point: the timing seems to be the problem, more than the amount. Let's keep an eye on it.",
    ),
  },
  {
    key: 'w1-thu', week: 1, weekday: 4, title: 'Running on empty',
    summary: 'Another short night with about five hours of sleep. You felt irritable all day.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'Tired and irritable at work.', sleep: 'About five hours, you lay awake again.', mood: 'You felt irritable.' },
    messages: chat(
      'Hi Jonas, how are you today?',
      'Running on empty. Slept 5 hours again, couldn\'t switch off after the slides. I snapped at a colleague in the morning, felt bad about it.',
      "Short nights make everyone more irritable, so be kind to yourself. Did you have a moment to talk to your colleague?",
      'Yes, I apologised. All fine.',
      "Good that you sorted it out. I hope tonight brings you more sleep.",
    ),
  },
  {
    key: 'w1-sat', week: 1, weekday: 6, title: 'A long walk by the lake',
    summary: 'A two-hour walk by the lake with your sister. You felt free for the first time this week.',
    mood: 'great', stress: 3, sleep: 6, emotion: 7, themes: ['health', 'family'], helped: ['A long walk by the lake'],
    reasons: { stress: 'A free day outside.', sleep: 'About six hours.', mood: 'You said you felt free.' },
    messages: chat(
      'Hi Jonas, how is your Saturday?',
      'Really nice. Walked around the lake with my sister for two hours. First time this week my head was completely quiet.',
      "That sounds wonderful. What do you think made your head so quiet?",
      'Being outside, moving, and not looking at my phone.',
      'Worth remembering. Enjoy the rest of your weekend!',
    ),
  },
  {
    key: 'w1-sun', week: 1, weekday: 7, title: 'Slept eight hours',
    summary: 'After the walk you slept eight hours, the best night in a while. A calm Sunday.',
    mood: 'good', stress: 3, sleep: 8, emotion: 7, themes: ['sleep'], helped: ['Yesterday\'s walk'],
    reasons: { stress: 'A quiet Sunday at home.', sleep: 'You slept eight hours after the walk.', mood: 'Rested and calm.' },
    messages: chat(
      'Hi Jonas, how was your Sunday?',
      'Calm. And I slept 8 hours last night, first time in ages. I think the walk did that.',
      "That fits: you were outside and moving for two hours. How do you feel about the week ahead?",
      'Okay. Hoping Markus has a quieter week.',
    ),
  },

  // ─── Week 2: same pattern, first walks, Calm now ────────────────────────
  {
    key: 'w2-mon', week: 2, weekday: 1, title: 'A pitch deck by tomorrow',
    summary: 'At 6 pm Markus asked for a pitch deck by the next day. You said yes again and worked until 9:30 pm.',
    mood: 'stressed', stress: 8, sleep: 8, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'A late task from Markus, again until 9:30 pm.', sleep: 'You slept eight hours after a calm weekend.', mood: 'You were annoyed with yourself.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "Started great after the weekend. Then 6 pm: Markus needs a pitch deck by tomorrow. I said 'sure, no problem'. Why do I always do that?",
      'What goes through your head in the moment he asks?',
      "That saying no would look lazy. And that it's faster to just do it than to discuss it.",
      "That's a very common thought. But it's worth noticing what the 'faster' option costs you afterwards. How late did it get?",
      '9:30.',
    ),
  },
  {
    key: 'w2-tue', week: 2, weekday: 2, title: 'Five hours again',
    summary: 'You slept about five hours after the late evening. You made a plan for your sleep in Stress solving.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['sleep'], helped: [],
    reasons: { stress: 'Tired, and the deck was due.', sleep: 'About five hours, you lay awake again.', mood: 'Tired, but glad to have a plan.' },
    messages: chat(
      'Hi Jonas, how did you sleep?',
      "5 hours. Again. Every time I work late, I can't fall asleep. So I made a sleep plan in Stress solving today.",
      "That's a good step. What's in it?",
      'Evening walks, phone out of the bedroom, and a note by the bed for thoughts that keep me awake.',
      "That's clear and doable. I'm curious how the next nights go.",
    ),
  },
  {
    key: 'w2-wed', week: 2, weekday: 3, title: 'Markus presented my work',
    summary: 'In the client meeting Markus presented your pitch deck as his own work. A Calm now session helped you go from 8 to 4.',
    mood: 'stressed', stress: 8, sleep: 6, emotion: 3, themes: ['work'], helped: ['Calm now: breathing out slowly', 'Writing down what you want to say'],
    reasons: { stress: 'Markus presented your work as his own.', sleep: 'About six hours.', mood: 'Hurt and angry, calmer after Calm now.' },
    messages: chat(
      'Hi Jonas, how was your day?',
      "Honestly the worst this month. In the client meeting Markus presented MY pitch deck as his work. Didn't mention me once. I was shaking afterwards.",
      "That really hurts, especially after you worked late for it. How are you now?",
      'Better. I did a Calm now session right after, breathing and writing down what I would like to say to him. Went from 8 to 4.',
      "That's a real shift. You don't have to decide anything tonight. What would help you most this evening?",
      'Cooking something and going to bed early.',
    ),
  },
  {
    key: 'w2-thu', week: 2, weekday: 4, title: 'Football with friends',
    summary: 'You slept badly after yesterday, but football with friends in the evening helped you switch off.',
    mood: 'good', stress: 4, sleep: 5, emotion: 7, themes: ['health', 'social'], helped: ['Football with friends'],
    reasons: { stress: 'A normal day, and football cleared your head.', sleep: 'About five hours after yesterday.', mood: 'You felt good after the game.' },
    messages: chat(
      'Hi Jonas, how was today?',
      'Slept badly after yesterday. But I played football with friends tonight, first time in weeks. Feels great.',
      'That sounds like exactly what you needed. How is your head now?',
      'Empty, in a good way.',
      'Enjoy that feeling and sleep well!',
    ),
  },
  {
    key: 'w2-fri', week: 2, weekday: 5, title: 'Rested Friday',
    summary: 'After football you slept almost eight hours. A good, quiet end to the week.',
    mood: 'good', stress: 3, sleep: 7, emotion: 7, themes: ['sleep'], helped: ['Football yesterday'],
    reasons: { stress: 'A quiet Friday.', sleep: 'About seven and a half hours after football.', mood: 'Rested and content.' },
    messages: chat(
      'Happy Friday, Jonas. How did you sleep?',
      'Really well, almost 8 hours. Football yesterday plus no phone in the bedroom.',
      "Two things from your sleep plan at once. How does the day feel?",
      'Good. Quiet Friday, left at 5.',
    ),
  },
  {
    key: 'w2-sun', week: 2, weekday: 7, title: 'Sunday walk',
    summary: 'A long walk in the park on Sunday afternoon. Calm and relaxed.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['health'], helped: ['A walk in the park'],
    reasons: { stress: 'A relaxed Sunday.', sleep: 'About seven hours.', mood: 'Relaxed and happy.' },
    messages: chat(
      'Hi Jonas, how was your Sunday?',
      'Lovely. Long walk in the park, then cooked. Feeling relaxed.',
      'Walks seem to really work for you. Have a good evening!',
    ),
  },

  // ─── Week 3: one more late yes, then the plan to say no ─────────────────
  {
    key: 'w3-mon', week: 3, weekday: 1, title: 'Enough is enough',
    summary: 'Markus asked for something at 5:30 pm again and you said yes. Afterwards you made a plan for saying no.',
    mood: 'stressed', stress: 8, sleep: 8, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'Another late task from Markus.', sleep: 'You slept eight hours after the Sunday walk.', mood: 'Frustrated, but determined.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "Great sleep, and then 5:30 pm: Markus, 'quick favour'. I said yes. Worked till 9. I'm done with this. I made a plan in Stress solving tonight: saying no to Markus.",
      "That's a big decision. What's the first step?",
      "Next time he asks late, I say: 'I can do it first thing tomorrow.' I wrote the sentence down.",
      'Having the sentence ready makes it much easier. Good luck, Jonas.',
    ),
  },
  {
    key: 'w3-tue', week: 3, weekday: 2, title: 'Tired, but ready',
    summary: 'Another short night of about five hours. You practised your sentence for Markus.',
    mood: 'ok', stress: 6, sleep: 5, emotion: 5, themes: ['sleep', 'work'], helped: [],
    reasons: { stress: 'Tired after the late evening.', sleep: 'About five hours.', mood: 'Tired, but motivated.' },
    messages: chat(
      'Hi Jonas, how are you today?',
      "Tired, 5 hours again. Typical after a late evening. But I'm ready for the next time Markus asks.",
      "You now know exactly what late evenings cost you. That's a strong reason to try the sentence.",
    ),
  },
  {
    key: 'w3-wed', week: 3, weekday: 3, title: 'I said no!',
    summary: 'At 5:30 pm Markus asked again. You said "I can do it first thing tomorrow", and he said fine. Then you went for a walk.',
    mood: 'great', stress: 4, sleep: 6, emotion: 7, themes: ['work', 'health'], helped: ['Saying "I can do it first thing tomorrow"', 'An evening walk'],
    reasons: { stress: 'You said no to a late task, and it was fine.', sleep: 'About six hours.', mood: 'You sounded proud.' },
    messages: chat(
      'Hi Jonas, how was today?',
      "I DID IT. 5:30, Markus with a 'quick thing'. I said 'I can do it first thing tomorrow.' And he just said: 'Sure, fine.' That's it!",
      "That's great, congratulations! How did it feel?",
      "My heart was pounding. But then I left at 6 and went for a walk. Can't believe how easy it was in the end.",
      'You just learned that a no can be completely fine. Enjoy your evening!',
    ),
  },
  {
    key: 'w3-thu', week: 3, weekday: 4, title: 'Eight hours',
    summary: 'After the walk you slept eight hours and did the task from Markus first thing in the morning.',
    mood: 'good', stress: 4, sleep: 8, emotion: 7, themes: ['work', 'sleep'], helped: ['Yesterday\'s walk'],
    reasons: { stress: 'A normal day, the task was done by 10.', sleep: 'You slept eight hours.', mood: 'Calm and focused.' },
    messages: chat(
      'Hi Jonas, how was your Thursday?',
      'Slept 8 hours after the walk. Did the task for Markus at 9 this morning, finished by 10. Nobody even noticed it came a day "late".',
      "That's an important experience: the morning was perfectly fine. How do you feel?",
      'Light. Kind of silly I never tried this before.',
    ),
  },
  {
    key: 'w3-sat', week: 3, weekday: 6, title: 'Hiking',
    summary: 'A hike with friends on Saturday. You felt great.',
    mood: 'great', stress: 2, sleep: 7, emotion: 8, themes: ['health', 'social'], helped: ['Hiking with friends'],
    reasons: { stress: 'A free Saturday outside.', sleep: 'About seven hours.', mood: 'You felt great.' },
    messages: chat('Hi Jonas, how is your Saturday?', 'Went hiking with friends. Perfect weather, perfect day.', 'Sounds like a perfect Saturday. Enjoy it!'),
  },

  // ─── Week 4: the talk with Markus, the calmest week ─────────────────────
  {
    key: 'w4-mon', week: 4, weekday: 1, title: 'Preparing the talk',
    summary: 'You prepared a short talk with Markus about late tasks and booked 10 minutes with him for Tuesday.',
    mood: 'ok', stress: 5, sleep: 7, emotion: 6, themes: ['work'], helped: [],
    reasons: { stress: 'A bit nervous about the talk.', sleep: 'About seven hours.', mood: 'Nervous, but okay.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "Okay. I booked 10 minutes with Markus tomorrow. I want to ask that tasks after 4 pm wait until the next morning, unless it's really urgent.",
      "That's a clear and fair request. How do you feel about it?",
      'Nervous. But after last week I think he\'ll be okay with it.',
      "You already have proof that he can be. Good luck tomorrow!",
    ),
  },
  {
    key: 'w4-tue', week: 4, weekday: 2, title: 'The talk went well',
    summary: 'Markus agreed: tasks after 4 pm wait until the next morning, unless urgent. You celebrated with football.',
    mood: 'great', stress: 4, sleep: 7, emotion: 8, themes: ['work', 'health'], helped: ['The talk with Markus', 'Football with friends'],
    reasons: { stress: 'Nervous before the talk, relieved after.', sleep: 'About seven hours.', mood: 'Relieved and happy.' },
    messages: chat(
      'Hi Jonas, how did the talk go?',
      "Really well! Markus said he didn't even notice he always comes so late. He agreed: after 4 pm it waits until the next morning, unless it's really urgent.",
      "That's a big step, well done. How do you feel?",
      'Relieved. Went to football afterwards to celebrate.',
      'You earned it. Enjoy the evening!',
    ),
  },
  {
    key: 'w4-wed', week: 4, weekday: 3, title: 'Eight hours again',
    summary: 'After football you slept eight hours and had a calm, focused day.',
    mood: 'great', stress: 3, sleep: 8, emotion: 8, themes: ['sleep', 'work'], helped: ['Football yesterday'],
    reasons: { stress: 'A calm, focused day.', sleep: 'You slept eight hours.', mood: 'You felt great.' },
    messages: chat(
      'Hi Jonas, how was your Wednesday?',
      'Slept 8 hours after football. Focused day, left at 6. This is how work should feel.',
      'It sounds like your plans are really working. Enjoy the evening!',
    ),
  },
  {
    key: 'w4-thu', week: 4, weekday: 4, title: 'The new rule works',
    summary: 'Markus came by at 5 pm and then said himself: "That can wait until tomorrow." You marked your sleep plan as solved.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work', 'sleep'], helped: ['The 4 pm rule with Markus'],
    reasons: { stress: 'The new rule with Markus worked.', sleep: 'About seven hours.', mood: 'Happy and relaxed.' },
    messages: chat(
      'Hi Jonas, how was today?',
      "Funny moment: Markus came by at 5, stopped and said 'ah, that can wait until tomorrow'. The rule works! And I marked my sleep plan as solved, I've slept 7–8 hours almost every night this week.",
      "Two wins in one day. What made the biggest difference for your sleep?",
      'The walks and football. And fewer late evenings, of course.',
      "That's a great combination. Maybe share your story in the community, it could help someone.",
    ),
  },
  {
    key: 'w4-sun', week: 4, weekday: 7, title: 'A calm Sunday',
    summary: 'A long walk and a quiet evening. The calmest week in a month.',
    mood: 'great', stress: 2, sleep: 8, emotion: 8, themes: ['health'], helped: ['A long walk'],
    reasons: { stress: 'A calm Sunday after a good week.', sleep: 'You slept eight hours.', mood: 'Happy and calm.' },
    messages: chat(
      'Hi Jonas, how was your Sunday?',
      'Long walk, quiet evening. Best week in a month honestly.',
      "It really was: your stress was the lowest it's been. Enjoy the evening, Jonas.",
    ),
  },

  // ─── Week 5: the days since (only those already past are loaded) ─────────
  {
    key: 'w5-mon', week: 5, weekday: 1, title: 'Good start',
    summary: 'A good Monday. You left at 6 pm.',
    mood: 'good', stress: 4, sleep: 8, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A normal Monday.', sleep: 'About eight hours.', mood: 'Good and focused.' },
    messages: chat('Hi Jonas, how was your Monday?', 'Good! Normal day, left at 6.', 'Great start into the week.'),
  },
  {
    key: 'w5-tue', week: 5, weekday: 2, title: 'Football',
    summary: 'A normal day and football in the evening.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['health', 'social'], helped: ['Football with friends'],
    reasons: { stress: 'An easy day plus football.', sleep: 'About seven hours.', mood: 'You felt great.' },
    messages: chat('Evening Jonas, how was today?', 'Football tonight, great as always.', 'Enjoy the evening!'),
  },
  {
    key: 'w5-wed', week: 5, weekday: 3, title: 'Calm day',
    summary: 'A calm day after a good night.',
    mood: 'good', stress: 3, sleep: 8, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A calm workday.', sleep: 'About eight hours.', mood: 'Calm.' },
    messages: chat('Hi Jonas, how are you?', 'Calm day, slept well.', 'Good to hear. Rest well.'),
  },
  {
    key: 'w5-thu', week: 5, weekday: 4, title: 'Tomorrow morning',
    summary: 'Markus asked for something at 5 pm. You said tomorrow morning, and it was fine.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: ['Saying "first thing tomorrow"'],
    reasons: { stress: 'A late request, handled calmly.', sleep: 'About seven hours.', mood: 'Calm and confident.' },
    messages: chat('Hi Jonas, how was your Thursday?', 'Markus asked something at 5. I said tomorrow morning. No drama.', 'That sounds like a new habit. Well done.'),
  },
  {
    key: 'w5-fri', week: 5, weekday: 5, title: 'Easy Friday',
    summary: 'A quiet Friday. You left on time.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work'], helped: [],
    reasons: { stress: 'A quiet Friday.', sleep: 'About seven hours.', mood: 'Happy, weekend ahead.' },
    messages: chat('Happy Friday! How was it?', 'Quiet. Left at 5. Weekend!', 'Enjoy it, Jonas.'),
  },
  {
    key: 'w5-sat', week: 5, weekday: 6, title: 'Walk with my sister',
    summary: 'Another walk around the lake with your sister.',
    mood: 'great', stress: 2, sleep: 8, emotion: 8, themes: ['health', 'family'], helped: ['A walk by the lake'],
    reasons: { stress: 'A free Saturday.', sleep: 'About eight hours.', mood: 'Relaxed and happy.' },
    messages: chat('Hi Jonas, how is your Saturday?', 'Walked around the lake with my sister again.', 'Lovely. Enjoy the weekend!'),
  },
];

// ─── Weekly Insights from the end of week 4 ──────────────────────────────
// Numbers match the check-ins above: late-task days stress 8 vs. 4 otherwise;
// the night after about 5 hours; after a walk or football about 8 hours.
export const analysis = {
  week: 4,
  insight: 'Your stress has one main source: late tasks from Markus. Walks and football are what help you sleep.',
  question: 'Which late request could you answer with "first thing tomorrow" this week?',
  worked: [
    { text: 'Saying "I can do it first thing tomorrow"', source: 'checkin' },
    { text: 'Walks and football', source: 'checkin' },
    { text: 'The 4 pm rule with Markus', source: 'checkin' },
  ],
  patterns: [
    {
      title: 'Late tasks drive your stress',
      description: 'On days you said yes to a late task from Markus, your stress was 8. On other days it was 4.',
      icon: 'work',
      findings: [
        { text: 'All five days with your highest stress started with a task from Markus after 5 pm.', evidence: ['w1-mon', 'w1-wed', 'w2-mon', 'w2-wed', 'w3-mon'] },
        { text: 'When you said "first thing tomorrow", your stress stayed at 4.', evidence: ['w3-wed'] },
      ],
      questions: ['What makes it hard to say no in the moment?'],
    },
    {
      title: 'Then you lie awake',
      description: 'The night after a late evening, you slept only about 5 hours.',
      icon: 'sleep',
      findings: [
        { text: 'After each late evening you lay awake thinking about work and slept about 5 hours.', evidence: ['w1-tue', 'w1-thu', 'w2-tue', 'w3-tue'] },
      ],
      questions: ['What helps you put work down before bed?'],
    },
    {
      title: 'Walks and sport help you sleep',
      description: 'After a walk or football, you slept about 8 hours.',
      icon: 'health',
      findings: [
        { text: 'After a walk or football you slept 7–8 hours, even in stressful weeks.', evidence: ['w1-sun', 'w2-fri', 'w3-mon', 'w3-thu', 'w4-wed'] },
      ],
      questions: ['On which evenings this week could you fit in a walk?'],
    },
  ],
};

// ─── Untangle ─────────────────────────────────────────────────────────────

/** Calm now, right after the meeting (week 2, Wednesday). */
export const calmSession = {
  week: 2, weekday: 3, before: 8, after: 4,
  title: 'My boss presented my work as his',
  messages: chat(
    '',
    'In the client meeting my boss presented my pitch deck as his own work. Didn\'t mention me once. I\'m shaking.',
    "That's really unfair, and it makes sense that you're shaking. Let's calm your body first. Breathe in for four counts, then out for six. Do that three times.",
    'Done. A bit better.',
    "Good. Now drop your shoulders and put both feet on the floor. You don't have to solve anything right now. What would you like to say to him?",
    'That I did the work and I want to be named.',
    "That's fair and clear. Write that one sentence down, but don't send it today. You can decide tomorrow, with a calmer head.",
    'Wrote it down. Actually feel calmer now.',
    'Well done. If you feel calmer, tap "I feel calmer". A short walk after work could help too.',
  ).slice(1),
};

const steps = (...items: [string, number, boolean][]) => items.map(([text, minutes, done]) => ({ text, minutes, done }));

/** Stress solving, solved: falling asleep (made week 2 Tuesday, solved week 4 Thursday). */
export const sleepPlan = {
  week: 2, weekday: 2, solvedWeek: 4, solvedWeekday: 4, before: 7, after: 3,
  title: 'Falling asleep after stressful days',
  problem: 'After a late evening at work you lie awake thinking about it and sleep only about 5 hours.',
  plan: {
    approach: 'Your head keeps working when your body stops. Moving outside after work helps you switch off: after your walk by the lake you slept 8 hours. The plan adds a clear end to the day and a place for thoughts at night.',
    watch_for: 'You sleep at least 7 hours on most nights.',
    note: 'Some nights will still be short. One bad night is not a failed plan.',
    lessons: [
      { text: 'After the walk by the lake you slept 8 hours.', kind: 'helped', evidence: ['w1-sat', 'w1-sun'] },
      { text: 'After working late you lay awake and slept about 5 hours.', kind: 'worse', evidence: ['w1-tue', 'w1-thu'] },
    ],
    steps: steps(
      ['Take a 20-minute walk after work, at least three times a week.', 20, true],
      ['Leave your phone outside the bedroom and use an alarm clock.', 2, true],
      ['If a thought keeps you awake, write it on the note next to your bed.', 2, true],
    ),
  },
  messages: chat(
    '',
    'Every time I work late, I lie awake until 1 and sleep about 5 hours.',
    'What keeps your mind busy when you lie awake?',
    'The task, what my boss will say, what I still have to do.',
    'And what do you usually do in the hour before bed?',
    'Scroll on my phone, mostly emails.',
    'Last Saturday, after your walk, you slept 8 hours. Have you noticed that before?',
    'Yes, when I move I sleep better.',
    'That gives us a good picture. Tap "Make my plan".',
  ).slice(1),
  story: {
    title: 'How I learned to sleep again after stressful days',
    body: "For weeks, every late evening at work ended the same way: lying awake until 1, going over the day, and sleeping five hours. My check-ins showed something I hadn't noticed: after days with a walk or football, I slept almost eight hours. So I made a simple plan. A 20-minute walk after work three times a week, my phone outside the bedroom, and a note next to my bed for thoughts that won't let go. After two weeks I slept seven to eight hours on most nights. Fewer late evenings helped too, but the walks made the biggest difference. If you lie awake after work: try moving before you try harder to sleep.",
    comments: [
      { author: 'lisa_h', body: 'The note next to the bed is such a simple idea. Trying it tonight.' },
      { author: 'marco.b', body: 'Same for me with running. Moving first, then sleeping. Great story!' },
    ],
  },
};

/** Stress solving, active: saying no to the boss (made week 3 Monday). */
export const bossPlan = {
  week: 3, weekday: 1, before: 8, after: 3,
  title: 'Saying no to my boss',
  problem: 'Your team lead Markus often hands you tasks after 5 pm. You say yes, work late and then lie awake.',
  plan: {
    approach: "You say yes because it feels faster than a discussion. But each late yes costs you an evening and a night of sleep. The plan: a ready sentence for the moment he asks, and one clear rule agreed with Markus.",
    watch_for: 'You leave work by 6:30 pm on at least four days a week.',
    note: "You can't control what Markus asks. You can control how you answer.",
    lessons: [
      { text: 'On days you said yes late, your stress was 8.', kind: 'worse', evidence: ['w1-mon', 'w2-mon'] },
      { text: 'The night after, you slept about 5 hours.', kind: 'worse', evidence: ['w1-tue', 'w2-tue'] },
    ],
    steps: steps(
      ['When Markus asks after 5 pm, say: "I can do it first thing tomorrow."', 1, true],
      ['Ask Markus for 10 minutes and agree: tasks after 4 pm wait until the next morning, unless urgent.', 10, true],
      ['If something is really urgent, ask: "What should I drop for this?"', 1, false],
    ),
  },
  messages: chat(
    '',
    'My boss keeps giving me tasks after 5 pm and I always say yes. Then I work late and sleep badly.',
    'What goes through your head when he asks?',
    "That saying no looks lazy. And that it's faster to just do it.",
    'Are these tasks usually urgent, or could they wait until the next morning?',
    'Honestly, most could wait.',
    'Has he ever reacted badly when you pushed back?',
    'No. I never really tried.',
    'That gives us a clear picture. Tap "Make my plan".',
    'Update: I said "first thing tomorrow" today and he just said fine!',
    "That's a great first step. Next in your plan: the short talk with Markus about the 4 pm rule.",
    'Update: we had the talk. He agreed to the 4 pm rule.',
    'Well done, Jonas. Both main steps are done. Keep an eye on whether the rule holds in the next weeks.',
  ).slice(1),
};

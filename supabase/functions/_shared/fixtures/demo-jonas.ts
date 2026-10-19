/**
 * The demo persona an interviewer can load: Jonas, 27, junior consultant.
 *
 * Two threads, easy to grasp in a minute:
 *   1. Sunday dread (the main pattern): every Sunday evening his stress goes
 *      up and his mood down, although nothing happens at work. Weekly
 *      Insights reveal it → plan v1 "work-free weekends" fails → plan v2
 *      "Friday shutdown" (write Monday's first three tasks on Friday) → his
 *      first calm Sunday.
 *   2. The big presentation (an acute peak): Calm now the evening before
 *      (8 → 4) → a plan → it goes well → solved and shared in the community.
 * Plus one bright spot: football on Tuesdays = his best days.
 *
 * Dates are relative: `week` 1–4 are the four weeks ending on the most recent
 * Sunday before today, `weekday` 1 = Monday … 7 = Sunday. Week 5 entries fill
 * the days between that Sunday and today (only those already past). Today
 * stays empty for the live check-in.
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
  "Jonas, 27, junior consultant at a consulting firm, currently on a client project with a steering committee. Lives with a flatmate. Plays football with friends on Tuesday evenings, which reliably lifts his mood and sleep. Sundays are hard for him: Monday's tasks start running through his head in the afternoon. Before big presentations he gets nervous and sleeps badly; rehearsing out loud and preparing answers helps. Prefers short, practical tips.";

export const checkins: DemoCheckin[] = [
  // ─── Week 1: a calm start ───────────────────────────────────────────────
  {
    key: 'w1-mon', week: 1, weekday: 1, title: 'Kick-off with the new client',
    summary: 'Your new client project started with a kick-off. You felt motivated and a bit curious about the team.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A new project, busy but exciting.', sleep: 'You slept about seven hours.', mood: 'You sounded motivated.' },
    messages: chat(
      "Hi Jonas, how was your Monday?",
      "Good actually. Kick-off with the new client today, nice people, interesting project. Logistics company.",
      "That sounds like a good start. How did you sleep last night?",
      "Fine, around 7 hours.",
      "Glad the week starts on a good note. Anything you're looking forward to this week?",
      "Football tomorrow 😄",
    ),
  },
  {
    key: 'w1-tue', week: 1, weekday: 2, title: 'Football night',
    summary: 'You played football with friends after work and came home tired in a good way.',
    mood: 'great', stress: 3, sleep: 8, emotion: 8, themes: ['health', 'social'], helped: ['Playing football with friends'],
    reasons: { stress: 'A normal workday, and football cleared your head.', sleep: 'You slept eight hours and felt rested.', mood: 'You said you felt great after the game.' },
    messages: chat(
      "Evening Jonas! How was today?",
      "Really good. Normal work day and then football with the guys. We lost 4:3 but whatever, it was fun.",
      "Sounds like exactly the kind of evening that resets you. How do you feel now?",
      "Tired in a good way. Head is completely empty.",
      "That's a great feeling. Enjoy it and sleep well tonight.",
    ),
  },
  {
    key: 'w1-thu', week: 1, weekday: 4, title: 'Long workshop day',
    summary: 'A full day of client workshops. Busy, but it went well, and you ended it with a drink with a colleague.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work', 'social'], helped: ['A drink with a colleague after work'],
    reasons: { stress: 'A full workshop day that went well.', sleep: 'You slept about seven hours.', mood: 'You enjoyed the drink with your colleague.' },
    messages: chat(
      "Hi Jonas, how did your day go?",
      "Long. Workshops from 9 to 5 with the client. But it went well and afterwards I had a beer with Mia from my team.",
      "A full day with a nice ending. What did you enjoy most?",
      "Honestly just talking about non-work stuff for an hour.",
      "Those hours matter more than they seem. Have a good evening!",
    ),
  },
  {
    key: 'w1-fri', week: 1, weekday: 5, title: 'Weekend starts',
    summary: 'A quieter Friday. You finished on time and are looking forward to the weekend.',
    mood: 'good', stress: 3, sleep: 7, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A quiet Friday, you finished on time.', sleep: 'Around seven hours.', mood: 'You were looking forward to the weekend.' },
    messages: chat(
      "Happy Friday, Jonas. How was the week overall?",
      "Pretty good! Finished at 6 today. Weekend plans: cooking with my flatmate, maybe a movie.",
      "That sounds like a relaxed weekend. Enjoy it!",
    ),
  },
  {
    key: 'w1-sun', week: 1, weekday: 7, title: 'Sunday evening restlessness',
    summary: "On Sunday evening you felt restless and kept thinking about Monday's client workshop, although the weekend itself was nice.",
    mood: 'low', stress: 6, sleep: 6, emotion: 4, themes: ['work'], helped: [],
    reasons: { stress: "You kept thinking about Monday's workshop.", sleep: 'You slept about six hours.', mood: 'You said the evening felt heavy.' },
    messages: chat(
      "Hi Jonas, how was your Sunday?",
      "Weird. The weekend was nice but since around 5 I feel restless. Keep going through Monday's workshop in my head.",
      "That restless Sunday feeling is very common. What exactly is running through your head?",
      "Just the agenda, what could go wrong, which slides aren't done. Nothing I can do now anyway.",
      "Exactly, and that's what makes it tiring. Maybe write the three things down for tomorrow morning and then close the topic for tonight.",
      "Ok, will try. Good night.",
    ),
  },

  // ─── Week 2: the deadline moves forward ─────────────────────────────────
  {
    key: 'w2-mon', week: 2, weekday: 1, title: 'Tired Monday',
    summary: 'You slept badly after a restless Sunday and started the week tired. The client moved a deadline forward.',
    mood: 'stressed', stress: 7, sleep: 4, emotion: 5, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'The client moved the deadline forward.', sleep: 'You lay awake and slept only about five hours.', mood: 'Tired, but okay.' },
    messages: chat(
      "Hi Jonas, how was your Monday?",
      "Slept terribly, lay awake until 1. And then the client moved the deadline one week forward.",
      "That's a tough combination. How are you feeling about the new deadline?",
      "Manageable but tight. More late evenings I guess.",
      "Let's keep an eye on those evenings together. Try to get to bed earlier tonight.",
    ),
  },
  {
    key: 'w2-tue', week: 2, weekday: 2, title: 'Football saves the day',
    summary: 'A busy day, but football in the evening helped you switch off completely.',
    mood: 'great', stress: 4, sleep: 8, emotion: 8, themes: ['health', 'social'], helped: ['Playing football with friends'],
    reasons: { stress: 'Busy, but football helped you switch off.', sleep: 'You slept deeply, about eight hours.', mood: 'You felt really good after the game.' },
    messages: chat(
      "Evening Jonas, how was today?",
      "Busy, but football tonight was great. Scored once!",
      "Congrats! How's your head after the game?",
      "Totally free. Funny how that works every time.",
      "It really does seem to work for you. Sleep well!",
    ),
  },
  {
    key: 'w2-wed', week: 2, weekday: 3, title: 'Slides until ten',
    summary: 'You worked on slides until 10 pm because of the earlier deadline and felt drained.',
    mood: 'low', stress: 6, sleep: 6, emotion: 5, themes: ['work'], helped: [],
    reasons: { stress: 'You worked until 10 pm on slides.', sleep: 'About six hours.', mood: 'You felt drained.' },
    messages: chat(
      "Hi Jonas, how are you doing?",
      "Drained. Slides until 10.",
      "That's a long day. Is there anything that would make tomorrow a bit lighter?",
      "Not really, the deadline is the deadline. But it's only until next week.",
      "Then let's get you some rest tonight. Phone away and lights out soon?",
      "Yeah.",
    ),
  },
  {
    key: 'w2-fri', week: 2, weekday: 5, title: 'Deadline met',
    summary: 'You delivered the client deliverable on time. Relieved, but the week took a lot of energy.',
    mood: 'ok', stress: 5, sleep: 6, emotion: 6, themes: ['work'], helped: ['Finishing the deliverable'],
    reasons: { stress: 'Relief after the delivery, but still tense.', sleep: 'Around six hours.', mood: 'Relieved but tired.' },
    messages: chat(
      "Hi Jonas, it's Friday. How did the deadline go?",
      "Delivered at 4. Client was happy. I'm just tired now.",
      "Well done. That was a demanding week. What does your weekend look like?",
      "Sleeping in. Maybe meeting friends on Saturday.",
      "Sounds like exactly what you need.",
    ),
  },
  {
    key: 'w2-sun', week: 2, weekday: 7, title: 'Sunday emails',
    summary: 'You checked work emails on Sunday afternoon, which made the evening tense. You felt low and restless again.',
    mood: 'stressed', stress: 7, sleep: 5, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'Checking emails brought work into your Sunday.', sleep: 'You slept around five hours.', mood: 'You said you felt low and restless.' },
    messages: chat(
      "Hi Jonas, how was your Sunday?",
      "Started fine, then I checked my emails at 4 'just quickly'. Big mistake. Now I'm thinking about the steering committee all evening.",
      "That 'just quickly' look often pulls the whole evening into work mode. How do you feel now?",
      "Low. Restless. Same as last Sunday honestly.",
      "It's the second Sunday in a row that feels like this. Let's keep an eye on it. For tonight: is there something calming you could do for 20 minutes?",
      "Maybe a shower and a series. Ok.",
    ),
  },

  // ─── Week 3: the peak and the big presentation ──────────────────────────
  {
    key: 'w3-mon', week: 3, weekday: 1, title: 'Seeing the Sunday pattern',
    summary: 'Your Weekly Insights showed that Sundays are your hardest day. You made a plan to keep weekends work-free.',
    mood: 'ok', stress: 7, sleep: 4, emotion: 5, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'A busy Monday after a restless Sunday.', sleep: 'You slept about four hours.', mood: 'Tired, but hopeful about the plan.' },
    messages: chat(
      "Hi Jonas, how was your day?",
      "Tired again after Sunday. But the weekly insights showed that every Sunday my stress goes up. I never noticed that it's every week.",
      "Seeing it written down can change a lot. What do you think causes it?",
      "Work creeping into the weekend I guess. I made a plan: no emails, no laptop on weekends.",
      "That's a clear first step. Let's see how next Sunday feels.",
    ),
  },
  {
    key: 'w3-tue', week: 3, weekday: 2, title: 'Steering committee on Thursday',
    summary: 'You found out you will present to the steering committee on Thursday. You skipped football to work on slides.',
    mood: 'stressed', stress: 7, sleep: 6, emotion: 5, themes: ['work'], helped: [],
    reasons: { stress: 'You will present to the steering committee on Thursday.', sleep: 'About six hours.', mood: 'Nervous, and you missed football.' },
    messages: chat(
      "Hi Jonas, how was your Tuesday?",
      "My manager just told me I'm presenting to the steering committee on Thursday. First time. Skipped football to work on the slides.",
      "That's a big step, and it makes sense you're nervous. What worries you most?",
      "Questions I can't answer. The CFO is known for tough questions.",
      "That's a very concrete worry, so we can prepare for it. If you like, we can make a plan for Thursday in Stress solving.",
      "Good idea, I'll do that.",
    ),
  },
  {
    key: 'w3-wed', week: 3, weekday: 3, title: 'The night before',
    summary: 'The evening before the presentation you were very nervous. A Calm now session helped you slow down and go to bed.',
    mood: 'stressed', stress: 8, sleep: 5, emotion: 4, themes: ['work'], helped: ['Calm now: breathing out slowly', 'Rehearsing with a colleague'],
    reasons: { stress: 'The night before your first steering committee.', sleep: 'You slept about five hours.', mood: 'Nervous, but calmer after Calm now.' },
    messages: chat(
      "Hi Jonas, how are you feeling tonight?",
      "Nervous. Presentation is tomorrow at 10. Rehearsed twice with Mia today, that went well. But my heart was racing an hour ago.",
      "Rehearsing twice is great preparation. How is it now?",
      "Better. I did a Calm now session, the breathing helped. Went from like 8 to 4.",
      "That's a real shift. You've prepared well. What do you need for a good night?",
      "Laptop off, early bed.",
      "Sounds right. Good luck tomorrow, you're ready.",
    ),
  },
  {
    key: 'w3-thu', week: 3, weekday: 4, title: 'Presentation went well',
    summary: 'Your steering committee presentation went well. You could answer the CFO\'s questions because you had prepared them.',
    mood: 'great', stress: 5, sleep: 5, emotion: 8, themes: ['work'], helped: ['Preparing answers to likely questions', 'Rehearsing out loud'],
    reasons: { stress: 'Big day, but it went well.', sleep: 'Short night, about five hours.', mood: 'You were relieved and proud.' },
    messages: chat(
      "Hi Jonas! How did the presentation go?",
      "It went really well!! The CFO asked two of the three questions I had prepared. My manager said it was the best steering committee in months.",
      "That's fantastic, congratulations! How do you feel?",
      "Relieved. Proud. Exhausted haha.",
      "You earned all three. What made the biggest difference?",
      "Preparing the answers. Without that I would have panicked.",
    ),
  },
  {
    key: 'w3-fri', week: 3, weekday: 5, title: 'Relief',
    summary: 'A light Friday after the presentation. You marked your presentation plan as solved.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A light Friday after a big week.', sleep: 'About seven hours.', mood: 'Relieved and content.' },
    messages: chat(
      "Hi Jonas, how was your Friday?",
      "Chill. Marked the presentation plan as solved. Might even share it in the community.",
      "That's a great idea, it could really help someone in the same spot. Enjoy your weekend!",
    ),
  },
  {
    key: 'w3-sun', week: 3, weekday: 7, title: 'Sunday dread again',
    summary: "You kept the weekend work-free, but on Sunday evening Monday's tasks still ran through your head.",
    mood: 'low', stress: 7, sleep: 6, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: "Monday's tasks kept running through your head.", sleep: 'About six hours.', mood: 'You felt low and frustrated.' },
    messages: chat(
      "Hi Jonas, how was your Sunday?",
      "Frustrating. I didn't open the laptop all weekend, no emails. But since 5 I'm thinking about Monday again. So the plan didn't work.",
      "Thank you for being honest, that's useful to know. So it's not the laptop itself. What keeps your mind busy?",
      "All the open things. I don't know where to start on Monday and my brain keeps trying to sort it.",
      "That sounds like open loops: unfinished things your mind keeps holding. That's something we can work with. Want to update your plan tomorrow?",
      "Yes. Good night.",
    ),
  },

  // ─── Week 4: plan v2, the Friday shutdown ───────────────────────────────
  {
    key: 'w4-mon', week: 4, weekday: 1, title: 'A new plan for Sundays',
    summary: 'You updated your Sunday plan: a 15-minute Friday shutdown where you write down Monday\'s first three tasks.',
    mood: 'ok', stress: 6, sleep: 5, emotion: 5, themes: ['work'], helped: [],
    reasons: { stress: 'A busy Monday after another restless Sunday.', sleep: 'About five hours.', mood: 'Tired, but motivated by the new plan.' },
    messages: chat(
      "Hi Jonas, how was your Monday?",
      "Tired, but I updated the Sunday plan. New idea: on Friday I write down Monday's first three tasks so my brain doesn't have to hold them.",
      "That's a smart change: closing the loops before the weekend instead of fighting the thoughts. When will you do it?",
      "Friday at 5, before I close the laptop.",
      "Great. I'm curious how next Sunday feels.",
    ),
  },
  {
    key: 'w4-tue', week: 4, weekday: 2, title: 'Back on the pitch',
    summary: 'Back to football after skipping last week. You felt great afterwards.',
    mood: 'great', stress: 3, sleep: 8, emotion: 8, themes: ['health', 'social'], helped: ['Playing football with friends'],
    reasons: { stress: 'An easy day, and football helped you switch off.', sleep: 'You slept eight hours.', mood: 'You felt great after the game.' },
    messages: chat(
      "Evening Jonas, how was today?",
      "Football again finally! Missed it last week.",
      "Your Tuesdays really are your best days. How do you feel?",
      "Great. Gonna sleep like a baby.",
    ),
  },
  {
    key: 'w4-thu', week: 4, weekday: 4, title: 'Normal Thursday',
    summary: 'A normal workday with a long client call. Nothing special, and that felt good.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A normal day with one long call.', sleep: 'About seven hours.', mood: 'Calm and okay.' },
    messages: chat(
      "Hi Jonas, how was your Thursday?",
      "Normal. Long client call, some analysis. Honestly normal feels good after the last weeks.",
      "It does. Enjoy the calm evening!",
    ),
  },
  {
    key: 'w4-fri', week: 4, weekday: 5, title: 'First Friday shutdown',
    summary: "You did your first Friday shutdown: wrote Monday's three tasks on a note and closed the laptop at 5:30. You felt light.",
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work'], helped: ['Friday shutdown: writing down Monday\'s first three tasks'],
    reasons: { stress: 'You closed the week with your Friday shutdown.', sleep: 'About seven hours.', mood: 'You said you felt light.' },
    messages: chat(
      "Happy Friday, Jonas! Did you try the Friday shutdown?",
      "Yes! Wrote the three tasks for Monday on a sticky note, closed all tabs, laptop in the bag at 5:30. Feels weirdly good.",
      "That's a great first try. What does it feel like right now?",
      "Light. Like the week is actually finished.",
      "That's exactly the point. Enjoy your weekend, Jonas.",
    ),
  },
  {
    key: 'w4-sun', week: 4, weekday: 7, title: 'A calm Sunday',
    summary: 'Your first calm Sunday in a month. You went for a walk and Monday stayed on the sticky note.',
    mood: 'good', stress: 3, sleep: 7, emotion: 7, themes: ['work', 'health'], helped: ['Friday shutdown', 'A walk on Sunday afternoon'],
    reasons: { stress: 'Monday stayed on your sticky note.', sleep: 'About seven hours.', mood: 'You said it felt like a real Sunday.' },
    messages: chat(
      "Hi Jonas, how was your Sunday?",
      "Honestly? The first Sunday in a month that felt like a Sunday. Went for a long walk in the afternoon and when Monday came into my head I thought: it's on the note.",
      "That's a big change, and you made it happen. What do you think made the difference?",
      "Knowing exactly where I'll start on Monday. My brain doesn't need to hold it anymore.",
      "That's the open loop closing. Let's see if it holds next week too.",
    ),
  },

  // ─── Week 5: the days since (only those already past are loaded) ─────────
  {
    key: 'w5-mon', week: 5, weekday: 1, title: 'Easy start',
    summary: 'Monday felt easy because you knew exactly which three tasks to start with.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: ['Starting with the three tasks from Friday'],
    reasons: { stress: 'You knew where to start.', sleep: 'About seven hours.', mood: 'Good and focused.' },
    messages: chat(
      "Hi Jonas, how was your Monday?",
      "Easy start! Took the note out, did task one before 10.",
      "That's a great Monday. The shutdown seems to work on both ends.",
    ),
  },
  {
    key: 'w5-tue', week: 5, weekday: 2, title: 'Football again',
    summary: 'Football in the evening, a great day.',
    mood: 'great', stress: 3, sleep: 8, emotion: 8, themes: ['health', 'social'], helped: ['Playing football with friends'],
    reasons: { stress: 'An easy day plus football.', sleep: 'About eight hours.', mood: 'You felt great.' },
    messages: chat("Evening Jonas, how was today?", "Football! Great day.", "Your favourite day of the week. Enjoy the evening!"),
  },
  {
    key: 'w5-wed', week: 5, weekday: 3, title: 'Busy but fine',
    summary: 'A busy day with workshops, but you finished at a normal time.',
    mood: 'good', stress: 5, sleep: 7, emotion: 6, themes: ['work'], helped: [],
    reasons: { stress: 'A busy workshop day.', sleep: 'About seven hours.', mood: 'Okay, a bit tired.' },
    messages: chat("Hi Jonas, how are you?", "Busy with workshops but finished at 7. Fine.", "Good to hear you still have an evening. Rest well."),
  },
  {
    key: 'w5-thu', week: 5, weekday: 4, title: 'Tough client call',
    summary: 'A difficult client call in the afternoon, but you let it go in the evening.',
    mood: 'ok', stress: 6, sleep: 6, emotion: 6, themes: ['work'], helped: ['Cooking with your flatmate'],
    reasons: { stress: 'A difficult client call.', sleep: 'About six hours.', mood: 'Okay after cooking with your flatmate.' },
    messages: chat(
      "Hi Jonas, how was your Thursday?",
      "Annoying client call, they want changes again. But cooked with my flatmate after and it's fine now.",
      "Good that you could put it down for the evening. Anything to note for tomorrow?",
      "Will put it on Friday's note.",
    ),
  },
  {
    key: 'w5-fri', week: 5, weekday: 5, title: 'Second Friday shutdown',
    summary: 'Your second Friday shutdown, including the client changes on the note.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work'], helped: ['Friday shutdown'],
    reasons: { stress: 'You closed the week with your shutdown.', sleep: 'About seven hours.', mood: 'You felt light again.' },
    messages: chat("Happy Friday! Shutdown done?", "Done. Three tasks on the note, client changes included. Weekend!", "Perfect. Enjoy it, Jonas."),
  },
  {
    key: 'w5-sat', week: 5, weekday: 6, title: 'Lazy Saturday',
    summary: 'A relaxed Saturday with friends.',
    mood: 'great', stress: 2, sleep: 8, emotion: 8, themes: ['social'], helped: ['Time with friends'],
    reasons: { stress: 'A free Saturday.', sleep: 'You slept in, about eight hours.', mood: 'Relaxed and happy.' },
    messages: chat("Hi Jonas, how's your Saturday?", "Slept in, brunch with friends, park. Perfect.", "Sounds like a perfect Saturday."),
  },
];

// ─── Weekly Insights from the end of week 2 (the one that revealed Sundays) ──
export const analysis = {
  week: 2,
  insight: 'Your Sundays are your hardest day: your stress rises every Sunday evening, before the work week has even started.',
  question: 'What exactly keeps your mind busy on Sunday evenings?',
  worked: [
    { text: 'Football on Tuesday evenings', source: 'checkin' },
    { text: 'A drink with a colleague after a long day', source: 'checkin' },
  ],
  patterns: [
    {
      title: 'Sundays weigh on you',
      description: 'Both Sundays ended with high stress and a low mood, although nothing happened at work.',
      icon: 'work',
      findings: [
        { text: 'On both Sundays your stress went up to 6–7 and your mood dropped to 3–4, while the weekend itself was fine.', evidence: ['w1-sun', 'w2-sun'] },
        { text: 'After a restless Sunday you slept badly and started Monday tired.', evidence: ['w1-sun', 'w2-mon'] },
      ],
      questions: ['What exactly keeps your mind busy on Sunday evenings?', 'What would help you close the work week on Friday?'],
    },
    {
      title: 'Football resets you',
      description: 'Your Tuesdays with football were your best days of the week.',
      icon: 'health',
      findings: [
        { text: 'On both football Tuesdays your stress was 3–4 and you slept about 8 hours.', evidence: ['w1-tue', 'w2-tue'] },
      ],
      questions: ['What else gives you that "empty head" feeling?', 'How could you protect your Tuesday evenings in busy weeks?'],
    },
  ],
};

// ─── Untangle ─────────────────────────────────────────────────────────────

/** Calm now, the evening before the presentation (week 3, Wednesday). */
export const calmSession = {
  week: 3, weekday: 3, before: 8, after: 4,
  title: 'Presentation tomorrow, heart racing',
  messages: chat(
    '',
    'Presentation to the steering committee tomorrow at 10 and my heart is racing. I keep imagining the CFO asking something I can\'t answer.',
    "That sounds really intense, and it makes sense: it's your first steering committee. Let's slow your body down first. Breathe in for four counts, then out for six. Do that three times and tell me when you're done.",
    'Done. A bit better.',
    "Good. Now put both feet flat on the floor and drop your shoulders. You rehearsed twice today, so the content is there. What is the one question you fear most?",
    'What the savings are if we only do half of the rollout.',
    "That's a concrete question, so write a two-sentence answer on a note now. That's all for tonight; the rest can wait until tomorrow.",
    'Ok, wrote it down. Actually feel calmer now.',
    'That shows: you are prepared. If you feel calmer, tap "I feel calmer". Then laptop off and to bed.',
  ).slice(1),
};

const steps = (...items: [string, number, boolean][]) => items.map(([text, minutes, done]) => ({ text, minutes, done }));

/** Stress solving, solved: the presentation (made week 3 Tuesday). */
export const presentationPlan = {
  week: 3, weekday: 2, solvedWeekday: 5, before: 8, after: 3,
  title: 'First steering committee',
  problem: 'You present to the steering committee for the first time on Thursday and fear questions you cannot answer.',
  plan: {
    approach: 'Your nervousness is about being caught off guard, not about the slides. Preparing answers to the questions you fear turns the unknown into something you have practised. Rehearsing out loud worked for you before, so the plan builds on that.',
    watch_for: 'You can answer the three likely questions in two sentences each without notes.',
    note: "How the committee reacts is not fully in your control. Your preparation is.",
    lessons: [
      { text: 'Talking things through with a colleague helped you on a long day.', kind: 'helped', evidence: ['w1-thu'] },
      { text: 'Working on slides until late left you drained and sleeping badly.', kind: 'worse', evidence: ['w2-wed'] },
    ],
    steps: steps(
      ['Rehearse the presentation out loud twice with a colleague by Wednesday noon.', 60, true],
      ['Write two-sentence answers to the three questions the CFO is most likely to ask.', 30, true],
      ['On Wednesday, stop working at 8 pm and lay out everything you need for Thursday.', 15, true],
    ),
  },
  messages: chat(
    '',
    'I present to the steering committee on Thursday for the first time. I\'m afraid of questions I can\'t answer, the CFO is known for tough ones.',
    'That is a big step. What would the CFO most likely ask about?',
    'Costs and savings. And why we recommend this vendor.',
    'Those are predictable, which is good news. How much time do you have until Thursday, and who could you rehearse with?',
    'Two days. My colleague Mia would help.',
    'Rehearsing with Mia and preparing those answers sounds like a solid basis. I know enough now; tap "Make my plan".',
  ).slice(1),
  story: {
    title: 'My first steering committee',
    body: "Two days before my first steering committee presentation I was close to panicking. Not because of the slides, but because the CFO is known for tough questions, and I kept imagining standing there without an answer. The evening before, my heart was racing so much that I did a short Calm now session. Breathing out slowly, longer than in, actually brought me from an 8 to a 4. What really made the difference, though, was the plan I had made two days before. I wrote down the three questions I feared most and prepared a two-sentence answer for each. Then I rehearsed the whole thing twice, out loud, with a colleague. On the day, the CFO asked two of my three questions, and I could answer both calmly. My manager said it was the best steering committee in months. If you have a big presentation coming up: don't just polish the slides, prepare for the questions you are afraid of.",
    comments: [
      { author: 'lisa_h', body: 'Preparing for the questions you fear is such a good point. I always only work on the slides.' },
      { author: 'marco.b', body: 'Congrats on the presentation! The two-sentence answers trick is going straight into my notes.' },
    ],
  },
};

/** Stress solving, active: Sunday evenings. v1 (week 3 Monday) → v2 (week 4 Monday). */
export const sundayPlan = {
  week: 3, weekday: 1, updatedWeek: 4, updatedWeekday: 1, before: 7, after: 3,
  title: 'Sunday evenings',
  problem: "Every Sunday evening Monday's tasks run through your head, and your stress goes up before the week has started.",
  v1: {
    approach: 'Keep the weekend free of work, so that work cannot reach you on Sundays.',
    watch_for: 'Your Sunday evening stress stays below 5.',
    note: 'You cannot finish every task before the weekend, and that is okay.',
    lessons: [{ text: 'Checking emails on Sunday afternoon made the whole evening tense.', kind: 'worse', evidence: ['w2-sun'] }],
    steps: steps(
      ['Turn off work email notifications from Friday 7 pm until Monday 8 am.', 5, true],
      ['Keep the laptop closed on Saturday and Sunday.', 1, true],
      ['Plan one thing you enjoy for every Sunday afternoon.', 10, false],
    ),
  },
  v2: {
    approach: "Your Sunday stress is not caused by weekend work but by open loops: Monday's tasks keep running in your head because they are not written down anywhere. Writing them down on Friday closes those loops, so your mind can let go. The walk adds what already works for you on Tuesdays: moving outside.",
    watch_for: 'Your Sunday evening mood stays at 6 or higher.',
    note: 'Thoughts about work may still come. When they do, remind yourself that they are on the note.',
    lessons: [
      { text: 'Even without opening the laptop, Monday ran through your head on Sunday.', kind: 'worse', evidence: ['w3-sun'] },
      { text: 'Football on Tuesdays reliably clears your head.', kind: 'helped', evidence: ['w1-tue', 'w2-tue'] },
    ],
    steps: steps(
      ["Every Friday at 5 pm, write Monday's first three tasks on one note.", 15, true],
      ['After the note, close all tabs and leave the laptop in your bag until Monday.', 2, true],
      ['Take a 30-minute walk on Sunday afternoon, without your phone.', 30, true],
    ),
  },
  messages: chat(
    '',
    'My weekly insights showed that every Sunday evening my stress goes up. I start thinking about Monday around 5 and can\'t stop.',
    'Thank you for bringing this. What happens on those Sunday afternoons, do you work or check emails?',
    'Sometimes I check emails. Last Sunday that made it much worse.',
    'And on Sundays without emails, does it still come?',
    'Less, but yes.',
    'So emails make it worse, and there is something more underneath. What helps you switch off on other days?',
    'Football on Tuesdays. Being outside.',
    'That gives us a good picture. Tap "Make my plan".',
    'Update: I kept the weekend completely work-free but the Sunday was still bad. It\'s all the open stuff for Monday in my head.',
    'Thank you for telling me, that is really useful. So it is less about the laptop and more about unfinished things your mind keeps holding. What if you wrote Monday\'s first tasks down before the weekend?',
    'That could work. Friday afternoon maybe.',
    'That sounds like a good change. Tap "Update my plan".',
  ).slice(1),
};

/**
 * The demo persona an interviewer can load: Jonas, 28, project manager.
 *
 * One story, easy to grasp at a glance:
 *   Problem: his boss Markus gives him tasks after 5 pm. Jonas says yes,
 *            works late and then sleeps about 5 hours.
 *   Helps:   walks and football (about 8 hours of sleep afterwards).
 *   Plans:   "Saying no to my boss" (active) and "Falling asleep after
 *            stressful days" (solved, shared in the community).
 *   Arc:     weeks 1–2 hard, week 3 the plan starts, week 4 the talk with
 *            Markus and the calmest week.
 * All texts use short, simple sentences on purpose.
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
  'Jonas, 28, project manager at a digital agency. His boss Markus often gives him tasks after 5 pm. Jonas used to say yes, work late and then lie awake. Walks and football help him sleep. He now says "I can do it tomorrow morning", and he agreed with Markus that tasks after 4 pm wait until the next morning. Likes short, practical tips.';

export const checkins: DemoCheckin[] = [
  // ─── Week 1: late tasks, short nights ───────────────────────────────────
  {
    key: 'w1-mon', week: 1, weekday: 1, title: 'A report at 5:40 pm',
    summary: 'Markus gave you a report at 5:40 pm. It was due the next morning. You worked until 10 pm.',
    mood: 'stressed', stress: 8, sleep: 7, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'A late task kept you at work until 10 pm.', sleep: 'You slept about 7 hours.', mood: 'You felt angry and tired.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "Annoying. At 5:40 Markus gave me a client report. Due tomorrow at 9. He said it would be quick. It wasn't. I just got home.",
      'What time is it now?',
      '10:15.',
      "That's a long day. How do you feel?",
      "Tired and angry. Mostly at myself. I said yes without thinking. Again.",
      'Saying yes to your boss in the moment is very normal. Let\'s look at that another day. What would help you wind down tonight?',
      'No more screens, I guess. Maybe a shower.',
      'Sounds good. Sleep well, Jonas.',
    ),
  },
  {
    key: 'w1-tue', week: 1, weekday: 2, title: 'Awake until 1 am',
    summary: 'You lay awake until 1 am. You slept about 5 hours. The day felt slow.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'You were tired and behind on your own work.', sleep: 'You lay awake until 1 am. About 5 hours of sleep.', mood: 'You felt tired and flat.' },
    messages: chat(
      'Hi Jonas, how did you sleep?',
      'Badly. I lay awake until 1. I kept thinking about the report. Maybe 5 hours of sleep.',
      'What went through your head?',
      'If the report is good enough. What Markus will say. What I still have to do.',
      'And how was the day with so little sleep?',
      "Slow. Three coffees. And I didn't get to my own tasks.",
      'So yesterday cost you more than one evening. Try to go to bed a bit earlier tonight.',
      'Will try.',
    ),
  },
  {
    key: 'w1-wed', week: 1, weekday: 3, title: '"Just a small change"',
    summary: 'At 6 pm Markus asked for "a small change" to the slides. It took until 9 pm. You missed the gym.',
    mood: 'stressed', stress: 8, sleep: 6, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'Another late task from Markus.', sleep: 'About 6 hours.', mood: 'You felt fed up.' },
    messages: chat(
      'Hi Jonas, how was today?',
      "Same story. 6 pm, Markus: 'just a small change to the slides'. I finished at 9. I wanted to go to the gym.",
      "That's the second late evening this week. How are you?",
      "Fed up. It's not the work. It's that it always comes at the end of the day.",
      'So the time is the problem, not the amount of work?',
      "Yes. During the day I'm fine.",
      "That's good to know. Let's keep an eye on it.",
    ),
  },
  {
    key: 'w1-thu', week: 1, weekday: 4, title: 'Very tired',
    summary: 'Another short night of about 5 hours. You were irritable all day.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['work', 'sleep'], helped: [],
    reasons: { stress: 'Tired and irritable at work.', sleep: 'About 5 hours. You lay awake again.', mood: 'You felt irritable.' },
    messages: chat(
      'Hi Jonas, how are you today?',
      "Very tired. 5 hours again. I couldn't switch off after the slides.",
      'How did the day go?',
      'I snapped at a colleague in the morning. I felt bad about it.',
      'Short nights make everyone more irritable. Did you talk to your colleague?',
      'Yes, I said sorry. All good.',
      'Good that you fixed it. I hope you sleep better tonight.',
    ),
  },
  {
    key: 'w1-sat', week: 1, weekday: 6, title: 'A walk by the lake',
    summary: 'You walked around the lake with your sister for two hours. Your head was quiet for the first time this week.',
    mood: 'great', stress: 3, sleep: 6, emotion: 7, themes: ['health', 'family'], helped: ['A long walk by the lake'],
    reasons: { stress: 'A free day outside.', sleep: 'About 6 hours.', mood: 'You felt free.' },
    messages: chat(
      'Hi Jonas, how is your Saturday?',
      'Really nice. I walked around the lake with my sister. Two hours.',
      'How did that feel?',
      'My head was quiet. First time this week.',
      'What made it quiet, do you think?',
      'Being outside. Moving. No phone.',
      'Worth remembering. Enjoy the rest of the weekend!',
    ),
  },
  {
    key: 'w1-sun', week: 1, weekday: 7, title: 'Slept 8 hours',
    summary: 'After the walk you slept 8 hours. The best night in a long time. A calm Sunday.',
    mood: 'good', stress: 3, sleep: 8, emotion: 7, themes: ['sleep'], helped: ['The walk yesterday'],
    reasons: { stress: 'A quiet Sunday at home.', sleep: 'You slept 8 hours after the walk.', mood: 'Rested and calm.' },
    messages: chat(
      'Hi Jonas, how was your Sunday?',
      'Calm. And I slept 8 hours last night. First time in ages.',
      'What do you think helped?',
      'The walk, I think. I was tired in a good way.',
      'That fits: two hours outside and moving. How do you feel about next week?',
      'Okay. I hope Markus has a quieter week.',
    ),
  },

  // ─── Week 2: same pattern, first walks, Calm now ────────────────────────
  {
    key: 'w2-mon', week: 2, weekday: 1, title: 'A pitch deck by tomorrow',
    summary: 'At 6 pm Markus asked for a pitch deck by the next day. You said yes again. You worked until 9:30 pm.',
    mood: 'stressed', stress: 8, sleep: 8, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'A late task from Markus. Work until 9:30 pm.', sleep: 'You slept 8 hours after a calm weekend.', mood: 'You were annoyed with yourself.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "It started well. Then at 6 pm Markus needed a pitch deck by tomorrow. I said 'sure, no problem'. Why do I always do that?",
      'What do you think in the moment he asks?',
      "That saying no looks lazy. And that it's faster to just do it.",
      'And is it faster?',
      'No. It cost me the whole evening. I finished at 9:30.',
      "That's an honest answer. The quick yes costs you a lot later. Let's remember that.",
    ),
  },
  {
    key: 'w2-tue', week: 2, weekday: 2, title: 'Five hours again',
    summary: 'You slept about 5 hours after the late evening. You made a sleep plan in Stress solving.',
    mood: 'low', stress: 6, sleep: 5, emotion: 4, themes: ['sleep'], helped: [],
    reasons: { stress: 'Tired, and the deck was due.', sleep: 'About 5 hours. You lay awake again.', mood: 'Tired, but glad to have a plan.' },
    messages: chat(
      'Hi Jonas, how did you sleep?',
      "5 hours. Again. Every time I work late, I can't fall asleep.",
      "That's a clear pattern. What do you want to do about it?",
      'I made a sleep plan in Stress solving today.',
      "Nice. What's in it?",
      'Walks after work. Phone out of the bedroom. And a note by the bed for thoughts that keep me awake.',
      "That's clear and easy to try. I'm curious how the next nights go.",
    ),
  },
  {
    key: 'w2-wed', week: 2, weekday: 3, title: 'Markus presented my work',
    summary: 'In a client meeting Markus showed your pitch deck as his own work. Calm now helped: your stress went from 8 to 4.',
    mood: 'stressed', stress: 8, sleep: 6, emotion: 3, themes: ['work'], helped: ['Calm now', 'Writing down what you want to say'],
    reasons: { stress: 'Markus presented your work as his own.', sleep: 'About 6 hours.', mood: 'Hurt and angry. Calmer after Calm now.' },
    messages: chat(
      'Hi Jonas, how was your day?',
      'The worst this month. In the client meeting Markus showed MY pitch deck as his work. He did not mention me once.',
      "That really hurts. Especially after you worked late for it. How did you feel?",
      'I was shaking afterwards.',
      'And how are you now?',
      'Better. I did Calm now right after. I wrote down what I want to say to him. My stress went from 8 to 4.',
      "That's a big change. You don't have to decide anything tonight. What would help this evening?",
      'Cooking something. Going to bed early.',
      'Sounds right. Take care, Jonas.',
    ),
  },
  {
    key: 'w2-thu', week: 2, weekday: 4, title: 'Football with friends',
    summary: 'You slept badly after yesterday. But football in the evening helped you switch off.',
    mood: 'good', stress: 4, sleep: 5, emotion: 7, themes: ['health', 'social'], helped: ['Football with friends'],
    reasons: { stress: 'A normal day. Football cleared your head.', sleep: 'About 5 hours after yesterday.', mood: 'You felt good after the game.' },
    messages: chat(
      'Hi Jonas, how was today?',
      'I slept badly after yesterday. But I played football with friends tonight. First time in weeks.',
      'How was it?',
      'Great. We won 5:3. I scored once.',
      'Congrats! How is your head now?',
      'Empty, in a good way.',
      'Enjoy that feeling. Sleep well!',
    ),
  },
  {
    key: 'w2-fri', week: 2, weekday: 5, title: 'A rested Friday',
    summary: 'After football you slept almost 8 hours. A quiet end to the week.',
    mood: 'good', stress: 3, sleep: 7, emotion: 7, themes: ['sleep'], helped: ['Football yesterday'],
    reasons: { stress: 'A quiet Friday.', sleep: 'Almost 8 hours after football.', mood: 'Rested and happy.' },
    messages: chat(
      'Happy Friday, Jonas. How did you sleep?',
      'Really well. Almost 8 hours.',
      'What was different?',
      'Football yesterday. And my phone was not in the bedroom.',
      'Two steps from your sleep plan. How was the day?',
      'Quiet. I left at 5.',
      'A good end to the week. Enjoy your weekend!',
    ),
  },
  {
    key: 'w2-sun', week: 2, weekday: 7, title: 'Sunday walk',
    summary: 'A long walk in the park. A calm and relaxed Sunday.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['health'], helped: ['A walk in the park'],
    reasons: { stress: 'A relaxed Sunday.', sleep: 'About 7 hours.', mood: 'Relaxed and happy.' },
    messages: chat(
      'Hi Jonas, how was your Sunday?',
      'Lovely. A long walk in the park. Then I cooked.',
      'How do you feel?',
      'Relaxed. Ready for the week.',
      'Walks really seem to work for you. Have a good evening!',
    ),
  },

  // ─── Week 3: one more late yes, then the plan to say no ─────────────────
  {
    key: 'w3-mon', week: 3, weekday: 1, title: 'Enough is enough',
    summary: 'Markus asked for something at 5:30 pm again. You said yes. Afterwards you made a plan to say no.',
    mood: 'stressed', stress: 8, sleep: 8, emotion: 3, themes: ['work'], helped: [],
    reasons: { stress: 'Another late task from Markus.', sleep: 'You slept 8 hours after the Sunday walk.', mood: 'Frustrated, but determined.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      "I slept great. Then at 5:30 Markus asked for a 'quick favour'. I said yes. I worked until 9.",
      'How do you feel about it?',
      "I'm done with this. So I made a plan in Stress solving tonight: saying no to Markus.",
      "That's a big step. What's the first part of the plan?",
      "Next time he asks late, I say: 'I can do it tomorrow morning.' I wrote the sentence down.",
      'Having the sentence ready makes it much easier. Good luck, Jonas.',
    ),
  },
  {
    key: 'w3-tue', week: 3, weekday: 2, title: 'Tired, but ready',
    summary: 'Another short night of about 5 hours. You practised your sentence for Markus.',
    mood: 'ok', stress: 6, sleep: 5, emotion: 5, themes: ['sleep', 'work'], helped: [],
    reasons: { stress: 'Tired after the late evening.', sleep: 'About 5 hours.', mood: 'Tired, but motivated.' },
    messages: chat(
      'Hi Jonas, how are you today?',
      'Tired. 5 hours again. Typical after a late evening.',
      'You know that pattern well by now.',
      "Yes. And it makes me even more sure about the plan. I practised the sentence in my head.",
      'How does it feel to say it?',
      'Strange. But okay.',
      "It will feel easier each time. You're ready.",
    ),
  },
  {
    key: 'w3-wed', week: 3, weekday: 3, title: 'I said no!',
    summary: 'At 5:30 pm Markus asked again. You said "I can do it tomorrow morning". He said fine. Then you went for a walk.',
    mood: 'great', stress: 4, sleep: 6, emotion: 7, themes: ['work', 'health'], helped: ['Saying "I can do it tomorrow morning"', 'An evening walk'],
    reasons: { stress: 'You said no to a late task. It was fine.', sleep: 'About 6 hours.', mood: 'You felt proud.' },
    messages: chat(
      'Hi Jonas, how was today?',
      "I DID IT. 5:30, Markus with a 'quick thing'. I said: 'I can do it tomorrow morning.'",
      'And what did he say?',
      "'Sure, fine.' That's it!",
      'Congratulations! How did it feel?',
      'My heart was pounding. But then I left at 6 and went for a walk. I still can\'t believe it was so easy.',
      'You just learned that a no can be completely fine. Enjoy your evening!',
    ),
  },
  {
    key: 'w3-thu', week: 3, weekday: 4, title: 'Slept 8 hours',
    summary: 'After the walk you slept 8 hours. You did the task for Markus in the morning. Nobody minded.',
    mood: 'good', stress: 4, sleep: 8, emotion: 7, themes: ['work', 'sleep'], helped: ['The walk yesterday'],
    reasons: { stress: 'A normal day. The task was done by 10.', sleep: 'You slept 8 hours.', mood: 'Calm and focused.' },
    messages: chat(
      'Hi Jonas, how was your Thursday?',
      'I slept 8 hours after the walk. I did the task for Markus at 9. Done by 10.',
      'Did anyone mind that it came in the morning?',
      'No. Nobody even noticed.',
      "That's important to know. How do you feel?",
      "Light. It's a bit silly I never tried this before.",
      "It's not silly. It's new. Well done.",
    ),
  },
  {
    key: 'w3-sat', week: 3, weekday: 6, title: 'Hiking',
    summary: 'A hike with friends. You felt great.',
    mood: 'great', stress: 2, sleep: 7, emotion: 8, themes: ['health', 'social'], helped: ['Hiking with friends'],
    reasons: { stress: 'A free Saturday outside.', sleep: 'About 7 hours.', mood: 'You felt great.' },
    messages: chat(
      'Hi Jonas, how is your Saturday?',
      'I went hiking with friends. Perfect weather.',
      'How do you feel?',
      'Great. Tired legs, happy head.',
      'Sounds like a perfect Saturday. Enjoy it!',
    ),
  },

  // ─── Week 4: the talk with Markus, the calmest week ─────────────────────
  {
    key: 'w4-mon', week: 4, weekday: 1, title: 'Preparing the talk',
    summary: 'You booked 10 minutes with Markus for Tuesday. You want to talk about late tasks.',
    mood: 'ok', stress: 5, sleep: 7, emotion: 6, themes: ['work'], helped: [],
    reasons: { stress: 'A bit nervous about the talk.', sleep: 'About 7 hours.', mood: 'Nervous, but okay.' },
    messages: chat(
      'Hi Jonas, how was your Monday?',
      'Okay. I booked 10 minutes with Markus tomorrow.',
      'What do you want to ask him?',
      "That tasks after 4 pm wait until the next morning. Unless it's really urgent.",
      "That's clear and fair. How do you feel about it?",
      'Nervous. But after last week I think he will say yes.',
      'You already know he can react well. Good luck tomorrow!',
    ),
  },
  {
    key: 'w4-tue', week: 4, weekday: 2, title: 'The talk went well',
    summary: 'Markus agreed: tasks after 4 pm wait until the next morning, unless urgent. You played football to celebrate.',
    mood: 'great', stress: 4, sleep: 7, emotion: 8, themes: ['work', 'health'], helped: ['The talk with Markus', 'Football with friends'],
    reasons: { stress: 'Nervous before the talk. Relieved after.', sleep: 'About 7 hours.', mood: 'Relieved and happy.' },
    messages: chat(
      "Hi Jonas, how did the talk go?",
      "Really well! I was so nervous before. But Markus was relaxed.",
      "What did he say?",
      "He said he did not notice that he always comes so late. He was a bit surprised.",
      "And the 4 pm rule?",
      "He agreed. After 4 pm it waits until the next morning. Unless it's really urgent.",
      "That's a big step. How did you bring it up?",
      "I just said it like I practised. Short and calm. No long explanation.",
      "That often works best. How do you feel now?",
      "Relieved. I went to football afterwards to celebrate.",
      "You earned it. Enjoy the evening!",
    ),
  },
  {
    key: 'w4-wed', week: 4, weekday: 3, title: 'Slept 8 hours again',
    summary: 'After football you slept 8 hours. A calm, focused day.',
    mood: 'great', stress: 3, sleep: 8, emotion: 8, themes: ['sleep', 'work'], helped: ['Football yesterday'],
    reasons: { stress: 'A calm, focused day.', sleep: 'You slept 8 hours.', mood: 'You felt great.' },
    messages: chat(
      "Hi Jonas, how was your Wednesday?",
      "Good. I slept 8 hours after football.",
      "Nice. How was work?",
      "Focused. I did my own tasks for once. Nobody came by late.",
      "What time did you leave?",
      "At 6. I even had time to cook.",
      "How does that feel compared to a few weeks ago?",
      "Very different. This is how work should feel.",
      "Your plans are working. Enjoy the evening!",
    ),
  },
  {
    key: 'w4-thu', week: 4, weekday: 4, title: 'The new rule works',
    summary: 'Markus came by at 5 pm and said: "That can wait until tomorrow." You marked your sleep plan as solved.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work', 'sleep'], helped: ['The 4 pm rule with Markus'],
    reasons: { stress: 'The new rule with Markus worked.', sleep: 'About 7 hours.', mood: 'Happy and relaxed.' },
    messages: chat(
      "Hi Jonas, how was today?",
      "Funny moment. Markus came by at 5 with a document.",
      "Oh. What happened?",
      "He stopped, looked at the clock and said: 'Ah, that can wait until tomorrow.'",
      "The rule works! How did that feel?",
      "Great. I did not even have to say anything.",
      "Anything else today?",
      "Yes. I marked my sleep plan as solved. I slept 7 to 8 hours almost every night this week.",
      "Two wins in one day. What helped your sleep most?",
      "The walks and football. And fewer late evenings, of course.",
      "Great combination. Maybe share your story in the community. It could help someone.",
      "Good idea. I'll do it this weekend.",
    ),
  },
  {
    key: 'w4-sun', week: 4, weekday: 7, title: 'A calm Sunday',
    summary: 'A long walk and a quiet evening. Your calmest week in a month.',
    mood: 'great', stress: 2, sleep: 8, emotion: 8, themes: ['health'], helped: ['A long walk'],
    reasons: { stress: 'A calm Sunday after a good week.', sleep: 'You slept 8 hours.', mood: 'Happy and calm.' },
    messages: chat(
      "Hi Jonas, how was your Sunday?",
      "Very calm. I went for a long walk in the morning.",
      "Nice. And the rest of the day?",
      "I read the comments on my sleep story. I shared it yesterday. Then a quiet evening with a book.",
      "How do you feel about the new week?",
      "Relaxed. For the first time I'm not dreading Monday.",
      "How was this week overall?",
      "The best in a month, honestly.",
      "Your stress was the lowest it has been. Enjoy the evening, Jonas.",
    ),
  },

  // ─── Week 5: the days since (only those already past are loaded) ─────────
  {
    key: 'w5-mon', week: 5, weekday: 1, title: 'Good start',
    summary: 'A good Monday. You left at 6 pm.',
    mood: 'good', stress: 4, sleep: 8, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A normal Monday.', sleep: 'About 8 hours.', mood: 'Good and focused.' },
    messages: chat(
      "Hi Jonas, how was your Monday?",
      "Good! A normal day.",
      "How did you sleep?",
      "About 8 hours. I walked yesterday.",
      "Did anything late come up at work?",
      "No. I left at 6.",
      "A great start to the week.",
    ),
  },
  {
    key: 'w5-tue', week: 5, weekday: 2, title: 'Football',
    summary: 'A normal day and football in the evening.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['health', 'social'], helped: ['Football with friends'],
    reasons: { stress: 'An easy day plus football.', sleep: 'About 7 hours.', mood: 'You felt great.' },
    messages: chat(
      "Evening Jonas, how was today?",
      "A normal day. And football tonight.",
      "How was the game?",
      "Great as always. We lost, but who cares.",
      "How is your head now?",
      "Empty and happy.",
      "Enjoy the evening!",
    ),
  },
  {
    key: 'w5-wed', week: 5, weekday: 3, title: 'Calm day',
    summary: 'A calm day after a good night.',
    mood: 'good', stress: 3, sleep: 8, emotion: 7, themes: ['work'], helped: [],
    reasons: { stress: 'A calm workday.', sleep: 'About 8 hours.', mood: 'Calm.' },
    messages: chat(
      "Hi Jonas, how are you?",
      "Good. A calm day.",
      "How did you sleep after football?",
      "About 8 hours. Like a stone.",
      "Anything stressful today?",
      "Not really. A long meeting, but it was fine.",
      "Good to hear. Rest well.",
    ),
  },
  {
    key: 'w5-thu', week: 5, weekday: 4, title: 'Tomorrow morning',
    summary: 'Markus asked for something at 5 pm. You said tomorrow morning. It was fine.',
    mood: 'good', stress: 4, sleep: 7, emotion: 7, themes: ['work'], helped: ['Saying "I can do it tomorrow morning"'],
    reasons: { stress: 'A late request, handled calmly.', sleep: 'About 7 hours.', mood: 'Calm and confident.' },
    messages: chat(
      "Hi Jonas, how was your Thursday?",
      "Markus asked for something at 5.",
      "What did you say?",
      "'I can do it tomorrow morning.' He said okay.",
      "How did it feel this time?",
      "Normal. No drama. My heart did not even pound.",
      "That's a new habit. Well done.",
    ),
  },
  {
    key: 'w5-fri', week: 5, weekday: 5, title: 'Easy Friday',
    summary: 'A quiet Friday. You left on time.',
    mood: 'great', stress: 3, sleep: 7, emotion: 8, themes: ['work'], helped: [],
    reasons: { stress: 'A quiet Friday.', sleep: 'About 7 hours.', mood: 'Happy. Weekend ahead.' },
    messages: chat(
      "Happy Friday! How was it?",
      "Quiet. I left at 5.",
      "Nice. How was the week?",
      "Calm. I slept well almost every night.",
      "Any plans for the weekend?",
      "A walk with my sister on Saturday.",
      "Enjoy it, Jonas.",
    ),
  },
  {
    key: 'w5-sat', week: 5, weekday: 6, title: 'Walk with my sister',
    summary: 'Another walk around the lake with your sister.',
    mood: 'great', stress: 2, sleep: 8, emotion: 8, themes: ['health', 'family'], helped: ['A walk by the lake'],
    reasons: { stress: 'A free Saturday.', sleep: 'About 8 hours.', mood: 'Relaxed and happy.' },
    messages: chat(
      "Hi Jonas, how is your Saturday?",
      "I walked around the lake with my sister again.",
      "How was it?",
      "Lovely. We talked a lot. She noticed I seem calmer.",
      "What did you tell her?",
      "About saying no to Markus. She laughed and said: finally.",
      "Sounds like a lovely day. Enjoy the weekend!",
    ),
  },
];

// ─── Weekly Insights from the end of week 4 ──────────────────────────────
// Three plain statements, each with its numbers and the days behind it.
// Late-task days: stress 8, other days 4. After a late evening: about
// 5 hours of sleep. After a walk or football: about 8 hours.
export const analysis = {
  week: 4,
  insight: 'You often say yes to late tasks, and that costs you sleep. Walks and football help.',
  question: 'How can you fit in more walks or football this week?',
  worked: [
    { text: 'Walks and football', source: 'checkin' },
    { text: 'Saying "I can do it tomorrow morning"', source: 'checkin' },
    { text: 'The 4 pm rule with Markus', source: 'checkin' },
  ],
  patterns: [
    {
      title: 'Saying yes to late tasks stresses you',
      description: 'Stress 8 on days you said yes to a late task from Markus. Stress 4 on other days.',
      icon: 'work',
      findings: [
        { text: 'Stress 8 on these five days. Each time, you said yes to a task after 5 pm.', evidence: ['w1-mon', 'w1-wed', 'w2-mon', 'w2-wed', 'w3-mon'] },
      ],
      questions: ['What could you say next time he asks late?'],
    },
    {
      title: 'After a late evening, you lie awake',
      description: 'After a late evening you lay awake and slept about 5 hours. Usually you sleep 7 to 8.',
      icon: 'sleep',
      findings: [
        { text: 'About 5 hours of sleep after each late evening.', evidence: ['w1-tue', 'w1-thu', 'w2-tue', 'w3-tue'] },
      ],
      questions: ['What helps you stop thinking about work before bed?'],
    },
    {
      title: 'Walks and football bring back your sleep',
      description: 'After a walk or football you slept about 8 hours.',
      icon: 'health',
      findings: [
        { text: 'About 8 hours of sleep after a walk or football.', evidence: ['w1-sun', 'w2-fri', 'w3-mon', 'w3-thu', 'w4-wed'] },
      ],
      questions: ['On which evenings could you go for a walk this week?'],
    },
  ],
};

// ─── Untangle ─────────────────────────────────────────────────────────────

/**
 * Calm now, at work right after the meeting (week 2, Wednesday). At 8 the
 * app guides one minute of breathing first, so the chat starts after it.
 */
export const calmSession = {
  week: 2, weekday: 3, before: 8, after: 4,
  title: 'My boss presented my work as his',
  messages: chat(
    '',
    'In the client meeting my boss showed my pitch deck as his own work. He did not mention me once. I\'m shaking.',
    "That's really unfair, no wonder you're shaking. Where are you right now?",
    'At my desk. People around me.',
    "Then something nobody will notice: push both feet into the floor and drop your shoulders. Tell me when you're done.",
    'Done. A bit better.',
    "Good. What would you like to say to him?",
    'That I did the work. And that I want to be named.',
    "That's fair. Write that one sentence down, but don't send it today. Tell me when you're done.",
    'Wrote it down. I can decide tomorrow.',
    'How does it feel now?',
    'Calmer. Less shaky.',
    'Good to hear. If you feel calmer, tap "I feel calmer".',
  ).slice(1),
};

const steps = (...items: [string, number, boolean][]) => items.map(([text, minutes, done]) => ({ text, minutes, done }));

/** Stress solving, solved: falling asleep (made week 2 Tuesday, solved week 4 Thursday). */
export const sleepPlan = {
  week: 2, weekday: 2, solvedWeek: 4, solvedWeekday: 4, before: 7, after: 3,
  title: 'Falling asleep after stressful days',
  problem: 'After a late evening you lie awake. You sleep only about 5 hours.',
  plan: {
    approach: 'Moving outside helps you switch off. After your walk by the lake, you slept 8 hours.',
    watch_for: 'You sleep 7 hours or more on most nights.',
    note: 'Some nights will still be short. That is okay.',
    lessons: [
      { text: 'After a walk you slept 8 hours.', kind: 'helped', evidence: ['w1-sat', 'w1-sun'] },
      { text: 'After a late evening you slept about 5 hours.', kind: 'worse', evidence: ['w1-tue', 'w1-thu'] },
    ],
    steps: steps(
      ['Walk for 20 minutes after work, three times a week.', 20, true],
      ['Keep your phone out of the bedroom. Use an alarm clock.', 2, true],
      ['If a thought keeps you awake, write it on a note by your bed.', 2, true],
    ),
  },
  messages: chat(
    '',
    'Every time I work late, I lie awake until 1. Then I sleep about 5 hours.',
    'That sounds tiring. What keeps your mind busy when you lie awake?',
    'The task. What my boss will say. What I still have to do.',
    'And what do you usually do in the hour before bed?',
    'I scroll on my phone. Mostly emails.',
    'Last Saturday, after your walk, you slept 8 hours. Have you noticed that before?',
    'Yes. When I move, I sleep better.',
    'How often could you go for a walk after work?',
    'Maybe three times a week. 20 minutes.',
    'That gives us a good picture. Tap "Make my plan".',
  ).slice(1),
  story: {
    title: 'How I learned to sleep again after stressful days',
    body: "For weeks, every late evening at work ended the same way. I lay awake until 1 and slept five hours. My check-ins showed me something I had not noticed. After a walk or football, I slept almost eight hours. So I made a simple plan. A 20-minute walk after work, three times a week. My phone out of the bedroom. And a note next to my bed for thoughts that won't stop. After two weeks I slept seven to eight hours on most nights. My tip: if you lie awake after work, move first. Then sleep.",
    comments: [
      { author: 'lisa_h', body: 'The note next to the bed is such a simple idea. Trying it tonight.' },
      { author: 'marco.b', body: 'Same for me with running. Move first, then sleep. Great story!' },
    ],
  },
};

/** Stress solving, active: saying no to the boss (made week 3 Monday). */
export const bossPlan = {
  week: 3, weekday: 1, before: 8, after: 3,
  title: 'Saying no to my boss',
  problem: 'Markus often gives you tasks after 5 pm. You say yes, work late and sleep badly.',
  plan: {
    approach: 'Most late tasks can wait until the morning. A ready sentence makes saying no easier in the moment.',
    watch_for: 'You leave work by 6:30 pm on most days.',
    note: "You can't control what Markus asks. You can control your answer.",
    lessons: [
      { text: 'Days with a late task: stress 8.', kind: 'worse', evidence: ['w1-mon', 'w2-mon'] },
      { text: 'After a late evening: about 5 hours of sleep.', kind: 'worse', evidence: ['w1-tue', 'w2-tue'] },
    ],
    steps: steps(
      ['When Markus asks after 5 pm, say: "I can do it tomorrow morning."', 1, true],
      ['If something is really urgent, ask: "What should I drop for this?"', 1, false],
    ),
  },
  messages: chat(
    '',
    'My boss keeps giving me tasks after 5 pm. I always say yes. Then I work late and sleep badly.',
    'What goes through your head when he asks?',
    "That saying no looks lazy. And that it's faster to just do it.",
    'Are these tasks usually urgent? Or could they wait until the next morning?',
    'Honestly, most could wait.',
    'Has he ever reacted badly when you said no?',
    'No. I never really tried.',
    'What would be an easy sentence for you to say?',
    'Maybe: "I can do it tomorrow morning."',
    'That gives us a clear picture. Tap "Make my plan".',
    'Update: I said "I can do it tomorrow morning" today. He just said fine!',
    "That's a great first step. Keep using the sentence. And if something is really urgent, ask what you can drop for it.",
    'Update: I talked to Markus. He agreed that tasks after 4 pm wait until the next morning.',
    'Well done, Jonas. That goes even beyond your plan. Let\'s see if the rule holds in the next weeks.',
  ).slice(1),
};

/**
 * Static mock content for the prototype: exercises, knowledge articles, deep dives,
 * tracker metrics and seed diary entries. Typed so screens stay honest.
 */
import { gradients } from '@/theme';

export type Exercise = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  icon: string; // Ionicons name
  tint: string;
  guidance: string;
};

export const exercises: Exercise[] = [
  {
    id: 'pmr',
    title: 'Progressive Muscle Relaxation',
    description: 'Systematically tense and relax muscle groups to release tension',
    minutes: 20,
    level: 'Beginner',
    rating: 4.7,
    icon: 'body-outline',
    tint: '#10B981',
    guidance: 'Starting with your feet, tense each muscle group for 5 seconds, then release. Work your way up to your face.',
  },
  {
    id: 'box',
    title: 'Box Breathing',
    description: 'A powerful technique used by Navy SEALs to stay calm under pressure',
    minutes: 5,
    level: 'Beginner',
    rating: 4.8,
    icon: 'square-outline',
    tint: '#3B82F6',
    guidance: 'Breathe in for 4 counts, hold for 4, breathe out for 4, hold for 4. Repeat with the circle.',
  },
  {
    id: 'bodyscan',
    title: 'Body Scan Meditation',
    description: 'Bring gentle awareness through the body to ground yourself',
    minutes: 12,
    level: 'Intermediate',
    rating: 4.6,
    icon: 'scan-outline',
    tint: '#8B5CF6',
    guidance: 'Slowly bring your attention through your body, from your toes to the top of your head, noticing any sensation without judgment.',
  },
  {
    id: '478',
    title: '4-7-8 Breathing',
    description: 'A calming breath pattern that helps you wind down before sleep',
    minutes: 4,
    level: 'Beginner',
    rating: 4.9,
    icon: 'moon-outline',
    tint: '#6366F1',
    guidance: 'Inhale quietly for 4 counts, hold for 7, then exhale completely through your mouth for 8 counts.',
  },
];

export type Article = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  category: 'Stress' | 'Sleep' | 'Mindfulness';
  icon: string;
  tint: string;
  featured?: boolean;
  body: string[];
};

export const knowledgeCategories = ['All', 'Stress', 'Sleep', 'Mindfulness'] as const;

export const articles: Article[] = [
  {
    id: 'gratitude',
    title: 'Why Gratitude Reduces Stress',
    description: 'Discover the neuroscience behind gratitude practice and how it rewires your brain for happiness.',
    minutes: 8,
    category: 'Mindfulness',
    icon: 'star',
    tint: '#F59E0B',
    featured: true,
    body: [
      'Gratitude practice does more than make you feel good in the moment — it measurably changes how your brain responds to stress. Regularly noticing what you’re thankful for activates the prefrontal cortex and increases activity in reward pathways, gradually shifting your baseline mood over weeks of practice.',
      'People who keep a short gratitude log report lower cortisol levels and better sleep, likely because focusing on positive events counteracts the brain’s natural negativity bias — its tendency to dwell on threats and problems.',
      'You don’t need a long ritual. Writing down three specific things you’re grateful for, even briefly, is enough to start rewiring the pattern. Specificity matters more than length: "my friend called to check on me today" works better than a vague "my friends."',
      'Try it for one week: each evening, write one sentence about something that went well. Notice whether your evenings start to feel a little lighter.',
    ],
  },
  {
    id: 'sleep-hygiene',
    title: 'Sleep Hygiene Essentials',
    description: 'Simple habits that can dramatically improve your sleep quality tonight.',
    minutes: 4,
    category: 'Sleep',
    icon: 'moon',
    tint: '#6366F1',
    body: [
      'Sleep hygiene refers to the habits and environment that shape how well you sleep. Small, consistent changes usually beat dramatic overhauls.',
      'Keep a consistent wake-up time, even on weekends — your body’s internal clock responds far more to when you wake than when you fall asleep.',
      'Dim the lights and step away from screens for the last 30 minutes before bed. Blue light suppresses melatonin, the hormone that signals it’s time to sleep.',
      'Keep your bedroom cool, dark, and used only for sleep — training your brain to associate the room with rest, not scrolling or working, makes falling asleep easier over time.',
    ],
  },
  {
    id: 'fight-flight',
    title: 'Understanding Fight-or-Flight',
    description: 'How your stress response works and why it sometimes misfires in modern life.',
    minutes: 6,
    category: 'Stress',
    icon: 'flash',
    tint: '#EF4444',
    body: [
      'The fight-or-flight response is an ancient survival mechanism: when your brain perceives a threat, it floods your body with adrenaline and cortisol, sharpening focus and readying your muscles for action.',
      'This system evolved to handle short, physical dangers — a predator, a fall. It didn’t evolve for inboxes, deadlines, or doomscrolling, all of which can trigger the same physiological alarm without ever giving your body the physical release it’s primed for.',
      'That mismatch is why modern stress can feel exhausting rather than sharpening: the body stays activated with nowhere to direct the energy.',
      'Simple physical actions — a brisk walk, shaking out your hands, even a few minutes of exercise — help signal to your nervous system that the "danger" has passed, closing the loop the stress response was built to complete.',
    ],
  },
  {
    id: 'micro-breaks',
    title: 'The Power of Micro-Breaks',
    description: 'Why 60-second pauses through your day keep stress from compounding.',
    minutes: 3,
    category: 'Stress',
    icon: 'timer',
    tint: '#10B981',
    body: [
      'Stress rarely arrives all at once — it accumulates in small increments across the day until it feels overwhelming. Micro-breaks interrupt that build-up before it compounds.',
      'A micro-break is any brief, deliberate pause — 30 to 90 seconds — where you step away from what you’re doing: a few slow breaths, a short stretch, or simply looking away from your screen.',
      'Research on attention and recovery shows these short resets measurably lower physiological stress markers and improve focus afterward, even though they feel almost too small to matter.',
      'Try anchoring micro-breaks to something you already do often — every time you refill water, or between meetings — so they become automatic rather than one more thing to remember.',
    ],
  },
];

export type DeepDive = {
  id: string;
  title: string;
  description: string;
  progress: number; // 0..100
  icon: string;
  gradient: readonly [string, string];
  findings: string[];
  reflection: string[];
  exerciseId: string;
  articleId: string;
};

export const deepDives: DeepDive[] = [
  {
    id: 'triggers',
    title: 'Understanding Your Stress Triggers',
    description: 'Early analysis shows work deadlines may be a key stressor. Keep logging to unlock deeper patterns.',
    progress: 25,
    icon: 'analytics-outline',
    gradient: gradients.insight,
    findings: [
      'Work-related stress appears in most of your recent entries, usually tied to deadlines.',
      'Your stress tends to peak in the late afternoon, then carries into your evenings.',
      'On days you mention a short break or walk, your entries sound noticeably calmer.',
    ],
    reflection: [
      'Which specific part of a deadline stresses you most — the time pressure, or fear of the result not being good enough?',
      'What usually happens right before your stress spikes in the afternoon?',
    ],
    exerciseId: 'box',
    articleId: 'fight-flight',
  },
  {
    id: 'activity',
    title: 'Physical Activity & Stress',
    description: 'Your entries suggest movement helps reduce stress. Let’s explore this connection further.',
    progress: 15,
    icon: 'sparkles-outline',
    gradient: gradients.emotion,
    findings: [
      'Entries that mention walking or movement rate noticeably lower on stress.',
      'Your calmest recent entry — "Morning Walk" — followed light exercise.',
    ],
    reflection: [
      'What usually stops you from taking a short walk on a stressful day?',
      'Where in your daily routine could a 10-minute movement break realistically fit?',
    ],
    exerciseId: 'pmr',
    articleId: 'micro-breaks',
  },
  {
    id: 'skills',
    title: 'Stress Management Skills',
    description: 'Building your toolkit for handling stressful situations. Keep practicing!',
    progress: 20,
    icon: 'heart-outline',
    gradient: gradients.stress,
    findings: [
      'You’ve started building a routine — keep logging to strengthen the habit.',
      'Breathing techniques seem to fit your schedule best: short, anywhere, no equipment.',
    ],
    reflection: [
      'Think of your last stressful moment: what’s the first thing you did? Would a 60-second pause have changed it?',
      'Which technique would you actually reach for under pressure — and what would make it easier to remember?',
    ],
    exerciseId: '478',
    articleId: 'gratitude',
  },
];

export type Metric = {
  id: 'stress' | 'emotion' | 'sleep';
  label: string;
  max: 10;
  weeklyAvg: number;
  lowLabel: string;
  highLabel: string;
  icon: string;
  gradient: readonly [string, string];
};

/** Metadata only — the live score for each metric lives in useAppStore so users can edit it. */
export const metrics: Metric[] = [
  {
    id: 'stress',
    label: 'Stress',
    max: 10,
    weeklyAvg: 5.1,
    lowLabel: 'Low',
    highLabel: 'High',
    icon: 'pulse-outline',
    gradient: gradients.stress,
  },
  {
    id: 'emotion',
    label: 'Emotion',
    max: 10,
    weeklyAvg: 6.0,
    lowLabel: 'Low',
    highLabel: 'High',
    icon: 'happy-outline',
    gradient: gradients.emotion,
  },
  {
    id: 'sleep',
    label: 'Sleep Quality',
    max: 10,
    weeklyAvg: 6.9,
    lowLabel: 'Poor',
    highLabel: 'Great',
    icon: 'moon-outline',
    gradient: gradients.sleep,
  },
];

/** 7-day stress series for the tracker chart (0..10). */
export const weeklyStress = [6, 5, 7, 4, 6, 3, 3];
export const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type MoodKey = 'great' | 'good' | 'ok' | 'low' | 'stressed';

export const moods: { key: MoodKey; emoji: string; label: string }[] = [
  { key: 'great', emoji: '😊', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'ok', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😔', label: 'Low' },
  { key: 'stressed', emoji: '😰', label: 'Stressed' },
];

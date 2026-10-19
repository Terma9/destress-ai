/**
 * Calm now: a short conversation whose only goal is that the user feels
 * calmer by the end. Small tips are fine, plans are not (that's Stress
 * solving). The AI may point to one of the user's plans.
 *
 *   intake — how stressed (0–10, a slider) and what's going on
 *   settle — at 7+, a short note on why calming the body comes first
 *   breathe — then one minute of guided breathing (the AI is told, so it
 *             doesn't suggest breathing again)
 *   talk   — the calming conversation (untangle-chat, mode 'calm')
 *   rate   — "How intense is it now?", saved with the conversation
 *   done   — before → after, plus a way into Stress solving
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ChatMessage, streamUntangleReply } from '@/ai/checkinClient';
import { HaloLogo, SoftDots } from '@/components/brand';
import { MessageBubble, TypingBubble, VoiceComposer } from '@/components/chat';
import { AiMark, PressableScale } from '@/components/motion';
import { BreathingPause, StressSlider } from '@/components/untangle';
import { fetchSessions, saveCalmSession, type UntangleSession } from '@/data/untangle';
import { colors, fields, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

type Stage = 'intake' | 'settle' | 'breathe' | 'talk' | 'rate' | 'saving' | 'done';
const BREATHE_FROM = 7;
/** How long the "you seem very stressed" note stays before the breathing starts. */
const SETTLE_MS = 6500;

export default function CalmNow() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [stage, setStage] = useState<Stage>('intake');
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replying, setReplying] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<UntangleSession[]>([]);
  const [breathed, setBreathed] = useState(false);

  useEffect(() => {
    fetchSessions()
      .then((rows) => setPlans(rows.filter((s) => s.kind === 'plan' && s.status === 'active').slice(0, 3)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (stage !== 'settle') return;
    const timer = setTimeout(() => setStage('breathe'), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const requestReply = async (history: ChatMessage[], afterBreathing = breathed) => {
    setReplying(true);
    setError(null);
    try {
      await streamUntangleReply(history, before!, (t) => setMessages([...history, { role: 'assistant', content: t }]), {
        mode: 'calm',
        breathed: afterBreathing,
      });
    } catch (err) {
      setMessages(history);
      setError((err as Error).message);
    } finally {
      setReplying(false);
    }
  };

  const send = (text: string) => {
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    if (stage === 'intake' && before! >= BREATHE_FROM) return setStage('settle');
    setStage('talk');
    requestReply(history);
  };

  const save = async () => {
    if (after === null) return;
    setStage('saving');
    try {
      await saveCalmSession(messages, before!, after);
      setStage('done');
    } catch (err) {
      setError((err as Error).message);
      setStage('rate');
    }
  };

  const hasAiReply = messages.some((m) => m.role === 'assistant');
  const waiting = replying && messages[messages.length - 1]?.role !== 'assistant';

  return (
    <KeyboardAvoidingView
      style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Calm now</Text>
          <AiMark label="SLOWING DOWN TOGETHER" size={11} />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>

      {stage === 'settle' ? (
        <View style={styles.settle}>
          <Animated.View entering={FadeIn.duration(800)}>
            <HaloLogo size={64} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(700).delay(400)} style={styles.settleTitle}>
            You seem very stressed right now.
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(700).delay(1800)} style={styles.settleText}>
            Let's calm your nervous system first. A minute of slow breathing helps most, so you can look at what's going on
            with a clear head.
          </Animated.Text>
        </View>
      ) : stage === 'breathe' ? (
        <BreathingPause
          onDone={() => {
            setBreathed(true);
            setStage('talk');
            requestReply(messages, true);
          }}
        />
      ) : stage === 'done' ? (
        <ScrollView contentContainerStyle={[styles.done, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: 'center' }}>
            <HaloLogo size={72} />
            <Text style={styles.numbers}>
              {before} <Text style={styles.arrow}>→</Text> {after}
            </Text>
            <Text style={styles.doneText}>
              {before! - after! >= 2
                ? "That's a real shift. I'll remember what helped you today."
                : "Thank you for taking this moment. Some days stress doesn't move quickly, and that's okay."}
            </Text>
          </Animated.View>

          {plans.length > 0 && (
            <Animated.View entering={FadeInDown.duration(420).delay(250)} style={{ alignSelf: 'stretch' }}>
              <Text style={styles.label}>YOUR PLANS</Text>
              {plans.map((p) => (
                <PressableScale
                  key={p.id}
                  style={styles.planLink}
                  onPress={() => router.replace({ pathname: '/untangle/[id]', params: { id: p.id } })}>
                  <Text style={styles.planLinkText}>{p.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </PressableScale>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(420).delay(350)} style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <PressableScale onPress={() => router.replace('/untangle/new')} style={styles.secondary}>
              <Text style={styles.secondaryText}>Does this keep coming back? Start Stress solving</Text>
            </PressableScale>
            <PressableScale onPress={() => router.back()}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Text style={styles.primaryText}>Done</Text>
              </LinearGradient>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {stage === 'intake' ? (
              <Animated.View entering={FadeIn.duration(500)} style={{ gap: spacing.sm }}>
                <Text style={styles.intro}>Stressed right now? Let's slow down together. It only takes a few minutes.</Text>
                <Text style={styles.question}>How stressed are you right now?</Text>
                <StressSlider value={before} onChange={setBefore} />
                {before !== null && (
                  <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                    <Text style={styles.question}>What is stressing you?</Text>
                    <Text style={styles.hint}>Describe it in a few words or tap the mic. Then we slow down together.</Text>
                  </Animated.View>
                )}
              </Animated.View>
            ) : (
              <>
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}
                {waiting && <TypingBubble />}
                {(stage === 'rate' || stage === 'saving') && (
                  <Animated.View entering={FadeInDown.duration(420)} style={styles.rateCard}>
                    <Text style={styles.question}>How intense is it now?</Text>
                    <Text style={styles.hint}>You started at {before}.</Text>
                    <View style={{ marginTop: spacing.md }}>
                      <StressSlider value={after} onChange={setAfter} />
                    </View>
                    <PressableScale onPress={save} disabled={after === null || stage === 'saving'} style={{ marginTop: spacing.md }}>
                      <LinearGradient
                        colors={gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.primary, after === null && { opacity: 0.4 }]}>
                        {stage === 'saving' ? <SoftDots color={colors.ivory} size={6} /> : <Text style={styles.primaryText}>Save</Text>}
                      </LinearGradient>
                    </PressableScale>
                  </Animated.View>
                )}
              </>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          {stage !== 'rate' && stage !== 'saving' && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
              {hasAiReply && (
                <PressableScale onPress={() => setStage('rate')} disabled={replying || voiceBusy}>
                  <LinearGradient
                    colors={[fields.mood.from, fields.mood.to]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.calmer, (replying || voiceBusy) && { opacity: 0.5 }]}>
                    <Ionicons name="leaf-outline" size={16} color={fields.mood.deep} />
                    <Text style={[styles.calmerText, { color: fields.mood.deep }]}>I feel calmer</Text>
                  </LinearGradient>
                </PressableScale>
              )}
              <VoiceComposer
                disabled={replying || before === null}
                onSend={send}
                onError={setError}
                onBusyChange={setVoiceBusy}
                placeholder={stage === 'intake' ? "What's going on…" : 'Write or tap the mic…'}
              />
            </View>
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.ivory },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...font.h3, color: colors.ink },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  list: { padding: spacing.lg, gap: spacing.sm },
  intro: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginBottom: spacing.md },
  question: { ...font.title, color: colors.ink },
  hint: { ...font.small, color: colors.textMuted },
  label: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  rateCard: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.md, ...shadow.card },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  calmer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radii.pill },
  calmerText: { fontFamily: fontFamily.semibold, fontSize: 15 },
  primary: { height: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ivory },
  secondary: { backgroundColor: colors.sand, borderRadius: radii.md, paddingVertical: 13, paddingHorizontal: spacing.md, alignItems: 'center' },
  secondaryText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  settle: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  settleTitle: { ...font.h3, color: colors.ink, textAlign: 'center' },
  settleText: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  done: { padding: spacing.xl, gap: spacing.xl, alignItems: 'center' },
  numbers: { fontFamily: fontFamily.bold, fontSize: 44, color: colors.ink, letterSpacing: -1, marginTop: spacing.md },
  arrow: { color: colors.textFaint },
  doneText: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 21, marginTop: spacing.sm },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  planLinkText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink, flex: 1 },
  error: { ...font.small, color: colors.danger, marginTop: spacing.sm },
});

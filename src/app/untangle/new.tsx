/**
 * Stress solving: work out a well-founded plan for something that keeps
 * stressing you, together with the AI and everything it knows about you.
 *
 * New plan:      intake (what, how much it weighs) → questions → "Make my plan"
 * Existing plan: ?sessionId=… loads the plan's conversation; the user tells
 *                how it's going, then "Update my plan" (old version is kept)
 *                or "Save and close" (just keeps the conversation).
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ChatMessage, createUntanglePlan, streamUntangleReply } from '@/ai/checkinClient';
import { BreathingLogo, CalmLoader } from '@/components/brand';
import { MessageBubble, TypingBubble, VoiceComposer } from '@/components/chat';
import { AiMark, PressableScale } from '@/components/motion';
import { IntensityPicker } from '@/components/untangle';
import { fetchSession, saveThread } from '@/data/untangle';
import { colors, font, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

type Stage = 'loading' | 'intake' | 'talk' | 'planning';

export default function StressSolving() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [stage, setStage] = useState<Stage>(sessionId ? 'loading' : 'intake');
  const [intensity, setIntensity] = useState<number | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** How many messages were already saved, so we know if the user added something. */
  const [savedCount, setSavedCount] = useState(0);
  const [replying, setReplying] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Continuing a plan: load its conversation and greet without an AI call.
  useEffect(() => {
    if (!sessionId) return;
    fetchSession(sessionId)
      .then((d) => {
        if (!d) return router.back();
        const greeting: ChatMessage = { role: 'assistant', content: 'Good to see you again. How is it going with your plan?' };
        setTitle(d.session.title);
        setIntensity(d.session.intensity_after ?? d.session.intensity_before);
        setMessages([...d.session.messages, greeting]);
        setSavedCount(d.session.messages.length + 1);
        setStage('talk');
      })
      .catch((err: Error) => {
        setError(err.message);
        setStage('talk');
      });
  }, [sessionId]);

  const requestReply = async (history: ChatMessage[]) => {
    setReplying(true);
    setError(null);
    try {
      await streamUntangleReply(history, intensity!, (t) => setMessages([...history, { role: 'assistant', content: t }]), {
        mode: 'plan',
        sessionId,
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
    setStage('talk');
    requestReply(history);
  };

  const makePlan = async () => {
    setStage('planning');
    setError(null);
    try {
      const id = await createUntanglePlan(messages, intensity!, sessionId);
      router.replace({ pathname: '/untangle/[id]', params: { id } });
    } catch (err) {
      setError((err as Error).message);
      setStage('talk');
    }
  };

  const saveAndClose = async () => {
    if (sessionId && messages.length > savedCount) {
      await saveThread(sessionId, messages).catch(() => {});
    }
    router.back();
  };

  const hasAiReply = messages.slice(sessionId ? savedCount : 0).some((m) => m.role === 'assistant');
  const addedSomething = messages.length > savedCount;
  const waiting = replying && messages[messages.length - 1]?.role !== 'assistant';
  const busy = replying || voiceBusy;

  return (
    <KeyboardAvoidingView
      style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title ?? 'Stress solving'}
          </Text>
          <AiMark label={sessionId ? 'HOW IS YOUR PLAN GOING?' : 'A PLAN THAT FITS YOU'} size={11} />
        </View>
        <Pressable onPress={saveAndClose} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>

      {stage === 'loading' ? (
        <CalmLoader />
      ) : stage === 'planning' ? (
        <View style={styles.center}>
          <BreathingLogo size={72} />
          <Text style={styles.centerTitle}>{sessionId ? 'Updating your plan…' : 'Making your plan…'}</Text>
          <Text style={styles.centerSub}>Looking at your check-ins, patterns and what helped you before.</Text>
        </View>
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
                <Text style={styles.intro}>
                  Something keeps stressing you? Let's understand it together and make a plan that fits you, based on
                  your check-ins and what helped you before.
                </Text>
                <Text style={styles.question}>How much does it weigh on you?</Text>
                <IntensityPicker value={intensity} onChange={setIntensity} />
                {intensity !== null && (
                  <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: spacing.lg, gap: 4 }}>
                    <Text style={styles.question}>What keeps stressing you?</Text>
                    <Text style={styles.hint}>A few sentences are enough. You can also speak.</Text>
                  </Animated.View>
                )}
              </Animated.View>
            ) : (
              <>
                {messages.map((m, i) => (
                  <View key={i} style={sessionId && i < savedCount - 1 ? styles.older : undefined}>
                    <MessageBubble message={m} />
                  </View>
                ))}
                {waiting && <TypingBubble />}
              </>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {hasAiReply && (
              <View style={styles.actions}>
                {sessionId && (
                  <PressableScale onPress={saveAndClose} disabled={busy} style={[styles.secondary, busy && styles.dim]}>
                    <Text style={styles.secondaryText}>Save and close</Text>
                  </PressableScale>
                )}
                <PressableScale onPress={makePlan} disabled={busy || !addedSomething} style={{ flex: 1 }}>
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.primary, (busy || !addedSomething) && styles.dim]}>
                    <Ionicons name="sparkles" size={15} color={colors.ivory} />
                    <Text style={styles.primaryText}>{sessionId ? 'Update my plan' : 'Make my plan'}</Text>
                  </LinearGradient>
                </PressableScale>
              </View>
            )}
            <VoiceComposer
              disabled={replying || intensity === null}
              onSend={send}
              onError={setError}
              onBusyChange={setVoiceBusy}
              placeholder={stage === 'intake' ? 'Describe what keeps stressing you…' : 'Write or tap the mic…'}
            />
          </View>
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
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...font.h3, color: colors.ink },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  list: { padding: spacing.lg, gap: spacing.sm },
  older: { opacity: 0.55 },
  intro: { ...font.body, color: colors.inkSoft, lineHeight: 21, marginBottom: spacing.md },
  question: { ...font.title, color: colors.ink },
  hint: { ...font.small, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerTitle: { ...font.h3, color: colors.ink },
  centerSub: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primary: { height: 48, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 15, color: colors.ivory },
  secondary: { height: 48, borderRadius: radii.pill, paddingHorizontal: spacing.lg, backgroundColor: colors.sand, justifyContent: 'center' },
  secondaryText: { fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink },
  dim: { opacity: 0.45 },
  error: { ...font.small, color: colors.danger, marginTop: spacing.sm },
});

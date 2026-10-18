/**
 * Untangle: work through what's stressing you right now.
 *
 * A guided flow, not an open chat:
 *   intake   — how intense is it (0–10) and what's going on (typed or spoken)
 *   calm     — at intensity 8+, one minute of slow breathing first
 *   talk     — the AI asks a few short questions (untangle-chat)
 *   planning — the AI makes a plan from it (untangle-plan), then the plan screen opens
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ChatMessage, createUntanglePlan, streamUntangleReply } from '@/ai/checkinClient';
import { MessageBubble, TypingBubble, VoiceComposer } from '@/components/chat';
import { BreathingPause, IntensityPicker } from '@/components/untangle';
import { colors, font, radii, spacing } from '@/theme';

type Stage = 'intake' | 'calm' | 'talk' | 'planning';

/** From this intensity on, the flow starts with a breathing pause. */
const CALM_FIRST_FROM = 8;

export default function UntangleFlow() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [stage, setStage] = useState<Stage>('intake');
  const [intensity, setIntensity] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replying, setReplying] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Streams the AI's next question into the conversation. */
  const requestReply = async (history: ChatMessage[]) => {
    setReplying(true);
    setError(null);
    try {
      await streamUntangleReply(history, intensity!, (textSoFar) => {
        setMessages([...history, { role: 'assistant', content: textSoFar }]);
      });
    } catch (err) {
      setMessages(history);
      setError((err as Error).message);
    } finally {
      setReplying(false);
    }
  };

  /** The first message is the problem; later ones answer the AI's questions. */
  const sendText = (text: string) => {
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    if (stage === 'intake' && intensity! >= CALM_FIRST_FROM) {
      setStage('calm');
      return;
    }
    setStage('talk');
    requestReply(history);
  };

  const afterCalm = () => {
    setStage('talk');
    requestReply(messages);
  };

  const makePlan = async () => {
    setStage('planning');
    setError(null);
    try {
      const id = await createUntanglePlan(messages, intensity!);
      router.replace({ pathname: '/untangle/[id]', params: { id } });
    } catch (err) {
      setError((err as Error).message);
      setStage('talk');
    }
  };

  const hasAiReply = messages.some((m) => m.role === 'assistant');
  const waitingForFirstWord = replying && messages[messages.length - 1]?.role !== 'assistant';

  return (
    <KeyboardAvoidingView
      style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Untangle</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {stage === 'calm' ? (
        <BreathingPause onDone={afterCalm} />
      ) : stage === 'planning' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.purple} size="large" />
          <Text style={styles.centerTitle}>Making your plan…</Text>
          <Text style={styles.centerSub}>Looking at what helped you in similar moments before.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {stage === 'intake' ? (
              <View style={styles.intake}>
                <Text style={styles.intro}>
                  Something stressing you right now? Let's untangle it together, using what you've learned about
                  yourself so far.
                </Text>
                <Text style={styles.label}>How intense is it right now?</Text>
                <IntensityPicker value={intensity} onChange={setIntensity} />
                <Text style={[styles.label, { marginTop: spacing.xl }]}>What's going on?</Text>
                <Text style={styles.hint}>
                  {intensity === null ? 'Pick a number first, then describe it below.' : 'A sentence or two is enough. You can also speak.'}
                </Text>
              </View>
            ) : (
              <>
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}
                {waitingForFirstWord && <TypingBubble />}
              </>
            )}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {hasAiReply && (
              <Pressable
                style={[styles.planBtn, (replying || voiceBusy) && styles.disabled]}
                disabled={replying || voiceBusy}
                onPress={makePlan}>
                <Ionicons name="list" size={16} color={colors.white} />
                <Text style={styles.planText}>Make my plan</Text>
              </Pressable>
            )}
            <VoiceComposer
              disabled={replying || intensity === null}
              onSend={sendText}
              onError={setError}
              onBusyChange={setVoiceBusy}
              placeholder={stage === 'intake' ? 'Describe what is stressing you…' : 'Answer or tap the mic…'}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...font.h3, color: colors.text },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  intake: { gap: spacing.sm },
  intro: { ...font.body, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.lg },
  label: { ...font.title, color: colors.text },
  hint: { ...font.small, color: colors.textFaint },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerTitle: { ...font.h3, color: colors.text },
  centerSub: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  errorBox: { alignSelf: 'stretch', backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing.md },
  errorText: { ...font.small, color: '#B91C1C' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.purple,
  },
  planText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.45 },
});

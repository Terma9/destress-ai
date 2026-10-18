/**
 * AI check-in: a short streamed conversation, then "Finish" turns it into a
 * saved diary entry (summary, mood, scores) via the checkin-complete function.
 * Messages can be typed or spoken; spoken ones are transcribed and sent automatically.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { type ChatMessage, type CheckinResult, completeCheckin, streamCheckinReply } from '@/ai/checkinClient';
import { CrisisCard, MessageBubble, TypingBubble, VoiceComposer } from '@/components/chat';
import { moods } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

type Status = 'replying' | 'idle' | 'saving' | 'done';

export default function CheckinChat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const recordActivity = useAppStore((s) => s.recordActivity);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>('replying');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  /** True while the composer is recording or transcribing. */
  const [voiceBusy, setVoiceBusy] = useState(false);

  /** Asks the AI for its next message and streams it into the conversation. */
  const requestReply = async (history: ChatMessage[]) => {
    setStatus('replying');
    setError(null);
    try {
      await streamCheckinReply(history, (textSoFar) => {
        setMessages([...history, { role: 'assistant', content: textSoFar }]);
      });
      setStatus('idle');
    } catch (err) {
      setMessages(history);
      setError((err as Error).message);
      setStatus('idle');
    }
  };

  // The AI opens the conversation.
  useEffect(() => {
    requestReply([]);
  }, []);

  const sendText = (text: string) => {
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    requestReply(history);
  };

  const finish = async () => {
    setStatus('saving');
    setError(null);
    try {
      setResult(await completeCheckin(messages));
      recordActivity();
      setStatus('done');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
    }
  };

  const hasUserMessage = messages.some((m) => m.role === 'user');
  const waitingForFirstWord = status === 'replying' && messages[messages.length - 1]?.role !== 'assistant';

  return (
    <KeyboardAvoidingView
      style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{status === 'done' ? 'Check-in saved' : 'Daily check-in'}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      {status === 'done' && result ? (
        <Summary result={result} onDone={() => router.back()} bottomInset={insets.bottom} />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {waitingForFirstWord && <TypingBubble />}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                {!hasUserMessage && (
                  <Pressable onPress={() => requestReply([])}>
                    <Text style={styles.errorRetry}>Try again</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {hasUserMessage && (
              <Pressable
                style={[styles.finishBtn, (status !== 'idle' || voiceBusy) && styles.disabled]}
                disabled={status !== 'idle' || voiceBusy}
                onPress={finish}>
                {status === 'saving' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                )}
                <Text style={styles.finishText}>
                  {status === 'saving' ? 'Summarizing your check-in…' : 'Finish check-in'}
                </Text>
              </Pressable>
            )}
            <VoiceComposer
              disabled={status !== 'idle'}
              onSend={sendText}
              onError={setError}
              onBusyChange={setVoiceBusy}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

/** The saved entry, plus crisis contacts when the conversation raised concern. */
function Summary({ result, onDone, bottomInset }: { result: CheckinResult; onDone: () => void; bottomInset: number }) {
  const c = result.checkin;
  const mood = moods.find((m) => m.key === c.mood);
  const scores = [
    { label: 'Stress', value: c.stress },
    { label: 'Emotion', value: c.emotion },
    { label: 'Sleep', value: c.sleep },
  ].filter((s) => s.value !== null);

  return (
    <ScrollView contentContainerStyle={[styles.summary, { paddingBottom: bottomInset + spacing.xl }]}>
      {c.risk_level !== 'none' && <CrisisCard />}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryEmoji}>{mood?.emoji ?? '🙂'}</Text>
        <Text style={styles.summaryTitle}>{c.title}</Text>
        <Text style={styles.summaryText}>{c.summary}</Text>

        {scores.length > 0 && (
          <View style={styles.scoreRow}>
            {scores.map((s) => (
              <View key={s.label} style={styles.scoreChip}>
                <Text style={styles.scoreValue}>{s.value}/10</Text>
                <Text style={styles.scoreLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {c.helped.length > 0 && (
          <Text style={styles.helped}>What helped: {c.helped.join(', ')}</Text>
        )}
      </View>

      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </ScrollView>
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
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  errorBox: { alignSelf: 'stretch', backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing.md, gap: 4 },
  errorText: { ...font.small, color: '#B91C1C' },
  errorRetry: { ...font.small, color: colors.primary, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: '#EFF6FF',
  },
  finishText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.45 },
  summary: { padding: spacing.xl, gap: spacing.lg },
  summaryCard: { backgroundColor: colors.cardAlt, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: spacing.sm },
  summaryEmoji: { fontSize: 40 },
  summaryTitle: { ...font.h3, color: colors.text, textAlign: 'center' },
  summaryText: { ...font.body, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  scoreRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  scoreChip: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  scoreValue: { ...font.title, color: colors.text },
  scoreLabel: { ...font.small, color: colors.textFaint },
  helped: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  doneBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 52, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

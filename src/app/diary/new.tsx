/**
 * AI check-in: a short streamed conversation, then "Finish" turns it into a
 * saved diary entry (summary, mood, scores) via the checkin-complete function.
 * Messages can be typed or spoken; spoken ones are transcribed and sent automatically.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ChatMessage, type CheckinResult, completeCheckin, streamCheckinReply } from '@/ai/checkinClient';
import { SoftDots } from '@/components/brand';
import { CompanionAvatar, CrisisCard, MessageBubble, TypingBubble, VoiceComposer } from '@/components/chat';
import { moodWord } from '@/components/fields';
import { AiMark, PressableScale } from '@/components/motion';
import { moods } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, fields, font, fontFamily, gradients, radii, shadow, spacing, tints } from '@/theme';

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
  const weekday = new Date().toLocaleDateString([], { weekday: 'long' });
  const finishBlocked = status !== 'idle' || voiceBusy;

  return (
    <LinearGradient
      colors={[tints.clay, colors.ivory, colors.ivory, tints.sage]}
      locations={[0, 0.3, 0.75, 1]}
      style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <CompanionAvatar size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{status === 'done' ? 'Saved to your diary' : "Tonight's check-in"}</Text>
            <AiMark label="WITH YOUR AI COMPANION" size={11} />
          </View>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.inkSoft} />
          </Pressable>
        </Animated.View>

        {status === 'done' && result ? (
          <Summary
            result={result}
            onDone={() => router.back()}
            onOpenStory={(id) => router.replace({ pathname: '/success/[id]', params: { id } })}
            bottomInset={insets.bottom}
          />
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeIn.duration(500)} style={styles.dayChip}>
                <Ionicons name="moon-outline" size={12} color={colors.textMuted} />
                <Text style={styles.dayChipText}>{weekday} evening</Text>
              </Animated.View>
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  showAvatar={m.role === 'assistant' && messages[i + 1]?.role !== 'assistant'}
                />
              ))}
              {waitingForFirstWord && <TypingBubble />}
              {error && (
                <Animated.View entering={FadeInDown.duration(260)} style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  {!hasUserMessage && (
                    <Pressable onPress={() => requestReply([])}>
                      <Text style={styles.errorRetry}>Try again</Text>
                    </Pressable>
                  )}
                </Animated.View>
              )}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
              {hasUserMessage && (
                <Animated.View entering={FadeInUp.duration(320)} style={{ alignSelf: 'center' }}>
                  <PressableScale
                    onPress={finish}
                    disabled={finishBlocked}
                    style={finishBlocked && status !== 'saving' ? styles.disabled : undefined}>
                    <LinearGradient
                      colors={[fields.mood.from, fields.mood.to]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.finish}>
                      {status === 'saving' ? (
                        <SoftDots color={fields.mood.deep} size={6} />
                      ) : (
                        <Ionicons name="checkmark" size={16} color={fields.mood.ink} />
                      )}
                      <Text style={styles.finishText}>
                        {status === 'saving' ? 'Writing your entry…' : "Finish today's entry"}
                      </Text>
                    </LinearGradient>
                  </PressableScale>
                </Animated.View>
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
    </LinearGradient>
  );
}

/** The saved entry, plus crisis contacts when the conversation raised concern. */
function Summary({
  result,
  onDone,
  onOpenStory,
  bottomInset,
}: {
  result: CheckinResult;
  onDone: () => void;
  onOpenStory: (id: string) => void;
  bottomInset: number;
}) {
  const c = result.checkin;
  const mood = moods.find((m) => m.key === c.mood);
  const chips = [
    { kind: 'stress' as const, label: 'Stress', value: c.stress === null ? null : String(c.stress) },
    { kind: 'sleep' as const, label: 'Sleep', value: c.sleep === null ? null : String(c.sleep) },
    { kind: 'mood' as const, label: 'Mood', value: c.emotion === null ? null : moodWord(c.emotion) },
  ].filter((s) => s.value !== null);

  return (
    <ScrollView contentContainerStyle={[styles.summary, { paddingBottom: bottomInset + spacing.xl }]}>
      {c.risk_level !== 'none' && <CrisisCard />}

      <Animated.View entering={FadeInDown.duration(500)} style={styles.summaryCard}>
        <Animated.Text entering={ZoomIn.duration(500).delay(200).springify()} style={styles.summaryEmoji}>
          {mood?.emoji ?? '🙂'}
        </Animated.Text>
        <Text style={styles.summaryTitle}>{c.title}</Text>
        <Text style={styles.summaryText}>{c.summary}</Text>
        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((s, i) => (
              <Animated.View
                key={s.label}
                entering={FadeInUp.duration(380).delay(350 + i * 90)}
                style={[styles.chip, { backgroundColor: fields[s.kind].from }]}>
                <Text style={[styles.chipLabel, { color: fields[s.kind].ink }]}>{s.label}</Text>
                <Text style={[styles.chipValue, { color: fields[s.kind].ink }]}>{s.value}</Text>
              </Animated.View>
            ))}
          </View>
        )}
        {c.helped.length > 0 && <Text style={styles.helped}>What helped: {c.helped.join(', ')}</Text>}
      </Animated.View>

      {(result.successes ?? []).map((story, i) => (
        <Animated.View key={story.id} entering={FadeInUp.duration(420).delay(650 + i * 100)}>
          <PressableScale onPress={() => onOpenStory(story.id)}>
            <LinearGradient
              colors={['#FDF0D8', '#F8DDB0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.success}>
              <Text style={styles.successEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Your plan worked: {story.title}</Text>
                <Text style={styles.successBody}>Saved as a success story. Add your own words or share it.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8A5A12" />
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      ))}

      <Animated.View entering={FadeInUp.duration(400).delay(800)}>
        <PressableScale onPress={onDone}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.doneBtn}>
            <Text style={styles.doneText}>Good night</Text>
          </LinearGradient>
        </PressableScale>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...font.h3, color: colors.ink, marginBottom: 2 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 10 },
  dayChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  dayChipText: { fontFamily: fontFamily.medium, fontSize: 12, color: colors.textMuted },
  errorBox: { alignSelf: 'stretch', backgroundColor: '#FFF1EA', borderRadius: radii.md, padding: spacing.md, gap: 4 },
  errorText: { ...font.small, color: '#9A3412' },
  errorRetry: { fontFamily: fontFamily.semibold, fontSize: 12, color: colors.ink },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  finish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  finishText: { fontFamily: fontFamily.semibold, fontSize: 14, color: fields.mood.ink },
  disabled: { opacity: 0.5 },
  summary: { padding: spacing.xl, gap: spacing.lg },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#F3F0EA',
    ...shadow.card,
  },
  summaryEmoji: { fontSize: 46 },
  summaryTitle: { ...font.h2, color: colors.ink, textAlign: 'center' },
  summaryText: { ...font.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center', lineHeight: 22 },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: { alignItems: 'center', borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minWidth: 74 },
  chipLabel: { fontFamily: fontFamily.semibold, fontSize: 11 },
  chipValue: { fontFamily: fontFamily.bold, fontSize: 20 },
  helped: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  successEmoji: { fontSize: 28 },
  successTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: '#6B4510' },
  successBody: { ...font.small, color: '#8A5A12', marginTop: 2 },
  doneBtn: { borderRadius: radii.md, height: 54, alignItems: 'center', justifyContent: 'center', ...shadow.lifted },
  doneText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ivory },
});

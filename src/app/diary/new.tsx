import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCheckInPrompt, summarizeEntry } from '@/ai/mockAI';
import { checkInPrompts } from '@/data/content';
import { selectTodayMood, useAppStore } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

type Mode = 'idle' | 'recording' | 'typing' | 'saving';

export default function NewEntry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addEntry = useAppStore((s) => s.addEntry);
  const todayMood = useAppStore(selectTodayMood);

  const [prompt, setPrompt] = useState('What stressed you today?');
  const [mode, setMode] = useState<Mode>('idle');
  const [text, setText] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);

  useEffect(() => {
    getCheckInPrompt().then(setPrompt);
  }, []);

  const save = async (transcript: string) => {
    setMode('saving');
    const summary = await summarizeEntry({ transcript, mood: todayMood ?? undefined });
    addEntry(summary);
    router.back();
  };

  const toggleRecord = () => {
    if (mode === 'recording') {
      // stop → save a mocked transcript
      save('Felt a wave of stress before a deadline but took a few deep breaths.');
    } else {
      setMode('recording');
    }
  };

  return (
    <View style={[styles.sheet, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Entry</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.question}>{prompt}</Text>
        <Text style={styles.hint}>Share what caused you stress or anxiety</Text>

        {mode === 'typing' ? (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type your thoughts…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.input}
            autoFocus
          />
        ) : mode === 'saving' ? (
          <View style={styles.recWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.recText}>Summarizing your entry…</Text>
          </View>
        ) : (
          <View style={styles.recWrap}>
            <Pressable onPress={toggleRecord} style={[styles.micBtn, mode === 'recording' && styles.micActive]}>
              <Ionicons name="mic" size={40} color={colors.white} />
            </Pressable>
            {mode === 'recording' ? (
              <>
                <View style={styles.recRow}>
                  <View style={styles.dot} />
                  <Text style={styles.recText}>Recording…</Text>
                </View>
                <Text style={styles.hint}>Tap the microphone to stop</Text>
              </>
            ) : (
              <Text style={styles.hint}>Tap the microphone to start</Text>
            )}
          </View>
        )}

        {showPrompts && (
          <View style={styles.promptList}>
            {checkInPrompts.map((p) => (
              <Pressable key={p} onPress={() => { setPrompt(p); setShowPrompts(false); }} style={styles.promptItem}>
                <Ionicons name="bulb-outline" size={15} color={colors.purple} />
                <Text style={styles.promptText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {mode !== 'saving' && (
        <>
          <View style={styles.toggleRow}>
            <Pressable style={styles.toggle} onPress={() => setShowPrompts((v) => !v)}>
              <Ionicons name="bulb-outline" size={16} color={colors.purple} />
              <Text style={styles.toggleText}>Prompts</Text>
            </Pressable>
            <Pressable
              style={styles.toggle}
              onPress={() => setMode((m) => (m === 'typing' ? 'idle' : 'typing'))}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.toggleText}>Type</Text>
            </Pressable>
          </View>

          {mode === 'typing' ? (
            <Pressable
              style={[styles.saveBtn, !text.trim() && { opacity: 0.5 }]}
              disabled={!text.trim()}
              onPress={() => save(text)}>
              <Text style={styles.saveText}>Save Entry</Text>
            </Pressable>
          ) : (
            <Text style={styles.footer}>Speak naturally and we will explore what stressed you today</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.white, paddingHorizontal: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...font.h3, color: colors.text },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  question: { ...font.h3, color: colors.text, textAlign: 'center' },
  hint: { ...font.small, color: colors.textFaint, textAlign: 'center' },
  recWrap: { alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  micBtn: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  micActive: { backgroundColor: colors.danger, shadowColor: colors.danger },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  recText: { ...font.body, color: colors.text, fontWeight: '500' },
  input: {
    width: '100%',
    minHeight: 140,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...font.body,
    color: colors.text,
    textAlignVertical: 'top',
    marginTop: spacing.lg,
  },
  promptList: { width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  promptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  promptText: { ...font.body, color: colors.text, flex: 1 },
  toggleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  toggleText: { ...font.body, color: colors.text, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  footer: { ...font.small, color: colors.textFaint, textAlign: 'center' },
});

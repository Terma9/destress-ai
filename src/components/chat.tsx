/**
 * Building blocks shared by the AI conversations (check-in and Untangle):
 * message bubbles, the text + voice composer, and the crisis card.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type ChatMessage, transcribeAudio } from '@/ai/checkinClient';
import { colors, font, radii, spacing } from '@/theme';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.userBubble : styles.aiBubble]}>
      <Text style={mine ? styles.userText : styles.aiText}>{message.content}</Text>
    </View>
  );
}

/** Shown while waiting for the AI's first word. */
export function TypingBubble() {
  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      <ActivityIndicator size="small" color={colors.textFaint} />
    </View>
  );
}

const MAX_RECORDING_MS = 2 * 60 * 1000;

const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Text field with a mic button. Spoken messages are transcribed and sent
 * automatically. `onBusyChange` tells the screen while a recording or
 * transcription is in progress, so it can disable its other buttons.
 */
export function VoiceComposer({
  disabled,
  onSend,
  onError,
  onBusyChange,
  placeholder = 'Write or tap the mic…',
}: {
  disabled: boolean;
  onSend: (text: string) => void;
  onError: (message: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'input' | 'recording' | 'transcribing'>('input');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder);

  useEffect(() => {
    onBusyChange?.(mode !== 'input');
  }, [mode]);

  const send = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    onSend(text);
  };

  const startRecording = async () => {
    if (disabled) return;
    onError(null);
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        onError('Microphone access is off. Allow it in your settings to speak instead of typing.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMode('recording');
    } catch (err) {
      onError(`Couldn't start recording: ${(err as Error).message}`);
      setMode('input');
    }
  };

  /** Stops recording, transcribes it and sends the text. */
  const stopRecording = async () => {
    if (mode !== 'recording') return;
    setMode('transcribing');
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('No recording was saved.');
      const text = await transcribeAudio(recorder.uri);
      setMode('input');
      if (!text) {
        onError("I didn't catch that. Try again or type your message.");
        return;
      }
      onSend(text);
    } catch (err) {
      onError((err as Error).message);
      setMode('input');
    }
  };

  const cancelRecording = async () => {
    if (mode !== 'recording') return;
    await recorder.stop();
    setMode('input');
  };

  // Recordings stop on their own at the time limit.
  useEffect(() => {
    if (mode === 'recording' && recording.durationMillis >= MAX_RECORDING_MS) stopRecording();
  }, [mode, recording.durationMillis]);

  if (mode === 'recording') {
    return (
      <View style={styles.recordBar}>
        <Pressable onPress={cancelRecording} hitSlop={8} accessibilityLabel="Cancel recording">
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
        <View style={styles.recDot} />
        <Text style={styles.recText}>
          Recording {formatDuration(recording.durationMillis)}
          <Text style={styles.recLimit}> / {formatDuration(MAX_RECORDING_MS)}</Text>
        </Text>
        <Pressable style={styles.stopBtn} onPress={stopRecording} accessibilityLabel="Stop and send">
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </Pressable>
      </View>
    );
  }
  if (mode === 'transcribing') {
    return (
      <View style={styles.recordBar}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.recText}>Transcribing…</Text>
      </View>
    );
  }
  return (
    <View style={styles.inputRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        multiline
      />
      {draft.trim() ? (
        <Pressable
          style={[styles.sendBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={send}
          accessibilityLabel="Send">
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </Pressable>
      ) : (
        <Pressable
          style={[styles.micBtn, disabled && styles.disabled]}
          disabled={disabled}
          onPress={startRecording}
          accessibilityLabel="Speak your message">
          <Ionicons name="mic" size={20} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

/** Crisis contacts, shown when the AI flags a conversation as worrying. */
export function CrisisCard() {
  return (
    <View style={styles.crisis}>
      <Text style={styles.crisisTitle}>You don't have to carry this alone</Text>
      <Text style={styles.crisisBody}>
        If things feel too heavy, please talk to someone now. TelefonSeelsorge is free, anonymous and available 24/7.
      </Text>
      <Pressable style={styles.crisisBtn} onPress={() => Linking.openURL('tel:08001110111')}>
        <Ionicons name="call" size={16} color={colors.white} />
        <Text style={styles.crisisBtnText}>Call 0800 111 0 111</Text>
      </Pressable>
      <Text style={styles.crisisNote}>In an emergency, call 112.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: radii.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md + 2 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  aiText: { ...font.body, color: colors.text, lineHeight: 21 },
  userText: { ...font.body, color: colors.white, lineHeight: 21 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    ...font.body,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingLeft: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#FEF2F2',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { ...font.body, color: colors.text, fontWeight: '600', flex: 1 },
  recLimit: { color: colors.textFaint, fontWeight: '400' },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  crisis: { backgroundColor: '#FFF7ED', borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: '#FED7AA' },
  crisisTitle: { ...font.title, color: '#9A3412' },
  crisisBody: { ...font.body, color: '#7C2D12', lineHeight: 20 },
  crisisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  crisisBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  crisisNote: { ...font.small, color: '#9A3412', textAlign: 'center' },
});

/**
 * Building blocks shared by the AI conversations (check-in and Untangle):
 * message bubbles, the typing indicator, the text + voice composer, and the
 * crisis card. Warm on purpose: the companion speaks from soft sand-colored
 * bubbles next to the logo, the user's words sit in deep ink, and every
 * message glides in.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { type ChatMessage, transcribeAudio } from '@/ai/checkinClient';
import { Logo, SoftDots } from '@/components/brand';
import { PressableScale } from '@/components/motion';
import { colors, fields, fontFamily, gradients, radii, shadow, spacing } from '@/theme';

const SAND: [string, string] = ['#FBF4EC', '#F3E8DB'];

/** The companion's little face: the logo in a soft circle. */
export function CompanionAvatar({ size = 28 }: { size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Logo size={size * 0.78} />
    </View>
  );
}

export function MessageBubble({ message, showAvatar = true }: { message: ChatMessage; showAvatar?: boolean }) {
  if (message.role === 'user') {
    return (
      <Animated.View entering={FadeInDown.duration(360).springify().damping(18)} style={styles.userRow}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </LinearGradient>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeInDown.duration(420).springify().damping(18)} style={styles.aiRow}>
      {showAvatar ? <CompanionAvatar /> : <View style={{ width: 28 }} />}
      <LinearGradient colors={SAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBubble}>
        <Text style={styles.aiText}>{message.content}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

/** Shown while waiting for the companion's first word. */
export function TypingBubble() {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.aiRow}>
      <CompanionAvatar />
      <LinearGradient colors={SAND} style={[styles.aiBubble, styles.typing]}>
        <SoftDots size={6} />
      </LinearGradient>
    </Animated.View>
  );
}

const MAX_RECORDING_MS = 2 * 60 * 1000;

const formatDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A soft ring that keeps rippling out from the mic button. */
function MicRings() {
  const reduced = useReducedMotion();
  return (
    <>
      {[0, 1].map((i) => (
        <Ring key={i} delay={i * 1300} reduced={reduced} />
      ))}
    </>
  );
}

function Ring({ delay, reduced }: { delay: number; reduced: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1));
  }, [reduced]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.7 }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.ring, { pointerEvents: "none" }, style]} />;
}

/** A small moving wave while recording, so it feels alive and listening. */
function Wave() {
  return (
    <View style={styles.wave}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <WaveBar key={i} index={i} />
      ))}
    </View>
  );
}

function WaveBar({ index }: { index: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) return;
    const peak = 0.55 + ((index * 37) % 45) / 100;
    h.value = withDelay(
      index * 90,
      withRepeat(withSequence(withTiming(peak, { duration: 380 + index * 30 }), withTiming(0.3, { duration: 420 })), -1),
    );
  }, [reduced]);
  const style = useAnimatedStyle(() => ({ height: 22 * h.value }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

/**
 * Text field with a mic button, floating on the screen. Spoken messages are
 * transcribed and sent automatically. `onBusyChange` tells the screen while
 * a recording or transcription is in progress.
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
      <Animated.View entering={FadeInUp.duration(240)} style={[styles.composer, styles.recording]}>
        <Pressable onPress={cancelRecording} hitSlop={8} accessibilityLabel="Cancel recording" style={styles.iconBtn}>
          <Ionicons name="close" size={20} color={fields.stress.ink} />
        </Pressable>
        <Wave />
        <Text style={styles.recText}>
          {formatDuration(recording.durationMillis)}
          <Text style={styles.recLimit}> / {formatDuration(MAX_RECORDING_MS)}</Text>
        </Text>
        <PressableScale onPress={stopRecording} accessibilityLabel="Stop and send">
          <LinearGradient colors={gradients.clay} style={styles.roundBtn}>
            <Ionicons name="arrow-up" size={21} color={colors.white} />
          </LinearGradient>
        </PressableScale>
      </Animated.View>
    );
  }
  if (mode === 'transcribing') {
    return (
      <Animated.View entering={FadeInUp.duration(240)} style={[styles.composer, styles.transcribing]}>
        <SoftDots />
        <Text style={styles.transcribingText}>Writing down what you said…</Text>
      </Animated.View>
    );
  }
  return (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        multiline
      />
      {draft.trim() ? (
        <PressableScale onPress={send} disabled={disabled} accessibilityLabel="Send" style={disabled && styles.disabled}>
          <LinearGradient colors={gradients.primary} style={styles.roundBtn}>
            <Ionicons name="arrow-up" size={21} color={colors.white} />
          </LinearGradient>
        </PressableScale>
      ) : (
        <PressableScale onPress={startRecording} disabled={disabled} accessibilityLabel="Speak your message" style={disabled && styles.disabled}>
          <View>
            {!disabled && <MicRings />}
            <LinearGradient colors={gradients.clay} style={styles.roundBtn}>
              <Ionicons name="mic" size={21} color={colors.white} />
            </LinearGradient>
          </View>
        </PressableScale>
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
  avatar: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%' },
  aiBubble: {
    flexShrink: 1,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  typing: { paddingVertical: 15, paddingHorizontal: 16 },
  aiText: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  userRow: { alignSelf: 'flex-end', maxWidth: '82%' },
  userBubble: { borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 11, paddingHorizontal: 14, ...shadow.soft },
  userText: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.ivory },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 6,
    paddingLeft: spacing.lg,
    borderWidth: 1,
    borderColor: '#F0ECE5',
    ...shadow.card,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.ink,
  },
  roundBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  ring: { borderRadius: 23, borderWidth: 2, borderColor: fields.stress.strong },
  disabled: { opacity: 0.45 },
  recording: { alignItems: 'center', backgroundColor: fields.stress.from, borderColor: fields.stress.to, paddingLeft: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, flex: 1, justifyContent: 'center' },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: fields.stress.strong },
  recText: { fontFamily: fontFamily.semibold, fontSize: 14, color: fields.stress.ink },
  recLimit: { fontFamily: fontFamily.regular, color: fields.stress.ink, opacity: 0.6 },
  transcribing: { alignItems: 'center', justifyContent: 'center', minHeight: 58, gap: 12 },
  transcribingText: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textMuted },
  crisis: { backgroundColor: '#FFF4EC', borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: '#F6D3BE' },
  crisisTitle: { fontFamily: fontFamily.bold, fontSize: 16, color: '#8A3A1A' },
  crisisBody: { fontFamily: fontFamily.regular, fontSize: 14, color: '#6E2E14', lineHeight: 20 },
  crisisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.clay,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  crisisBtnText: { fontFamily: fontFamily.semibold, color: colors.white, fontSize: 15 },
  crisisNote: { fontFamily: fontFamily.regular, fontSize: 12, color: '#8A3A1A', textAlign: 'center' },
});

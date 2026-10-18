import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar, Screen } from '@/components/ui';
import { exercises } from '@/data/content';
import { useAppStore } from '@/store/useAppStore';
import { colors, font, radii, spacing } from '@/theme';

type Status = 'ready' | 'running' | 'paused' | 'done';

export default function ExercisePlayer() {
  const { id, minutes: minutesParam } = useLocalSearchParams<{ id: string; minutes?: string }>();
  const router = useRouter();
  const addSession = useAppStore((s) => s.addSession);
  const exercise = exercises.find((e) => e.id === id) ?? exercises[0];
  const sessionMinutes = minutesParam ? Number(minutesParam) : exercise.minutes;
  const totalSeconds = sessionMinutes * 60;

  const [remaining, setRemaining] = useState(totalSeconds);
  const [status, setStatus] = useState<Status>('ready');
  const scale = useRef(new Animated.Value(1)).current;

  // Log the completed session once
  useEffect(() => {
    if (status === 'done') addSession(exercise.id, sessionMinutes);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          setStatus('done');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;

  return (
    <Screen scroll={false} contentStyle={styles.container}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.center}>
        {status === 'done' ? (
          <>
            <View style={[styles.doneCircle, { backgroundColor: exercise.tint }]}>
              <Ionicons name="checkmark" size={48} color={colors.white} />
            </View>
            <Text style={styles.doneTitle}>Nice work!</Text>
            <Text style={styles.doneSub}>You completed {exercise.title}.</Text>
          </>
        ) : (
          <>
            <Animated.View style={[styles.breatheCircle, { backgroundColor: exercise.tint, transform: [{ scale }] }]}>
              <Ionicons name={exercise.icon as any} size={40} color={colors.white} />
            </Animated.View>
            <Text style={styles.timer}>
              {mm}:{ss}
            </Text>
            <Text style={styles.exTitle}>{exercise.title}</Text>
            <Text style={styles.guidance}>{exercise.guidance}</Text>
          </>
        )}
      </View>

      <View style={styles.bottom}>
        {status !== 'done' && (
          <View style={{ marginBottom: spacing.lg }}>
            <ProgressBar progress={progress} color={exercise.tint} />
          </View>
        )}
        {status === 'ready' && (
          <Pressable style={[styles.mainBtn, { backgroundColor: exercise.tint }]} onPress={() => setStatus('running')}>
            <Ionicons name="play" size={18} color={colors.white} />
            <Text style={styles.mainBtnText}>Start</Text>
          </Pressable>
        )}
        {status === 'running' && (
          <Pressable style={[styles.mainBtn, { backgroundColor: exercise.tint }]} onPress={() => setStatus('paused')}>
            <Ionicons name="pause" size={18} color={colors.white} />
            <Text style={styles.mainBtnText}>Pause</Text>
          </Pressable>
        )}
        {status === 'paused' && (
          <Pressable style={[styles.mainBtn, { backgroundColor: exercise.tint }]} onPress={() => setStatus('running')}>
            <Ionicons name="play" size={18} color={colors.white} />
            <Text style={styles.mainBtnText}>Resume</Text>
          </Pressable>
        )}
        {status === 'done' && (
          <Pressable style={[styles.mainBtn, { backgroundColor: exercise.tint }]} onPress={() => router.back()}>
            <Text style={styles.mainBtnText}>Done</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row' },
  back: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  breatheCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  doneCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  timer: { fontSize: 40, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  exTitle: { ...font.h3, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
  guidance: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, lineHeight: 20 },
  doneTitle: { ...font.h2, color: colors.text },
  doneSub: { ...font.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  bottom: {},
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radii.pill,
  },
  mainBtnText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});

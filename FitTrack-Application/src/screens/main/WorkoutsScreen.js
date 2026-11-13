import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ExercisePickerModal from '../../components/ExercisePickerModal';
import RestTimerBar from '../../components/RestTimerBar';
import ScreenContainer from '../../components/ScreenContainer';
import WorkoutExerciseCard from '../../components/WorkoutExerciseCard';
import { ROUTES } from '../../constants/routes';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import {
    deleteSingleSessionSet,
    getSessionDetails,
    saveSessionSets,
    startWorkoutSession,
    updateSingleSessionSet,
    updateWorkoutSession,
} from '../../services/workoutService';
import { fetchPreviousSets } from '../../services/exercises';

const DEFAULT_STARTER_SETS = 3;
const DEFAULT_REST_SECONDS = 90;

const createEmptySetRow = (setNumber) => ({
    id: null,
    setNumber,
    weight: '',
    reps: '',
    isCompleted: false,
});

const formatElapsed = (startTimeIso, nowMs) => {
    if (!startTimeIso) return '00:00';
    const elapsedSec = Math.max(0, Math.floor((nowMs - new Date(startTimeIso).getTime()) / 1000));
    const hours = Math.floor(elapsedSec / 3600);
    const minutes = Math.floor((elapsedSec % 3600) / 60);
    const seconds = elapsedSec % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const buildExerciseEntriesFromSession = (sessionData) => {
    if (!sessionData) return [];

    const entryMap = new Map();

    const routineExercises = sessionData.routine?.routineExercises || [];
    for (const routineItem of routineExercises) {
        const count = routineItem.targetSets || DEFAULT_STARTER_SETS;
        entryMap.set(routineItem.exerciseId, {
            exerciseId: routineItem.exerciseId,
            exercise: routineItem.exercise || { id: routineItem.exerciseId, name: 'Exercise' },
            targetSets: routineItem.targetSets || null,
            targetReps: routineItem.targetReps || null,
            restSeconds: routineItem.restSeconds || DEFAULT_REST_SECONDS,
            sets: Array.from({ length: count }, (_, index) => createEmptySetRow(index + 1)),
        });
    }

    const setLogs = sessionData.setLogs || [];
    const loggedByExercise = new Map();

    for (const log of setLogs) {
        if (!loggedByExercise.has(log.exerciseId)) {
            loggedByExercise.set(log.exerciseId, {
                exercise: log.exercise,
                logs: [],
            });
        }
        loggedByExercise.get(log.exerciseId).logs.push(log);
    }

    for (const [exerciseId, group] of loggedByExercise.entries()) {
        const sortedLogs = [...group.logs].sort((a, b) => a.setNumber - b.setNumber);
        const mappedLogs = sortedLogs.map((log, index) => ({
            id: log.id,
            setNumber: index + 1,
            weight: String(log.weight ?? ''),
            reps: String(log.reps ?? ''),
            isCompleted: log.isCompleted ?? true,
        }));

        if (entryMap.has(exerciseId)) {
            const existing = entryMap.get(exerciseId);
            const targetCount = existing.targetSets || DEFAULT_STARTER_SETS;
            const mergedSets = [...mappedLogs];

            while (mergedSets.length < targetCount) {
                mergedSets.push(createEmptySetRow(mergedSets.length + 1));
            }

            existing.sets = mergedSets;
        } else {
            entryMap.set(exerciseId, {
                exerciseId,
                exercise: group.exercise || { id: exerciseId, name: 'Exercise' },
                targetSets: null,
                targetReps: null,
                restSeconds: DEFAULT_REST_SECONDS,
                sets: mappedLogs,
            });
        }
    }

    return Array.from(entryMap.values());
};

const parseNumericField = (text, integerOnly = false) => {
    const trimmed = String(text ?? '').trim();
    if (trimmed === '') return { empty: true, value: 0, valid: true };
    const value = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
        return { empty: false, value: NaN, valid: false };
    }
    if (integerOnly && !Number.isInteger(value)) {
        return { empty: false, value: NaN, valid: false };
    }
    return { empty: false, value, valid: true };
};

export default function WorkoutsScreen({ navigation, route }) {
    const { user } = useAuth();
    const incomingSession = route?.params?.session ?? null;

    const [session, setSession] = useState(incomingSession);
    const [exerciseEntries, setExerciseEntries] = useState(() =>
        buildExerciseEntriesFromSession(incomingSession)
    );
    const [completedSummary, setCompletedSummary] = useState(null);
    const [loadingSession, setLoadingSession] = useState(false);
    const [startingWorkout, setStartingWorkout] = useState(false);
    const [savingSets, setSavingSets] = useState(false);
    const [finishingWorkout, setFinishingWorkout] = useState(false);
    const [cancellingWorkout, setCancellingWorkout] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [restTimer, setRestTimer] = useState({
        visible: false,
        secondsLeft: DEFAULT_REST_SECONDS,
        totalSeconds: DEFAULT_REST_SECONDS,
        running: false,
    });

    const [previousSetsByExercise, setPreviousSetsByExercise] = useState({});

    const exerciseIdsKey = useMemo(
        () => exerciseEntries.map((entry) => entry.exerciseId).sort().join(','),
        [exerciseEntries]
    );

    // Load "previous" performance for every exercise in the workout (one request per change of exercise list).
    useEffect(() => {
        if (!exerciseIdsKey) return undefined;
        let cancelled = false;
        const realSessionId =
            session?.id && !String(session.id).startsWith('local-') ? session.id : undefined;

        fetchPreviousSets(exerciseIdsKey.split(','), { excludeSessionId: realSessionId })
            .then((data) => {
                if (!cancelled) setPreviousSetsByExercise(data);
            })
            .catch(() => {
                // Previous data is a nice-to-have; never block the logger on it.
            });

        return () => {
            cancelled = true;
        };
    }, [exerciseIdsKey, session?.id]);

    const isLocalDraft = Boolean(session?.id && String(session.id).startsWith('local-'));

    const hydrateSession = useCallback(async (targetSession) => {
        setCompletedSummary(null);
        setSession(targetSession);
        setExerciseEntries(buildExerciseEntriesFromSession(targetSession));
        setError(null);
        setStatusMessage(null);
        setRestTimer({
            visible: false,
            secondsLeft: DEFAULT_REST_SECONDS,
            totalSeconds: DEFAULT_REST_SECONDS,
            running: false,
        });

        if (!targetSession?.id || String(targetSession.id).startsWith('local-')) {
            return;
        }

        setLoadingSession(true);
        try {
            const fullSession = await getSessionDetails(targetSession.id);
            setSession(fullSession);
            setExerciseEntries(buildExerciseEntriesFromSession(fullSession));
        } catch (_err) {
            setError('Showing cached workout data — backend unavailable.');
        } finally {
            setLoadingSession(false);
        }
    }, []);

    useEffect(() => {
        if (incomingSession && incomingSession.id !== session?.id) {
            hydrateSession(incomingSession);
        }
    }, [incomingSession, session?.id, hydrateSession]);

    useEffect(() => {
        if (!session || session.status !== 'IN_PROGRESS') return undefined;
        setNowMs(Date.now());
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [session]);

    useEffect(() => {
        if (!restTimer.visible || !restTimer.running || restTimer.secondsLeft <= 0) {
            return undefined;
        }
        const interval = setInterval(() => {
            setRestTimer((prev) => {
                if (!prev.running || prev.secondsLeft <= 1) {
                    return { ...prev, secondsLeft: 0, running: false };
                }
                return { ...prev, secondsLeft: prev.secondsLeft - 1 };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [restTimer.visible, restTimer.running, restTimer.secondsLeft]);

    const startRestCountdown = useCallback((durationSeconds = DEFAULT_REST_SECONDS) => {
        const duration = Math.max(15, durationSeconds);
        setRestTimer({
            visible: true,
            secondsLeft: duration,
            totalSeconds: duration,
            running: true,
        });
    }, []);

    const handleAdjustRest = (delta) => {
        setRestTimer((prev) => {
            const nextLeft = Math.max(0, prev.secondsLeft + delta);
            const nextTotal = Math.max(prev.totalSeconds, nextLeft);
            return {
                ...prev,
                secondsLeft: nextLeft,
                totalSeconds: nextTotal,
                running: nextLeft > 0 ? prev.running : false,
            };
        });
    };

    const handleToggleRestPause = () => {
        setRestTimer((prev) => ({
            ...prev,
            running: prev.secondsLeft > 0 ? !prev.running : false,
        }));
    };

    const handleSkipRest = () => {
        setRestTimer((prev) => ({
            ...prev,
            visible: false,
            running: false,
        }));
    };

    const handleStartFreestyle = async () => {
        setStartingWorkout(true);
        setError(null);
        setCompletedSummary(null);
        try {
            const created = await startWorkoutSession({
                userId: user?.id || 'demo-user-id',
                name: 'Freestyle Workout',
            });
            await hydrateSession(created);
        } catch (_err) {
            const draft = {
                id: `local-${Date.now()}`,
                userId: user?.id || 'demo-user-id',
                routineId: null,
                name: 'Freestyle Workout',
                startTime: new Date().toISOString(),
                status: 'IN_PROGRESS',
                totalVolumeKg: 0,
                setLogs: [],
            };
            await hydrateSession(draft);
            setError('Started offline draft — connect to backend to sync sets.');
        } finally {
            setStartingWorkout(false);
        }
    };

    const handleSelectExercise = (exercise) => {
        setStatusMessage(null);
        setError(null);
        setExerciseEntries((prev) => {
            if (prev.some((item) => item.exerciseId === exercise.id)) {
                return prev;
            }
            return [
                ...prev,
                {
                    exerciseId: exercise.id,
                    exercise,
                    targetSets: null,
                    targetReps: null,
                    restSeconds: DEFAULT_REST_SECONDS,
                    sets: Array.from({ length: DEFAULT_STARTER_SETS }, (_, index) =>
                        createEmptySetRow(index + 1)
                    ),
                },
            ];
        });
    };

    const handleRemoveExercise = (exerciseId) => {
        setStatusMessage(null);
        setExerciseEntries((prev) => prev.filter((item) => item.exerciseId !== exerciseId));
    };

    const handleChangeSetField = (exerciseId, setNumber, field, value) => {
        setStatusMessage(null);
        setExerciseEntries((prev) =>
            prev.map((entry) => {
                if (entry.exerciseId !== exerciseId) return entry;
                return {
                    ...entry,
                    sets: entry.sets.map((row) =>
                        row.setNumber === setNumber ? { ...row, [field]: value } : row
                    ),
                };
            })
        );
    };

    const handleAddSet = (exerciseId) => {
        setStatusMessage(null);
        setExerciseEntries((prev) =>
            prev.map((entry) => {
                if (entry.exerciseId !== exerciseId) return entry;
                const previousRow = entry.sets[entry.sets.length - 1];
                const nextSetNumber = entry.sets.length + 1;
                return {
                    ...entry,
                    sets: [
                        ...entry.sets,
                        {
                            id: null,
                            setNumber: nextSetNumber,
                            weight: previousRow ? previousRow.weight : '',
                            reps: previousRow ? previousRow.reps : '',
                            isCompleted: false,
                        },
                    ],
                };
            })
        );
    };

    const handleRemoveSet = async (exerciseId, setNumber) => {
        setStatusMessage(null);
        setError(null);

        const targetEntry = exerciseEntries.find((item) => item.exerciseId === exerciseId);
        const targetRow = targetEntry?.sets.find((row) => row.setNumber === setNumber);

        setExerciseEntries((prev) =>
            prev.map((entry) => {
                if (entry.exerciseId !== exerciseId) return entry;
                const remaining = entry.sets
                    .filter((row) => row.setNumber !== setNumber)
                    .map((row, index) => ({ ...row, setNumber: index + 1 }));
                return { ...entry, sets: remaining };
            })
        );

        if (targetRow?.id && session?.id && !isLocalDraft) {
            try {
                const res = await deleteSingleSessionSet(session.id, targetRow.id);
                setSession((prev) =>
                    prev ? { ...prev, totalVolumeKg: res.totalVolumeKg } : prev
                );
            } catch (err) {
                setError(err.message || 'Could not delete set on server');
            }
        }
    };

    const handleToggleSetComplete = async (exerciseId, setNumber) => {
        setStatusMessage(null);
        setError(null);

        const targetEntry = exerciseEntries.find((item) => item.exerciseId === exerciseId);
        const targetRow = targetEntry?.sets.find((row) => row.setNumber === setNumber);
        if (!targetRow) return;

        const nextCompleted = !targetRow.isCompleted;
        const parsedWeight = parseNumericField(targetRow.weight, false);
        const parsedReps = parseNumericField(targetRow.reps, true);

        if (nextCompleted && (!parsedWeight.valid || !parsedReps.valid)) {
            setError(
                `${targetEntry.exercise?.name || 'Exercise'} Set ${setNumber}: enter valid weight and whole-number reps.`
            );
            return;
        }

        setExerciseEntries((prev) =>
            prev.map((entry) => {
                if (entry.exerciseId !== exerciseId) return entry;
                return {
                    ...entry,
                    sets: entry.sets.map((row) =>
                        row.setNumber === setNumber ? { ...row, isCompleted: nextCompleted } : row
                    ),
                };
            })
        );

        if (nextCompleted) {
            startRestCountdown(targetEntry.restSeconds || DEFAULT_REST_SECONDS);
        }

        if (targetRow.id && session?.id && !isLocalDraft && parsedWeight.valid && parsedReps.valid) {
            try {
                const res = await updateSingleSessionSet(session.id, targetRow.id, {
                    weight: parsedWeight.value,
                    reps: parsedReps.value,
                    isCompleted: nextCompleted,
                });
                setSession((prev) =>
                    prev ? { ...prev, totalVolumeKg: res.totalVolumeKg } : prev
                );
            } catch (err) {
                setError(err.message || 'Set updated locally; server sync failed.');
            }
        }
    };

    const totals = useMemo(() => {
        let completedSets = 0;
        let totalSets = 0;
        let volumeKg = 0;

        for (const entry of exerciseEntries) {
            for (const row of entry.sets) {
                totalSets += 1;
                if (!row.isCompleted) continue;
                completedSets += 1;
                const w = parseNumericField(row.weight, false);
                const r = parseNumericField(row.reps, true);
                if (w.valid && r.valid) {
                    volumeKg += w.value * r.value;
                }
            }
        }

        return {
            exercisesCount: exerciseEntries.length,
            completedSets,
            totalSets,
            volumeKg: Math.round(volumeKg * 100) / 100,
        };
    }, [exerciseEntries]);

    const buildValidatedSetPayload = () => {
        const payload = [];
        for (const entry of exerciseEntries) {
            for (const row of entry.sets) {
                const parsedWeight = parseNumericField(row.weight, false);
                const parsedReps = parseNumericField(row.reps, true);
                const isUntouched =
                    parsedWeight.empty && parsedReps.empty && !row.isCompleted && !row.id;

                if (isUntouched) continue;

                if (!parsedWeight.valid) {
                    setError(
                        `${entry.exercise?.name || 'Exercise'} Set ${row.setNumber}: enter a valid weight.`
                    );
                    return null;
                }

                if (!parsedReps.valid) {
                    setError(
                        `${entry.exercise?.name || 'Exercise'} Set ${row.setNumber}: reps must be a whole number.`
                    );
                    return null;
                }

                payload.push({
                    ...(row.id ? { id: row.id } : {}),
                    exerciseId: entry.exerciseId,
                    setNumber: row.setNumber,
                    weight: parsedWeight.value,
                    reps: parsedReps.value,
                    isCompleted: Boolean(row.isCompleted),
                });
            }
        }
        return payload;
    };

    const syncSetsWithServer = async (payload, replace = true) => {
        const saved = await saveSessionSets(session.id, payload, replace);
        setSession((prev) =>
            prev
                ? {
                      ...prev,
                      totalVolumeKg: saved.totalVolumeKg,
                      setLogs: saved.setLogs,
                  }
                : prev
        );

        const returnedByKey = new Map(
            (saved.setLogs || []).map((item) => [`${item.exerciseId}:${item.setNumber}`, item])
        );

        setExerciseEntries((prev) =>
            prev.map((entry) => ({
                ...entry,
                sets: entry.sets.map((row) => {
                    const match = returnedByKey.get(`${entry.exerciseId}:${row.setNumber}`);
                    if (!match) return { ...row, id: null };
                    return {
                        ...row,
                        id: match.id,
                        weight: String(match.weight),
                        reps: String(match.reps),
                        isCompleted: match.isCompleted,
                    };
                }),
            }))
        );

        return saved;
    };

    const handleSaveSets = async () => {
        if (!session) return;
        setError(null);
        setStatusMessage(null);

        const payload = buildValidatedSetPayload();
        if (!payload) return;

        if (payload.length === 0) {
            setError('Log or check off at least one set before saving.');
            return;
        }

        if (isLocalDraft) {
            setSession((prev) => ({ ...prev, totalVolumeKg: totals.volumeKg }));
            setStatusMessage('Saved locally (offline draft).');
            return;
        }

        setSavingSets(true);
        try {
            const saved = await syncSetsWithServer(payload, true);
            setStatusMessage(`Saved ${saved.setLogs?.length || payload.length} sets.`);
        } catch (err) {
            setError(err.message || 'Failed to save sets');
        } finally {
            setSavingSets(false);
        }
    };

    const handleFinishWorkout = async () => {
        if (!session) return;
        setError(null);
        setStatusMessage(null);

        const payload = buildValidatedSetPayload();
        if (!payload) return;

        setFinishingWorkout(true);
        try {
            let finalVolume = totals.volumeKg;

            if (!isLocalDraft) {
                if (payload.length > 0) {
                    const saved = await syncSetsWithServer(payload, true);
                    finalVolume = saved.totalVolumeKg;
                }

                await updateWorkoutSession(session.id, {
                    status: 'COMPLETED',
                    totalVolumeKg: finalVolume,
                });
            }

            setRestTimer((prev) => ({ ...prev, visible: false, running: false }));
            setCompletedSummary({
                name: session.name,
                duration: formatElapsed(session.startTime, Date.now()),
                completedSets: totals.completedSets,
                volumeKg: finalVolume,
            });
            setSession(null);
            setExerciseEntries([]);
        } catch (err) {
            setError(err.message || 'Could not complete workout');
        } finally {
            setFinishingWorkout(false);
        }
    };

    const performCancelWorkout = async () => {
        if (!session) return;
        setCancellingWorkout(true);
        setError(null);
        try {
            if (!isLocalDraft) {
                await updateWorkoutSession(session.id, { status: 'CANCELLED' });
            }
            setRestTimer((prev) => ({ ...prev, visible: false, running: false }));
            setSession(null);
            setExerciseEntries([]);
            navigation?.navigate(ROUTES.HOME);
        } catch (err) {
            setError(err.message || 'Could not cancel workout');
        } finally {
            setCancellingWorkout(false);
        }
    };

    const handleCancelWorkout = () => {
        if (Platform.OS === 'web') {
            performCancelWorkout();
            return;
        }
        Alert.alert(
            'Cancel Workout?',
            'This will mark the active workout as cancelled.',
            [
                { text: 'Keep Training', style: 'cancel' },
                { text: 'Cancel Workout', style: 'destructive', onPress: performCancelWorkout },
            ]
        );
    };

    if (completedSummary) {
        return (
            <ScreenContainer>
                <View style={styles.emptyWrapper}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="trophy-outline" size={32} color={colors.success} />
                    </View>
                    <Text style={styles.emptyTitle}>Workout Completed</Text>
                    <Text style={styles.emptySubtitle}>{completedSummary.name}</Text>

                    <Card style={styles.summaryCard}>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{completedSummary.duration}</Text>
                                <Text style={styles.statLabel}>Duration</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{completedSummary.completedSets}</Text>
                                <Text style={styles.statLabel}>Done Sets</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{completedSummary.volumeKg} kg</Text>
                                <Text style={styles.statLabel}>Volume</Text>
                            </View>
                        </View>
                    </Card>

                    <Button
                        title="Back to Home"
                        onPress={() => {
                            setCompletedSummary(null);
                            navigation?.navigate(ROUTES.HOME);
                        }}
                        style={styles.emptyButton}
                    />
                    <Button
                        title="Start Another Workout"
                        variant="outline"
                        onPress={handleStartFreestyle}
                        loading={startingWorkout}
                        style={styles.emptyButton}
                    />
                </View>
            </ScreenContainer>
        );
    }

    if (!session) {
        return (
            <ScreenContainer>
                <View style={styles.emptyWrapper}>
                    <View style={styles.emptyIconCircle}>
                        <Ionicons name="barbell-outline" size={32} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Active Workout Logger</Text>
                    <Text style={styles.emptySubtitle}>
                        Start a freestyle workout here or pick a saved routine from the Home tab.
                    </Text>
                    <Button
                        title="Start Empty Workout"
                        onPress={handleStartFreestyle}
                        loading={startingWorkout}
                        style={styles.emptyButton}
                    />
                </View>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerCard}>
                        <View style={styles.headerTop}>
                            <View style={styles.headerTitleWrap}>
                                <View style={styles.badgeRow}>
                                    <View style={styles.statusBadge}>
                                        <Text style={styles.statusText}>IN PROGRESS</Text>
                                    </View>
                                    <Text style={styles.elapsedText}>
                                        {formatElapsed(session.startTime, nowMs)}
                                    </Text>
                                </View>
                                <Text style={styles.workoutTitle}>{session.name}</Text>
                            </View>

                            <Pressable
                                onPress={() => startRestCountdown(DEFAULT_REST_SECONDS)}
                                accessibilityRole="button"
                                style={({ pressed }) => [
                                    styles.timerTrigger,
                                    pressed && { opacity: 0.75 },
                                ]}
                            >
                                <Ionicons name="timer-outline" size={16} color={colors.primary} />
                                <Text style={styles.timerTriggerText}>Rest</Text>
                            </Pressable>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{totals.exercisesCount}</Text>
                                <Text style={styles.statLabel}>Exercises</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {totals.completedSets}/{totals.totalSets}
                                </Text>
                                <Text style={styles.statLabel}>Done Sets</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{totals.volumeKg} kg</Text>
                                <Text style={styles.statLabel}>Volume</Text>
                            </View>
                        </View>
                    </View>

                    {restTimer.visible ? (
                        <RestTimerBar
                            secondsLeft={restTimer.secondsLeft}
                            totalSeconds={restTimer.totalSeconds}
                            isRunning={restTimer.running}
                            onAdjust={handleAdjustRest}
                            onTogglePause={handleToggleRestPause}
                            onSkip={handleSkipRest}
                        />
                    ) : null}

                    {loadingSession ? (
                        <ActivityIndicator style={styles.loader} color={colors.primary} />
                    ) : null}

                    {error ? (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {statusMessage ? (
                        <View style={styles.successBanner}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                            <Text style={styles.successText}>{statusMessage}</Text>
                        </View>
                    ) : null}

                    {exerciseEntries.length === 0 ? (
                        <Card style={styles.promptCard}>
                            <Text style={styles.promptTitle}>No exercises added yet</Text>
                            <Text style={styles.promptSubtitle}>
                                Add exercises from the library to start logging sets and reps.
                            </Text>
                            <Button
                                title="+ Add Exercise"
                                variant="outline"
                                onPress={() => setPickerVisible(true)}
                            />
                        </Card>
                    ) : (
                        exerciseEntries.map((entry) => (
                            <WorkoutExerciseCard
                                key={entry.exerciseId}
                                entry={entry}
                                previous={previousSetsByExercise[entry.exerciseId]}
                                onChangeSetField={handleChangeSetField}
                                onToggleSetComplete={handleToggleSetComplete}
                                onAddSet={handleAddSet}
                                onRemoveSet={handleRemoveSet}
                                onRemoveExercise={handleRemoveExercise}
                            />
                        ))
                    )}

                    <View style={styles.actions}>
                        {exerciseEntries.length > 0 ? (
                            <>
                                <Button
                                    title="+ Add Exercise"
                                    variant="outline"
                                    onPress={() => setPickerVisible(true)}
                                />
                                <Button
                                    title="Save Logged Sets"
                                    variant="secondary"
                                    onPress={handleSaveSets}
                                    loading={savingSets}
                                />
                                <Button
                                    title="Finish Workout"
                                    onPress={handleFinishWorkout}
                                    loading={finishingWorkout}
                                />
                            </>
                        ) : null}

                        <Button
                            title="Cancel Workout"
                            variant="danger"
                            onPress={handleCancelWorkout}
                            loading={cancellingWorkout}
                        />
                    </View>
                </ScrollView>

                <ExercisePickerModal
                    visible={pickerVisible}
                    selectedExerciseIds={exerciseEntries.map((item) => item.exerciseId)}
                    onClose={() => setPickerVisible(false)}
                    onSelectExercise={handleSelectExercise}
                />
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
    },
    emptyWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: radius.pill,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h2,
        textAlign: 'center',
    },
    emptySubtitle: {
        ...typography.caption,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    summaryCard: {
        width: '100%',
        marginBottom: spacing.md,
    },
    emptyButton: {
        width: '100%',
    },
    headerCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitleWrap: {
        flex: 1,
        marginRight: spacing.sm,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    statusBadge: {
        backgroundColor: colors.primaryLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primaryDark,
        letterSpacing: 0.4,
    },
    elapsedText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    workoutTitle: {
        ...typography.h2,
    },
    timerTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.pill,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timerTriggerText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    statLabel: {
        ...typography.caption,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
    },
    loader: {
        marginBottom: spacing.md,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: colors.error,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: radius.md,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    successText: {
        flex: 1,
        fontSize: 13,
        color: colors.success,
        fontWeight: '500',
    },
    promptCard: {
        alignItems: 'center',
    },
    promptTitle: {
        ...typography.h3,
        marginBottom: spacing.xs,
    },
    promptSubtitle: {
        ...typography.caption,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    actions: {
        marginTop: spacing.xs,
    },
});

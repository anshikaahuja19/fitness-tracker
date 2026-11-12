import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import { ROUTES } from '../../constants/routes';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getSessionDetails, getWorkoutHistory } from '../../services/workoutService';
import { formatEnum } from '../../utils/format';

const formatHistoryDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (diffMs <= 0) return null;
    const minutes = Math.round(diffMs / 60000);
    return `${minutes} min`;
};

const groupExercisesFromSetLogs = (setLogs = []) => {
    const grouped = new Map();

    for (const log of setLogs) {
        if (log.isCompleted === false) continue;
        const key = log.exerciseId;
        if (!grouped.has(key)) {
            grouped.set(key, {
                exerciseId: key,
                name: log.exercise?.name || 'Exercise',
                primaryMuscle: log.exercise?.primaryMuscle || null,
                sets: [],
            });
        }
        grouped.get(key).sets.push(log);
    }

    return Array.from(grouped.values()).map((entry) => ({
        ...entry,
        sets: [...entry.sets].sort((a, b) => a.setNumber - b.setNumber),
    }));
};

function HistorySessionCard({ session, expanded, loadingDetails, onToggle }) {
    const duration = formatDuration(session.startTime, session.endTime);
    const exerciseGroups = useMemo(
        () => groupExercisesFromSetLogs(session.setLogs || []),
        [session.setLogs]
    );
    const totalCompletedSets = exerciseGroups.reduce((sum, item) => sum + item.sets.length, 0);
    const fallbackCount = session._count?.setLogs ?? 0;
    const displaySetCount = totalCompletedSets || fallbackCount;

    return (
        <Card onPress={onToggle} style={styles.sessionCard}>
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.sessionName}>{session.name}</Text>
                    <Text style={styles.sessionMeta}>
                        {formatHistoryDate(session.startTime)}
                        {duration ? ` • ${duration}` : ''}
                    </Text>
                </View>

                <View style={styles.headerRight}>
                    <View style={styles.volumeBadge}>
                        <Text style={styles.volumeText}>
                            {Math.round(session.totalVolumeKg || 0)} kg
                        </Text>
                    </View>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                    />
                </View>
            </View>

            <View style={styles.exercisesSummary}>
                {exerciseGroups.length > 0 ? (
                    exerciseGroups.map((group) => (
                        <View key={group.exerciseId} style={styles.exerciseLine}>
                            <Text style={styles.exerciseName}>{group.name}</Text>
                            <Text style={styles.exerciseSetCount}>
                                {group.sets.length} {group.sets.length === 1 ? 'set' : 'sets'}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noSetsText}>
                        {displaySetCount > 0
                            ? `${displaySetCount} logged sets`
                            : 'No completed sets logged'}
                    </Text>
                )}
            </View>

            {expanded ? (
                <View style={styles.detailsSection}>
                    {loadingDetails ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : exerciseGroups.length === 0 ? (
                        <Text style={styles.noSetsText}>No set details recorded.</Text>
                    ) : (
                        exerciseGroups.map((group) => (
                            <View key={group.exerciseId} style={styles.detailGroup}>
                                <View style={styles.detailGroupHeader}>
                                    <Text style={styles.detailGroupTitle}>{group.name}</Text>
                                    {group.primaryMuscle ? (
                                        <Text style={styles.detailMuscle}>
                                            {formatEnum(group.primaryMuscle)}
                                        </Text>
                                    ) : null}
                                </View>
                                {group.sets.map((setItem, index) => (
                                    <View
                                        key={setItem.id || `${group.exerciseId}-${index}`}
                                        style={styles.detailSetRow}
                                    >
                                        <Text style={styles.detailSetLabel}>
                                            Set {setItem.setNumber}
                                        </Text>
                                        <Text style={styles.detailSetValue}>
                                            {setItem.weight} kg × {setItem.reps} reps
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))
                    )}
                </View>
            ) : null}
        </Card>
    );
}

export default function WorkoutHistoryScreen({ navigation, route }) {
    const { user } = useAuth();
    const initialSessionId = route?.params?.initialSessionId ?? null;

    const [sessions, setSessions] = useState([]);
    const [expandedId, setExpandedId] = useState(initialSessionId);
    const [loadingDetailId, setLoadingDetailId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadHistory = useCallback(
        async (isRefresh = false) => {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError(null);
            try {
                const items = await getWorkoutHistory(user.id, {
                    status: 'COMPLETED',
                    limit: 50,
                });
                setSessions(items);
            } catch (err) {
                setError(err.message || 'Could not load workout history');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [user?.id]
    );

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleToggleExpand = async (session) => {
        if (expandedId === session.id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(session.id);

        if (!session.setLogs) {
            setLoadingDetailId(session.id);
            try {
                const detailed = await getSessionDetails(session.id);
                setSessions((prev) =>
                    prev.map((item) => (item.id === session.id ? detailed : item))
                );
            } catch (_err) {
            } finally {
                setLoadingDetailId(null);
            }
        }
    };

    const totals = useMemo(() => {
        const totalVolumeKg = sessions.reduce(
            (sum, item) => sum + (Number(item.totalVolumeKg) || 0),
            0
        );
        return {
            workouts: sessions.length,
            totalVolumeKg: Math.round(totalVolumeKg),
        };
    }, [sessions]);

    return (
        <ScreenContainer>
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={styles.screenTitle}>Workout History</Text>
                <View style={styles.topBarSpacer} />
            </View>

            <View style={styles.summaryBar}>
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{totals.workouts}</Text>
                    <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{totals.totalVolumeKg} kg</Text>
                    <Text style={styles.summaryLabel}>Total Volume</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : error ? (
                <Card style={styles.stateCard}>
                    <Ionicons name="cloud-offline-outline" size={28} color={colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <Button
                        title="Retry"
                        variant="outline"
                        size="sm"
                        onPress={() => loadHistory()}
                    />
                </Card>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadHistory(true)}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <Card style={styles.stateCard}>
                            <Ionicons name="barbell-outline" size={30} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Finish a workout in the logger to see your history and volume here.
                            </Text>
                            <Button
                                title="Go to Workouts"
                                size="sm"
                                onPress={() =>
                                    navigation.navigate(ROUTES.MAIN_TABS, {
                                        screen: ROUTES.WORKOUTS,
                                    })
                                }
                            />
                        </Card>
                    }
                    renderItem={({ item }) => (
                        <HistorySessionCard
                            session={item}
                            expanded={expandedId === item.id}
                            loadingDetails={loadingDetailId === item.id}
                            onToggle={() => handleToggleExpand(item)}
                        />
                    )}
                />
            )}
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    screenTitle: {
        ...typography.h2,
    },
    topBarSpacer: {
        width: 36,
    },
    summaryBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
    },
    summaryStat: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    summaryLabel: {
        ...typography.caption,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
    },
    loader: {
        marginTop: spacing.xl,
    },
    listContent: {
        paddingBottom: spacing.xl,
    },
    sessionCard: {
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardTitleWrap: {
        flex: 1,
        marginRight: spacing.sm,
    },
    sessionName: {
        ...typography.h3,
    },
    sessionMeta: {
        ...typography.caption,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    volumeBadge: {
        backgroundColor: colors.primaryLight,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 4,
    },
    volumeText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.primaryDark,
    },
    exercisesSummary: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 4,
    },
    exerciseLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        flex: 1,
        marginRight: spacing.sm,
    },
    exerciseSetCount: {
        fontSize: 13,
        color: colors.textMuted,
    },
    noSetsText: {
        ...typography.caption,
    },
    detailsSection: {
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing.sm,
    },
    detailGroup: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    detailGroupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    detailGroupTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    detailMuscle: {
        fontSize: 12,
        color: colors.textMuted,
    },
    detailSetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    detailSetLabel: {
        fontSize: 13,
        color: colors.textMuted,
    },
    detailSetValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    stateCard: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        gap: spacing.sm,
    },
    errorText: {
        color: colors.error,
        textAlign: 'center',
    },
    emptyTitle: {
        ...typography.h3,
        textAlign: 'center',
    },
    emptySubtitle: {
        ...typography.caption,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
});


import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import { colors, radius, spacing } from '../../constants/theme';
import {
    getRecentSessions,
    getUserRoutines,
    startWorkoutSession,
} from '../../services/workoutService';

const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (diffMs <= 0) return null;
    const minutes = Math.round(diffMs / 60000);
    return `${minutes} min`;
};

const STATUS_LABELS = {
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const [routines, setRoutines] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [startingTarget, setStartingTarget] = useState(null);
    const [offlineNotice, setOfflineNotice] = useState(false);

    const displayName = user?.name || user?.email?.split('@')[0] || 'Athlete';
    const activeSession = recentSessions.find((session) => session.status === 'IN_PROGRESS');

    const loadDashboard = useCallback(
        async (showRefreshSpinner = false) => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            if (showRefreshSpinner) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }

            try {
                const [routineList, sessionList] = await Promise.all([
                    getUserRoutines(user.id),
                    getRecentSessions(user.id, 5),
                ]);
                setRoutines(routineList);
                setRecentSessions(sessionList);
                setOfflineNotice(false);
            } catch (_error) {
                setOfflineNotice(true);
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [user?.id]
    );

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    // Refresh when coming back from the Routine Builder (or any pushed screen).
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => loadDashboard());
        return unsubscribe;
    }, [navigation, loadDashboard]);

    const openRoutineBuilder = (routineId) =>
        navigation.navigate(ROUTES.ROUTINE_BUILDER, routineId ? { routineId } : undefined);

    const handleStartWorkout = async (routine = null) => {
        const targetKey = routine ? routine.id : 'freestyle';
        setStartingTarget(targetKey);

        try {
            const session = await startWorkoutSession({
                userId: user?.id || 'demo-user-id',
                routineId: routine?.id,
                name: routine?.name || 'Freestyle Workout',
            });
            setRecentSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
            navigation.navigate(ROUTES.WORKOUTS, { session });
        } catch (_error) {
            const draftSession = {
                id: `local-${Date.now()}`,
                userId: user?.id || 'demo-user-id',
                routineId: routine?.id || null,
                name: routine?.name || 'Freestyle Workout',
                startTime: new Date().toISOString(),
                status: 'IN_PROGRESS',
                totalVolumeKg: 0,
                routine: routine || null,
            };
            navigation.navigate(ROUTES.WORKOUTS, { session: draftSession });
        } finally {
            setStartingTarget(null);
        }
    };

    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });

    return (
        <ScreenContainer>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadDashboard(true)}
                        tintColor={colors.primary}
                    />
                }
            >
                <View style={styles.header}>
                    <View style={styles.headerTitleWrap}>
                        <Text style={styles.dateText}>{todayLabel}</Text>
                        <Text style={styles.title}>Hey, {displayName}</Text>
                    </View>
                    <Pressable
                        style={({ pressed }) => [styles.analyticsIconBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => navigation.navigate(ROUTES.ANALYTICS)}
                    >
                        <Ionicons name="stats-chart" size={16} color={colors.primary} />
                        <Text style={styles.analyticsIconBtnText}>Charts</Text>
                    </Pressable>
                </View>

                {offlineNotice && (
                    <View style={styles.noticeBanner}>
                        <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.noticeText}>
                            Backend offline — pull down to retry once the server is running.
                        </Text>
                    </View>
                )}

                {activeSession && (
                    <Pressable
                        style={styles.activeBanner}
                        onPress={() => navigation.navigate(ROUTES.WORKOUTS, { session: activeSession })}
                    >
                        <View style={styles.activeBannerText}>
                            <Text style={styles.activeLabel}>WORKOUT IN PROGRESS</Text>
                            <Text style={styles.activeName}>{activeSession.name}</Text>
                        </View>
                        <View style={styles.resumePill}>
                            <Text style={styles.resumePillText}>Resume</Text>
                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                        </View>
                    </Pressable>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Start</Text>
                    <Button
                        title={
                            startingTarget === 'freestyle'
                                ? 'Starting Workout...'
                                : 'Start Empty Workout'
                        }
                        onPress={() => handleStartWorkout(null)}
                    />
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Routines</Text>
                        <Pressable
                            style={styles.newRoutineButton}
                            onPress={() => openRoutineBuilder()}
                            hitSlop={8}
                        >
                            <Ionicons name="add" size={16} color={colors.primary} />
                            <Text style={styles.newRoutineText}>New</Text>
                        </Pressable>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={styles.loader}
                        />
                    ) : routines.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="barbell-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No routines yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Build a routine template to start workouts in one tap.
                            </Text>
                            <Button
                                title="Create Routine"
                                variant="outline"
                                size="sm"
                                onPress={() => openRoutineBuilder()}
                            />
                        </View>
                    ) : (
                        routines.map((routine) => {
                            const exerciseCount =
                                routine._count?.routineExercises ??
                                routine.routineExercises?.length ??
                                0;
                            const isStarting = startingTarget === routine.id;

                            return (
                                <View key={routine.id} style={styles.card}>
                                    <Pressable
                                        style={styles.cardInfo}
                                        disabled={routine.userId !== user?.id}
                                        onPress={() => openRoutineBuilder(routine.id)}
                                    >
                                        <Text style={styles.cardTitle}>{routine.name}</Text>
                                        <Text style={styles.cardSubtitle}>
                                            {exerciseCount}{' '}
                                            {exerciseCount === 1 ? 'exercise' : 'exercises'}
                                            {routine.userId === user?.id ? ' • Tap to edit' : ''}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.startChip,
                                            pressed && { opacity: 0.8 },
                                        ]}
                                        disabled={isStarting}
                                        onPress={() => handleStartWorkout(routine)}
                                    >
                                        <Ionicons name="play" size={14} color="#FFFFFF" />
                                        <Text style={styles.startChipText}>
                                            {isStarting ? '...' : 'Start'}
                                        </Text>
                                    </Pressable>
                                </View>
                            );
                        })
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Training Analytics</Text>
                        <Pressable
                            onPress={() => navigation.navigate(ROUTES.ANALYTICS)}
                            style={({ pressed }) => [styles.newRoutineButton, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={styles.newRoutineText}>View Charts</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        </Pressable>
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.analyticsBanner, pressed && { opacity: 0.85 }]}
                        onPress={() => navigation.navigate(ROUTES.ANALYTICS)}
                    >
                        <View style={styles.analyticsBannerLeft}>
                            <View style={styles.analyticsIconCircle}>
                                <Ionicons name="trending-up" size={22} color={colors.primary} />
                            </View>
                            <View style={styles.analyticsBannerInfo}>
                                <Text style={styles.analyticsBannerTitle}>Progress & Analytics</Text>
                                <Text style={styles.analyticsBannerSub}>
                                    Weekly consistency, strength progression & PR charts
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </Pressable>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Workouts</Text>
                        <Pressable
                            onPress={() => navigation.navigate(ROUTES.WORKOUT_HISTORY)}
                            style={({ pressed }) => [styles.newRoutineButton, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={styles.newRoutineText}>See All</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        </Pressable>
                    </View>

                    {isLoading ? (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={styles.loader}
                        />
                    ) : recentSessions.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="time-outline" size={24} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No recent workouts</Text>
                            <Text style={styles.emptySubtitle}>
                                Your completed and active workouts will appear here.
                            </Text>
                        </View>
                    ) : (
                        recentSessions.map((session) => {
                            const duration = formatDuration(session.startTime, session.endTime);

                            return (
                                <Pressable
                                    key={session.id}
                                    style={styles.card}
                                    onPress={() => {
                                        if (session.status === 'COMPLETED') {
                                            navigation.navigate(ROUTES.WORKOUT_HISTORY, {
                                                initialSessionId: session.id,
                                            });
                                        } else {
                                            navigation.navigate(ROUTES.WORKOUTS, { session });
                                        }
                                    }}
                                >
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardTitle}>{session.name}</Text>
                                        <Text style={styles.cardSubtitle}>
                                            {formatDate(session.startTime)}
                                            {duration ? ` • ${duration}` : ''}
                                            {` • ${Math.round(session.totalVolumeKg || 0)} kg`}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            session.status === 'IN_PROGRESS' &&
                                                styles.statusBadgeActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusBadgeText,
                                                session.status === 'IN_PROGRESS' &&
                                                    styles.statusBadgeTextActive,
                                            ]}
                                        >
                                            {STATUS_LABELS[session.status] || session.status}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    headerTitleWrap: {
        flex: 1,
    },
    analyticsIconBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.pill,
    },
    analyticsIconBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
    analyticsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.md,
    },
    analyticsBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
    },
    analyticsIconCircle: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    analyticsBannerInfo: {
        flex: 1,
    },
    analyticsBannerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    analyticsBannerSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    dateText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text,
        marginTop: spacing.xs,
    },
    noticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    noticeText: {
        flex: 1,
        fontSize: 12,
        color: colors.textMuted,
    },
    activeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    activeBannerText: {
        flex: 1,
    },
    activeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DBEAFE',
    },
    activeName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 2,
    },
    resumePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    resumePillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    newRoutineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    newRoutineText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    sectionCount: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    loader: {
        marginVertical: spacing.md,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    cardInfo: {
        flex: 1,
        marginRight: spacing.sm,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    cardSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: 2,
    },
    startChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
    },
    startChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    statusBadge: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 8,
    },
    statusBadgeActive: {
        backgroundColor: '#DBEAFE',
        borderColor: colors.primary,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
    },
    statusBadgeTextActive: {
        color: colors.primary,
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.lg,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginTop: spacing.sm,
    },
    emptySubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
});

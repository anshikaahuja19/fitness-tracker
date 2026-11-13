import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { SkeletonCard } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { getPersonalRecords } from '../../services/prService';
import { ROUTES } from '../../constants/routes';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatEnum } from '../../utils/format';

const MUSCLE_FILTERS = [
    'ALL',
    'CHEST',
    'BACK',
    'LEGS',
    'SHOULDERS',
    'BICEPS',
    'TRICEPS',
    'CORE',
];

const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export default function PersonalRecordsScreen({ navigation }) {
    const { user } = useAuth();
    const userId = user?.id;

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [groupedPRs, setGroupedPRs] = useState([]);
    const [totalPRCount, setTotalPRCount] = useState(0);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMuscle, setSelectedMuscle] = useState('ALL');

    const loadPRs = useCallback(
        async (isRefresh = false) => {
            if (!userId) {
                setIsLoading(false);
                return;
            }

            if (isRefresh) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            try {
                const res = await getPersonalRecords(userId);
                setGroupedPRs(res.grouped || []);
                setTotalPRCount(res.total || 0);
            } catch (err) {
                setError(err.message || 'Failed to load personal records');
            } finally {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        },
        [userId]
    );

    useEffect(() => {
        loadPRs();
    }, [loadPRs]);

    // Filter by Search Query & Muscle Group
    const filteredPRs = useMemo(() => {
        return groupedPRs.filter((item) => {
            const exName = item.exercise?.name?.toLowerCase() || '';
            const exMuscle = (item.exercise?.primaryMuscle || '').toUpperCase();

            const matchesSearch =
                !searchQuery.trim() ||
                exName.includes(searchQuery.trim().toLowerCase());

            const matchesMuscle =
                selectedMuscle === 'ALL' ||
                exMuscle === selectedMuscle ||
                (selectedMuscle === 'LEGS' &&
                    ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES'].includes(exMuscle));

            return matchesSearch && matchesMuscle;
        });
    }, [groupedPRs, searchQuery, selectedMuscle]);

    return (
        <ScreenContainer>
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Personal Records</Text>
                    <View style={styles.trophyPill}>
                        <Ionicons name="trophy" size={12} color={colors.pr} />
                        <Text style={styles.trophyPillText}>{totalPRCount} Records</Text>
                    </View>
                </View>
                <Pressable
                    onPress={() => loadPRs(true)}
                    style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="refresh" size={20} color={colors.primary} />
                </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.searchWrapper}>
                <Input
                    placeholder="Search exercise PRs..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                />
            </View>

            {/* Muscle Filter Chips */}
            <View style={styles.chipsRow}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContent}
                >
                    {MUSCLE_FILTERS.map((muscle) => (
                        <Chip
                            key={muscle}
                            label={muscle === 'ALL' ? 'All' : formatEnum(muscle)}
                            selected={selectedMuscle === muscle}
                            onPress={() => setSelectedMuscle(muscle)}
                        />
                    ))}
                </ScrollView>
            </View>

            {/* PR List */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadPRs(true)}
                        tintColor={colors.primary}
                    />
                }
            >
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : error ? (
                    <Card style={styles.errorCard}>
                        <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
                        <Text style={styles.errorTitle}>Could not load PRs</Text>
                        <Text style={styles.errorSubtitle}>{error}</Text>
                        <Button title="Try Again" variant="outline" size="sm" onPress={() => loadPRs(false)} />
                    </Card>
                ) : filteredPRs.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <Ionicons name="trophy-outline" size={36} color={colors.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {searchQuery || selectedMuscle !== 'ALL'
                                ? 'No PRs match your filters'
                                : 'No Personal Records Yet'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery || selectedMuscle !== 'ALL'
                                ? 'Try searching for another exercise or clearing your filters.'
                                : 'Push your limits in your workouts — FitTrack automatically detects your personal bests!'}
                        </Text>
                        {!searchQuery && selectedMuscle === 'ALL' && (
                            <Button
                                title="Start a Workout"
                                style={styles.emptyButton}
                                onPress={() => navigation.navigate(ROUTES.MAIN_TABS, { screen: ROUTES.WORKOUTS })}
                            />
                        )}
                    </View>
                ) : (
                    filteredPRs.map((item) => {
                        const ex = item.exercise;
                        const records = item.records || {};

                        const maxWeight = records.MAX_WEIGHT;
                        const est1RM = records.ESTIMATED_1RM;
                        const maxReps = records.MAX_REPS;
                        const maxVolume = records.MAX_VOLUME;

                        return (
                            <Card key={ex.id} style={styles.prCard}>
                                <View style={styles.prCardHeader}>
                                    <View style={styles.prTitleWrap}>
                                        <Text style={styles.exerciseName}>{ex.name}</Text>
                                        <View style={styles.tagRow}>
                                            <Text style={styles.tagBadge}>
                                                {formatEnum(ex.primaryMuscle)}
                                            </Text>
                                            {ex.equipment && (
                                                <Text style={styles.tagBadge}>
                                                    {formatEnum(ex.equipment)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.graphButton,
                                            pressed && { opacity: 0.7 },
                                        ]}
                                        onPress={() =>
                                            navigation.navigate(ROUTES.ANALYTICS, {
                                                exerciseId: ex.id,
                                            })
                                        }
                                    >
                                        <Ionicons name="trending-up" size={16} color={colors.primary} />
                                        <Text style={styles.graphButtonText}>Chart</Text>
                                    </Pressable>
                                </View>

                                {/* Badges Grid */}
                                <View style={styles.badgesGrid}>
                                    {maxWeight && (
                                        <View style={styles.badgeItem}>
                                            <View style={styles.badgeIconRow}>
                                                <Ionicons name="ribbon" size={14} color="#D97706" />
                                                <Text style={styles.badgeLabel}>Max Weight</Text>
                                            </View>
                                            <Text style={styles.badgeValue}>
                                                {maxWeight.value} <Text style={styles.badgeUnit}>kg</Text>
                                            </Text>
                                            <Text style={styles.badgeDate}>
                                                {formatDate(maxWeight.achievedAt)}
                                            </Text>
                                        </View>
                                    )}

                                    {est1RM && (
                                        <View style={styles.badgeItem}>
                                            <View style={styles.badgeIconRow}>
                                                <Ionicons name="barbell" size={14} color={colors.primary} />
                                                <Text style={styles.badgeLabel}>Est. 1RM</Text>
                                            </View>
                                            <Text style={styles.badgeValue}>
                                                {Math.round(est1RM.value * 10) / 10}{' '}
                                                <Text style={styles.badgeUnit}>kg</Text>
                                            </Text>
                                            <Text style={styles.badgeDate}>
                                                {formatDate(est1RM.achievedAt)}
                                            </Text>
                                        </View>
                                    )}

                                    {maxReps && (
                                        <View style={styles.badgeItem}>
                                            <View style={styles.badgeIconRow}>
                                                <Ionicons name="flash" size={14} color={colors.success} />
                                                <Text style={styles.badgeLabel}>Max Reps</Text>
                                            </View>
                                            <Text style={styles.badgeValue}>
                                                {maxReps.value}{' '}
                                                <Text style={styles.badgeUnit}>reps</Text>
                                            </Text>
                                            <Text style={styles.badgeDate}>
                                                {maxReps.weight ? `@ ${maxReps.weight}kg • ` : ''}
                                                {formatDate(maxReps.achievedAt)}
                                            </Text>
                                        </View>
                                    )}

                                    {maxVolume && (
                                        <View style={styles.badgeItem}>
                                            <View style={styles.badgeIconRow}>
                                                <Ionicons name="layers" size={14} color="#8B5CF6" />
                                                <Text style={styles.badgeLabel}>Max Volume</Text>
                                            </View>
                                            <Text style={styles.badgeValue}>
                                                {Math.round(maxVolume.value)}{' '}
                                                <Text style={styles.badgeUnit}>kg</Text>
                                            </Text>
                                            <Text style={styles.badgeDate}>
                                                Single Set • {formatDate(maxVolume.achievedAt)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </Card>
                        );
                    })
                )}
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        ...typography.h3,
        fontSize: 18,
    },
    trophyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        marginTop: 2,
    },
    trophyPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400E',
    },
    refreshButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchWrapper: {
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
    },
    chipsRow: {
        marginHorizontal: -spacing.md,
        marginBottom: spacing.sm,
    },
    chipsContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
        gap: spacing.sm,
    },
    errorCard: {
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.xs,
    },
    errorTitle: {
        ...typography.h3,
        color: colors.error,
    },
    errorSubtitle: {
        ...typography.caption,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl * 2,
        paddingHorizontal: spacing.lg,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h3,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        ...typography.caption,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    emptyButton: {
        minWidth: 160,
    },
    prCard: {
        padding: spacing.md,
        gap: spacing.md,
    },
    prCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    prTitleWrap: {
        flex: 1,
        marginRight: spacing.sm,
    },
    exerciseName: {
        ...typography.body,
        fontWeight: '700',
        fontSize: 16,
    },
    tagRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    tagBadge: {
        fontSize: 11,
        color: colors.textMuted,
        backgroundColor: colors.surface,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.sm,
        overflow: 'hidden',
    },
    graphButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#DBEAFE',
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: radius.pill,
    },
    graphButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
    },
    badgesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    badgeItem: {
        width: '48%',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    badgeIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    badgeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
    },
    badgeValue: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginVertical: 2,
    },
    badgeUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textMuted,
    },
    badgeDate: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 2,
    },
});

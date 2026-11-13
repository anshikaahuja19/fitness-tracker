import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import { SkeletonCard, SkeletonChart } from '../../components/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import {
    getAnalyticsCharts,
    getAnalyticsSummary,
    getStrengthProgression,
    getWeeklyFrequency,
} from '../../services/analyticsService';
import { fetchExercises } from '../../services/exercises';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatEnum } from '../../utils/format';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;

const TIME_RANGES = [
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' },
];

const METRICS = [
    { label: 'Max Weight', key: 'maxWeightKg', unit: 'kg' },
    { label: 'Est. 1RM', key: 'estimated1RMKg', unit: 'kg' },
    { label: 'Total Volume', key: 'totalVolumeKg', unit: 'kg' },
];

const WEEKS_OPTIONS = [
    { label: '4W', value: 4 },
    { label: '8W', value: 8 },
    { label: '12W', value: 12 },
];

const formatVolume = (val) => {
    if (!val || Number.isNaN(val)) return '0 kg';
    if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}t`;
    }
    return `${Math.round(val)} kg`;
};

export default function AnalyticsScreen({ navigation, route }) {
    const { user } = useAuth();
    const userId = user?.id;

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Summary KPIs
    const [summary, setSummary] = useState(null);

    // Weekly frequency chart
    const [weeksCount, setWeeksCount] = useState(8);
    const [weeklyData, setWeeklyData] = useState([]);

    // Strength progression chart
    const [topExercises, setTopExercises] = useState([]);
    const [selectedExerciseId, setSelectedExerciseId] = useState(route?.params?.exerciseId || null);
    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [selectedMetric, setSelectedMetric] = useState('maxWeightKg');
    const [progressionData, setProgressionData] = useState(null);
    const [isProgressionLoading, setIsProgressionLoading] = useState(false);

    useEffect(() => {
        if (route?.params?.exerciseId && route.params.exerciseId !== selectedExerciseId) {
            setSelectedExerciseId(route.params.exerciseId);
            loadProgressionForExercise(route.params.exerciseId, selectedTimeRange);
        }
    }, [route?.params?.exerciseId]);

    // Initial Full Load
    const loadAllAnalytics = useCallback(async (isRefresh = false) => {
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
            const [summaryRes, chartsRes] = await Promise.all([
                getAnalyticsSummary(userId).catch(() => null),
                getAnalyticsCharts(userId, { weeks: weeksCount, range: selectedTimeRange }).catch(() => null),
            ]);

            setSummary(summaryRes);

            if (chartsRes) {
                setWeeklyData(chartsRes.weeklyFrequency || []);
                const top = chartsRes.topExercises || [];
                setTopExercises(top);

                if (!selectedExerciseId && top.length > 0) {
                    setSelectedExerciseId(top[0].id);
                    setProgressionData(chartsRes.strengthProgression);
                } else if (chartsRes.strengthProgression) {
                    setProgressionData(chartsRes.strengthProgression);
                }
            }

            // Fallback: if no top exercises logged yet, fetch catalog exercises so user can pick
            if (!chartsRes?.topExercises?.length) {
                const catalog = await fetchExercises({ limit: 10 }).catch(() => ({ items: [] }));
                if (catalog?.items?.length) {
                    setTopExercises(catalog.items);
                    if (!selectedExerciseId) {
                        setSelectedExerciseId(catalog.items[0].id);
                    }
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to load analytics');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [userId, weeksCount, selectedTimeRange]);

    useEffect(() => {
        loadAllAnalytics();
    }, [loadAllAnalytics]);

    // Load Strength Progression when Exercise, Range, or Metric changes
    const loadProgressionForExercise = useCallback(async (exerciseId, range) => {
        if (!userId || !exerciseId) return;
        setIsProgressionLoading(true);
        try {
            const res = await getStrengthProgression(userId, exerciseId, range);
            setProgressionData(res);
        } catch (_e) {
            setProgressionData(null);
        } finally {
            setIsProgressionLoading(false);
        }
    }, [userId]);

    const handleSelectExercise = (exerciseId) => {
        setSelectedExerciseId(exerciseId);
        loadProgressionForExercise(exerciseId, selectedTimeRange);
    };

    const handleSelectTimeRange = (range) => {
        setSelectedTimeRange(range);
        loadProgressionForExercise(selectedExerciseId, range);
    };

    const handleSelectWeeks = async (weeks) => {
        setWeeksCount(weeks);
        if (!userId) return;
        try {
            const data = await getWeeklyFrequency(userId, weeks);
            setWeeklyData(data);
        } catch (_e) {
            // keep old data
        }
    };

    // Prepare Bar Chart Data for Weekly Frequency
    const barChartData = useMemo(() => {
        if (!weeklyData || weeklyData.length === 0) return [];
        const maxWorkouts = Math.max(...weeklyData.map((w) => w.workoutCount || 0), 1);

        return weeklyData.map((item, index) => {
            const count = item.workoutCount || 0;
            const isLast = index === weeklyData.length - 1;
            return {
                value: count,
                label: item.label ? item.label.split(' ')[0] : `W${index + 1}`,
                frontColor: isLast ? colors.primary : count > 0 ? '#60A5FA' : '#E5E7EB',
                topLabelComponent: () => (
                    <Text style={styles.barTopLabel}>{count > 0 ? count : ''}</Text>
                ),
            };
        });
    }, [weeklyData]);

    // Prepare Line Chart Data for Strength Progression
    const lineChartData = useMemo(() => {
        const points = progressionData?.dataPoints || [];
        if (points.length === 0) return [];

        return points.map((p, idx) => {
            const rawVal = p[selectedMetric] || 0;
            const dateObj = new Date(p.date);
            const dateLabel = dateObj.toLocaleDateString(undefined, {
                month: 'numeric',
                day: 'numeric',
            });

            return {
                value: rawVal,
                label: idx === 0 || idx === points.length - 1 || idx % 2 === 0 ? dateLabel : '',
                dataPointText: points.length <= 8 ? `${Math.round(rawVal)}` : undefined,
                textColor: colors.primaryDark,
                textFontSize: 10,
            };
        });
    }, [progressionData, selectedMetric]);

    // Progression Stats Header (Starting -> Peak -> Increase)
    const progressionStats = useMemo(() => {
        const points = progressionData?.dataPoints || [];
        if (points.length === 0) return null;

        const firstVal = points[0][selectedMetric] || 0;
        const lastVal = points[points.length - 1][selectedMetric] || 0;
        const allVals = points.map((p) => p[selectedMetric] || 0);
        const peakVal = Math.max(...allVals);
        const diff = lastVal - firstVal;
        const percent = firstVal > 0 ? Math.round((diff / firstVal) * 100) : 0;

        return {
            firstVal: Math.round(firstVal * 10) / 10,
            lastVal: Math.round(lastVal * 10) / 10,
            peakVal: Math.round(peakVal * 10) / 10,
            diff: Math.round(diff * 10) / 10,
            percent,
            isPositive: diff >= 0,
            totalSessions: points.length,
        };
    }, [progressionData, selectedMetric]);

    const activeExerciseName = useMemo(() => {
        if (progressionData?.exercise?.name) return progressionData.exercise.name;
        const match = topExercises.find((e) => e.id === selectedExerciseId);
        return match?.name || 'Selected Exercise';
    }, [progressionData, topExercises, selectedExerciseId]);

    const currentMetricInfo = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

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
                <Text style={styles.headerTitle}>Progress & Analytics</Text>
                <Pressable
                    onPress={() => loadAllAnalytics(true)}
                    style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="refresh" size={20} color={colors.primary} />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadAllAnalytics(true)}
                        tintColor={colors.primary}
                    />
                }
            >
                {isLoading ? (
                    <View style={styles.skeletonWrap}>
                        <View style={styles.kpiGrid}>
                            <SkeletonCard style={styles.kpiCard} />
                            <SkeletonCard style={styles.kpiCard} />
                            <SkeletonCard style={styles.kpiCard} />
                            <SkeletonCard style={styles.kpiCard} />
                        </View>
                        <SkeletonChart height={200} />
                        <SkeletonChart height={220} />
                    </View>
                ) : error ? (
                    <Card style={styles.errorCard}>
                        <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
                        <Text style={styles.errorTitle}>Could not load analytics</Text>
                        <Text style={styles.errorSubtitle}>{error}</Text>
                        <Pressable style={styles.retryButton} onPress={() => loadAllAnalytics(false)}>
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </Pressable>
                    </Card>
                ) : (
                    <>
                        {/* 1. Summary KPI Grid */}
                        <View style={styles.kpiGrid}>
                            <Card style={styles.kpiCard}>
                                <View style={styles.kpiHeader}>
                                    <Text style={styles.kpiLabel}>Workouts</Text>
                                    <View style={[styles.kpiIconWrap, { backgroundColor: '#DBEAFE' }]}>
                                        <Ionicons name="barbell" size={16} color={colors.primary} />
                                    </View>
                                </View>
                                <Text style={styles.kpiValue}>{summary?.totalWorkouts ?? 0}</Text>
                                <Text style={styles.kpiSub}>
                                    {summary?.workoutsThisWeek ?? 0} completed this week
                                </Text>
                            </Card>

                            <Card style={styles.kpiCard}>
                                <View style={styles.kpiHeader}>
                                    <Text style={styles.kpiLabel}>Volume Lifted</Text>
                                    <View style={[styles.kpiIconWrap, { backgroundColor: '#DCFCE7' }]}>
                                        <Ionicons name="layers" size={16} color={colors.success} />
                                    </View>
                                </View>
                                <Text style={styles.kpiValue}>
                                    {formatVolume(summary?.totalVolumeKg)}
                                </Text>
                                <Text style={styles.kpiSub}>
                                    {formatVolume(summary?.volumeThisWeekKg)} this week
                                </Text>
                            </Card>

                            <Card style={styles.kpiCard}>
                                <Pressable
                                    onPress={() => navigation.navigate(ROUTES.PERSONAL_RECORDS)}
                                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                                >
                                    <View style={styles.kpiHeader}>
                                        <Text style={styles.kpiLabel}>PRs Hit</Text>
                                        <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
                                            <Ionicons name="trophy" size={16} color={colors.pr} />
                                        </View>
                                    </View>
                                    <Text style={styles.kpiValue}>{summary?.totalPRs ?? 0}</Text>
                                    <View style={styles.kpiNavRow}>
                                        <Text style={styles.kpiSub}>All-time bests</Text>
                                        <Ionicons name="chevron-forward" size={12} color={colors.pr} />
                                    </View>
                                </Pressable>
                            </Card>

                            <Card style={styles.kpiCard}>
                                <View style={styles.kpiHeader}>
                                    <Text style={styles.kpiLabel}>Streak</Text>
                                    <View style={[styles.kpiIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                        <Ionicons name="flame" size={16} color="#EF4444" />
                                    </View>
                                </View>
                                <Text style={styles.kpiValue}>
                                    {summary?.currentStreakDays ?? 0}
                                    <Text style={styles.kpiUnit}> days</Text>
                                </Text>
                                <Text style={styles.kpiSub}>Active streak</Text>
                            </Card>
                        </View>

                        {/* 2. Weekly Consistency / Frequency Chart */}
                        <Card style={styles.chartCard}>
                            <View style={styles.sectionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>Weekly Consistency</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        Workouts logged per week
                                    </Text>
                                </View>
                                <View style={styles.pillGroup}>
                                    {WEEKS_OPTIONS.map((opt) => (
                                        <Pressable
                                            key={opt.value}
                                            style={[
                                                styles.timePill,
                                                weeksCount === opt.value && styles.timePillActive,
                                            ]}
                                            onPress={() => handleSelectWeeks(opt.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.timePillText,
                                                    weeksCount === opt.value && styles.timePillTextActive,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {barChartData.length === 0 ? (
                                <View style={styles.emptyChart}>
                                    <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                                    <Text style={styles.emptyChartText}>No workouts recorded in this period</Text>
                                </View>
                            ) : (
                                <View style={styles.chartWrapper}>
                                    <BarChart
                                        data={barChartData}
                                        width={CHART_WIDTH - 20}
                                        height={180}
                                        barWidth={20}
                                        spacing={18}
                                        roundedTop
                                        roundedBottom
                                        noOfSections={4}
                                        yAxisThickness={0}
                                        xAxisThickness={1}
                                        xAxisColor={colors.border}
                                        yAxisTextStyle={styles.axisLabel}
                                        xAxisLabelTextStyle={styles.axisLabel}
                                        hideRules={false}
                                        rulesColor="#F3F4F6"
                                        rulesType="solid"
                                        isAnimated={false}
                                    />
                                </View>
                            )}
                        </Card>

                        {/* 3. Strength Progression Line Chart */}
                        <Card style={styles.chartCard}>
                            <View style={styles.sectionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>Strength Progression</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        {activeExerciseName}
                                    </Text>
                                </View>
                                <View style={styles.pillGroup}>
                                    {TIME_RANGES.map((r) => (
                                        <Pressable
                                            key={r.value}
                                            style={[
                                                styles.timePill,
                                                selectedTimeRange === r.value && styles.timePillActive,
                                            ]}
                                            onPress={() => handleSelectTimeRange(r.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.timePillText,
                                                    selectedTimeRange === r.value && styles.timePillTextActive,
                                                ]}
                                            >
                                                {r.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Exercise Selector Chips */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.exerciseChipsScroll}
                                contentContainerStyle={styles.exerciseChipsContent}
                            >
                                {topExercises.map((ex) => (
                                    <Chip
                                        key={ex.id}
                                        label={ex.name}
                                        selected={selectedExerciseId === ex.id}
                                        onPress={() => handleSelectExercise(ex.id)}
                                    />
                                ))}
                            </ScrollView>

                            {/* Metric Switcher */}
                            <View style={styles.metricSwitcher}>
                                {METRICS.map((m) => (
                                    <Pressable
                                        key={m.key}
                                        style={[
                                            styles.metricTab,
                                            selectedMetric === m.key && styles.metricTabActive,
                                        ]}
                                        onPress={() => setSelectedMetric(m.key)}
                                    >
                                        <Text
                                            style={[
                                                styles.metricTabText,
                                                selectedMetric === m.key && styles.metricTabTextActive,
                                            ]}
                                        >
                                            {m.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Progression Summary KPI */}
                            {progressionStats && (
                                <View style={styles.progressionStatsRow}>
                                    <View style={styles.progressionStatItem}>
                                        <Text style={styles.progressionStatLabel}>Start</Text>
                                        <Text style={styles.progressionStatValue}>
                                            {progressionStats.firstVal} {currentMetricInfo.unit}
                                        </Text>
                                    </View>
                                    <View style={styles.progressionStatItem}>
                                        <Text style={styles.progressionStatLabel}>Peak</Text>
                                        <Text style={[styles.progressionStatValue, { color: colors.primary }]}>
                                            {progressionStats.peakVal} {currentMetricInfo.unit}
                                        </Text>
                                    </View>
                                    <View style={styles.progressionStatItem}>
                                        <Text style={styles.progressionStatLabel}>Net Change</Text>
                                        <Text
                                            style={[
                                                styles.progressionStatValue,
                                                { color: progressionStats.isPositive ? colors.success : colors.error },
                                            ]}
                                        >
                                            {progressionStats.isPositive ? '+' : ''}
                                            {progressionStats.diff} {currentMetricInfo.unit} ({progressionStats.percent}%)
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Line Chart */}
                            {isProgressionLoading ? (
                                <View style={styles.emptyChart}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <Text style={styles.emptyChartText}>Loading progression...</Text>
                                </View>
                            ) : lineChartData.length === 0 ? (
                                <View style={styles.emptyChart}>
                                    <Ionicons name="trending-up" size={32} color={colors.textMuted} />
                                    <Text style={styles.emptyChartText}>
                                        No workout data logged yet for {activeExerciseName}
                                    </Text>
                                    <Text style={styles.emptyChartSub}>
                                        Complete a session with this exercise to see your strength curve.
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.chartWrapper}>
                                    <LineChart
                                        data={lineChartData}
                                        width={CHART_WIDTH - 20}
                                        height={200}
                                        spacing={lineChartData.length > 5 ? 40 : 60}
                                        initialSpacing={20}
                                        color={colors.primary}
                                        thickness={3}
                                        startFillColor="#93C5FD"
                                        endFillColor="#EFF6FF"
                                        startOpacity={0.4}
                                        endOpacity={0.05}
                                        areaChart
                                        curved
                                        curveType={1}
                                        dataPointsColor={colors.primary}
                                        dataPointsRadius={5}
                                        hideRules={false}
                                        rulesColor="#F3F4F6"
                                        rulesType="solid"
                                        yAxisThickness={0}
                                        xAxisThickness={1}
                                        xAxisColor={colors.border}
                                        yAxisTextStyle={styles.axisLabel}
                                        xAxisLabelTextStyle={styles.axisLabel}
                                        isAnimated={false}
                                    />
                                </View>
                            )}
                        </Card>

                        {/* 4. Top Exercises Volume Share */}
                        {topExercises.length > 0 && (
                            <Card style={styles.topExercisesCard}>
                                <Text style={styles.sectionTitle}>Top Exercises</Text>
                                <Text style={styles.sectionSubtitle}>
                                    Most frequent movements in your training
                                </Text>

                                <View style={styles.topList}>
                                    {topExercises.map((ex, idx) => {
                                        return (
                                            <Pressable
                                                key={ex.id || idx}
                                                style={styles.topRow}
                                                onPress={() => handleSelectExercise(ex.id)}
                                            >
                                                <View style={styles.topRankCircle}>
                                                    <Text style={styles.topRankText}>#{idx + 1}</Text>
                                                </View>
                                                <View style={styles.topInfo}>
                                                    <Text style={styles.topName}>{ex.name}</Text>
                                                    <Text style={styles.topCategory}>
                                                        {formatEnum(ex.primaryMuscle || ex.category || 'Strength')}
                                                    </Text>
                                                </View>
                                                <View style={styles.topAction}>
                                                    <Ionicons
                                                        name={selectedExerciseId === ex.id ? 'checkmark-circle' : 'chevron-forward'}
                                                        size={18}
                                                        color={selectedExerciseId === ex.id ? colors.primary : colors.textMuted}
                                                    />
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </Card>
                        )}
                    </>
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
        marginBottom: spacing.xs,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...typography.h2,
        fontSize: 20,
    },
    refreshButton: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
        gap: spacing.md,
    },
    centered: {
        paddingVertical: spacing.xl * 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        ...typography.caption,
        marginTop: spacing.sm,
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
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    kpiCard: {
        width: (SCREEN_WIDTH - 40) / 2,
        padding: spacing.md,
    },
    kpiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    kpiLabel: {
        ...typography.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    kpiIconWrap: {
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiValue: {
        ...typography.h2,
        fontSize: 22,
        marginVertical: 2,
    },
    kpiNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    skeletonWrap: {
        gap: spacing.md,
    },
    kpiUnit: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '400',
    },
    kpiSub: {
        ...typography.caption,
        fontSize: 11,
    },
    chartCard: {
        padding: spacing.md,
        gap: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        ...typography.h3,
    },
    sectionSubtitle: {
        ...typography.caption,
        marginTop: 2,
    },
    pillGroup: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.pill,
        padding: 2,
    },
    timePill: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
    },
    timePillActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    timePillText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.textMuted,
    },
    timePillTextActive: {
        color: colors.primary,
        fontWeight: '700',
    },
    chartWrapper: {
        alignItems: 'center',
        overflow: 'hidden',
        paddingVertical: spacing.xs,
    },
    axisLabel: {
        color: colors.textMuted,
        fontSize: 10,
    },
    barTopLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 2,
    },
    emptyChart: {
        paddingVertical: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    emptyChartText: {
        ...typography.body,
        fontWeight: '500',
        textAlign: 'center',
    },
    emptyChartSub: {
        ...typography.caption,
        textAlign: 'center',
    },
    exerciseChipsScroll: {
        marginHorizontal: -spacing.md,
    },
    exerciseChipsContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
    },
    metricSwitcher: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: 3,
    },
    metricTab: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        borderRadius: radius.sm,
    },
    metricTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    metricTabText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textMuted,
    },
    metricTabTextActive: {
        color: colors.text,
        fontWeight: '700',
    },
    progressionStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
    },
    progressionStatItem: {
        alignItems: 'center',
    },
    progressionStatLabel: {
        ...typography.caption,
        fontSize: 11,
        marginBottom: 2,
    },
    progressionStatValue: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    topExercisesCard: {
        padding: spacing.md,
    },
    topList: {
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    topRankCircle: {
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    topRankText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
    },
    topInfo: {
        flex: 1,
    },
    topName: {
        ...typography.body,
        fontSize: 14,
        fontWeight: '600',
    },
    topCategory: {
        ...typography.caption,
        fontSize: 11,
    },
    topAction: {
        paddingLeft: spacing.sm,
    },
});

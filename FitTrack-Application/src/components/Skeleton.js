import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

/**
 * Base animated skeleton element with smooth opacity pulse.
 */
export function Skeleton({
    width = '100%',
    height = 16,
    borderRadius = radius.sm,
    style,
}) {
    const pulseAnim = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.8,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.35,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, [pulseAnim]);

    return (
        <Animated.View
            style={[
                styles.base,
                {
                    width,
                    height,
                    borderRadius,
                    opacity: pulseAnim,
                },
                style,
            ]}
        />
    );
}

/**
 * Skeleton placeholder representing a card with header, badge, and body rows.
 */
export function SkeletonCard({ style, children }) {
    return (
        <View style={[styles.card, style]}>
            {children || (
                <>
                    <View style={styles.cardHeader}>
                        <Skeleton width="55%" height={18} borderRadius={radius.sm} />
                        <Skeleton width={60} height={20} borderRadius={radius.pill} />
                    </View>
                    <Skeleton width="40%" height={13} style={styles.mtSm} />
                    <View style={styles.rowWrapper}>
                        <Skeleton width="30%" height={14} />
                        <Skeleton width="25%" height={14} />
                    </View>
                </>
            )}
        </View>
    );
}

/**
 * Skeleton placeholder for list items or horizontal stat rows.
 */
export function SkeletonRow({ style }) {
    return (
        <View style={[styles.rowItem, style]}>
            <Skeleton width={40} height={40} borderRadius={radius.pill} />
            <View style={styles.rowInfo}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} style={styles.mtXs} />
            </View>
            <Skeleton width={30} height={16} />
        </View>
    );
}

/**
 * Skeleton placeholder representing a chart with vertical bars.
 */
export function SkeletonChart({ height = 180, barCount = 7, style }) {
    return (
        <View style={[styles.chartContainer, { height }, style]}>
            <View style={styles.barsRow}>
                {Array.from({ length: barCount }).map((_, i) => {
                    const heights = [40, 75, 110, 60, 95, 130, 80];
                    const barHeight = heights[i % heights.length];
                    return (
                        <View key={i} style={styles.barCol}>
                            <Skeleton
                                width={20}
                                height={barHeight}
                                borderRadius={radius.sm}
                                style={styles.barSkeleton}
                            />
                            <Skeleton width={24} height={10} style={styles.mtXs} />
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.border,
    },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
    },
    rowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    rowInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    chartContainer: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        justifyContent: 'flex-end',
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        height: '100%',
    },
    barCol: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
    },
    barSkeleton: {
        marginBottom: spacing.xs,
    },
    mtSm: {
        marginTop: spacing.sm,
    },
    mtXs: {
        marginTop: spacing.xs,
    },
});

export default Skeleton;

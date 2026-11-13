import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { colors, radius, spacing, typography } from '../constants/theme';
import { formatEnum } from '../utils/format';

export default function WorkoutExerciseCard({
    entry,
    previous,
    onChangeSetField,
    onToggleSetComplete,
    onAddSet,
    onRemoveSet,
    onRemoveExercise,
}) {
    const { exercise, targetSets, targetReps, restSeconds, sets } = entry;
    const detailParts = [
        exercise?.primaryMuscle ? formatEnum(exercise.primaryMuscle) : null,
        exercise?.equipment && exercise.equipment !== 'NONE'
            ? formatEnum(exercise.equipment)
            : null,
    ].filter(Boolean);

    const previousByNumber = new Map((previous?.sets || []).map((item) => [item.setNumber, item]));
    const previousDate = previous?.performedAt
        ? new Date(previous.performedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : null;

    // Tapping the "previous" cell copies last time's numbers into this set.
    const applyPrevious = (setRow, prev) => {
        if (!prev || setRow.isCompleted) return;
        onChangeSetField(entry.exerciseId, setRow.setNumber, 'weight', String(prev.weight));
        onChangeSetField(entry.exerciseId, setRow.setNumber, 'reps', String(prev.reps));
    };

    return (
        <Card style={styles.card}>
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Text style={styles.title}>{exercise?.name || 'Exercise'}</Text>
                    <View style={styles.metaRow}>
                        {detailParts.length > 0 && (
                            <Text style={styles.subtitle}>{detailParts.join(' · ')}</Text>
                        )}
                        {targetSets ? (
                            <View style={styles.targetPill}>
                                <Text style={styles.targetText}>
                                    Target: {targetSets} × {targetReps || '8-12'}
                                </Text>
                            </View>
                        ) : null}
                        {restSeconds ? (
                            <Text style={styles.restHint}>Rest {restSeconds}s</Text>
                        ) : null}
                    </View>
                </View>

                {onRemoveExercise ? (
                    <Pressable
                        onPress={() => onRemoveExercise(entry.exerciseId)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove exercise"
                        style={({ pressed }) => [styles.removeButton, pressed && { opacity: 0.7 }]}
                    >
                        <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                ) : null}
            </View>

            {previousDate ? (
                <Text style={styles.previousHint}>
                    Last time: {previousDate} · {previous.sets.length} set{previous.sets.length === 1 ? '' : 's'}
                </Text>
            ) : null}

            <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, styles.setCol]}>SET</Text>
                <Text style={[styles.colHeader, styles.prevCol]}>PREVIOUS</Text>
                <Text style={[styles.colHeader, styles.inputCol]}>KG</Text>
                <Text style={[styles.colHeader, styles.inputCol]}>REPS</Text>
                <Text style={[styles.colHeader, styles.actionCol]}>DONE</Text>
                <View style={styles.deleteCol} />
            </View>

            {sets.map((setRow) => {
                const isDone = Boolean(setRow.isCompleted);
                const prev = previousByNumber.get(setRow.setNumber);

                return (
                    <View
                        key={`${entry.exerciseId}-${setRow.setNumber}`}
                        style={[styles.setRow, isDone && styles.setRowCompleted]}
                    >
                        <View style={styles.setCol}>
                            <View style={[styles.setBadge, isDone && styles.setBadgeCompleted]}>
                                <Text style={[styles.setNumber, isDone && styles.setNumberCompleted]}>
                                    {setRow.setNumber}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            onPress={() => applyPrevious(setRow, prev)}
                            disabled={!prev || isDone}
                            accessibilityRole="button"
                            accessibilityLabel={
                                prev
                                    ? `Use previous ${prev.weight} kilograms for ${prev.reps} reps`
                                    : 'No previous data'
                            }
                            style={({ pressed }) => [styles.prevCol, pressed && { opacity: 0.6 }]}
                        >
                            <Text style={[styles.prevText, !prev && styles.prevTextEmpty]} numberOfLines={1}>
                                {prev ? `${prev.weight}×${prev.reps}` : '—'}
                            </Text>
                        </Pressable>

                        <View style={styles.inputCol}>
                            <TextInput
                                style={styles.numberInput}
                                value={setRow.weight}
                                onChangeText={(value) =>
                                    onChangeSetField(entry.exerciseId, setRow.setNumber, 'weight', value)
                                }
                                placeholder={prev ? String(prev.weight) : '0'}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                            />
                        </View>

                        <View style={styles.inputCol}>
                            <TextInput
                                style={styles.numberInput}
                                value={setRow.reps}
                                onChangeText={(value) =>
                                    onChangeSetField(entry.exerciseId, setRow.setNumber, 'reps', value)
                                }
                                placeholder={prev ? String(prev.reps) : '0'}
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                                selectTextOnFocus
                            />
                        </View>

                        <Pressable
                            onPress={() => onToggleSetComplete(entry.exerciseId, setRow.setNumber)}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark set ${setRow.setNumber} completed`}
                            style={({ pressed }) => [styles.actionCol, pressed && { opacity: 0.7 }]}
                        >
                            <View style={[styles.checkBox, isDone && styles.checkBoxDone]}>
                                <Ionicons
                                    name="checkmark"
                                    size={16}
                                    color={isDone ? colors.textInverse : colors.textMuted}
                                />
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => onRemoveSet(entry.exerciseId, setRow.setNumber)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove set ${setRow.setNumber}`}
                            style={({ pressed }) => [styles.deleteCol, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                    </View>
                );
            })}

            <Pressable
                onPress={() => onAddSet(entry.exerciseId)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addSetButton, pressed && { opacity: 0.7 }]}
            >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addSetText}>Add Set</Text>
            </Pressable>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    headerInfo: {
        flex: 1,
        marginRight: spacing.sm,
    },
    title: {
        ...typography.h3,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 4,
    },
    subtitle: {
        ...typography.caption,
    },
    targetPill: {
        backgroundColor: colors.primaryLight,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
    },
    targetText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primaryDark,
    },
    restHint: {
        fontSize: 12,
        color: colors.textMuted,
    },
    removeButton: {
        width: 30,
        height: 30,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: spacing.xs,
    },
    colHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.sm,
    },
    setRowCompleted: {
        backgroundColor: '#F0FDF4',
    },
    setCol: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setBadge: {
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setBadgeCompleted: {
        backgroundColor: '#DCFCE7',
    },
    setNumber: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    setNumberCompleted: {
        color: colors.success,
    },
    previousHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: -spacing.xs,
        marginBottom: spacing.sm,
    },
    prevCol: {
        width: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    prevText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
    },
    prevTextEmpty: {
        color: colors.border,
    },
    inputCol: {
        flex: 1,
        paddingHorizontal: spacing.xs,
    },
    numberInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        backgroundColor: colors.background,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.sm,
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
    actionCol: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkBox: {
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkBoxDone: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    deleteCol: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addSetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: spacing.sm,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
    },
    addSetText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
});

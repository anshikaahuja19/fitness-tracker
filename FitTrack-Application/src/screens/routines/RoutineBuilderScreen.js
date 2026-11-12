import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import ExercisePickerModal from '../../components/ExercisePickerModal';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatEnum } from '../../utils/format';
import {
  createRoutine,
  deleteRoutine,
  fetchRoutine,
  saveRoutineExercises,
  updateRoutine,
} from '../../services/routines';

const REST_OPTIONS = [60, 90, 120, 180];
const DEFAULT_ITEM = { targetSets: 3, targetReps: '8-12', restSeconds: 90 };

// Turn a routineExercise row from the API into local editable state.
const toItem = (row) => ({
  key: row.id ?? `${row.exerciseId}-${Math.random()}`,
  exerciseId: row.exerciseId,
  exercise: row.exercise ?? { id: row.exerciseId, name: 'Exercise' },
  targetSets: row.targetSets ?? DEFAULT_ITEM.targetSets,
  targetReps: row.targetReps ?? DEFAULT_ITEM.targetReps,
  restSeconds: row.restSeconds ?? DEFAULT_ITEM.restSeconds,
});

const toPayload = (items) =>
  items.map(({ exerciseId, targetSets, targetReps, restSeconds }) => ({
    exerciseId,
    targetSets,
    targetReps: targetReps.trim() || DEFAULT_ITEM.targetReps,
    restSeconds,
  }));

export default function RoutineBuilderScreen({ navigation, route }) {
  const { user } = useAuth();
  const routineId = route?.params?.routineId ?? null;
  const isEditing = Boolean(routineId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!routineId) return;
    let cancelled = false;
    (async () => {
      try {
        const routine = await fetchRoutine(routineId);
        if (cancelled) return;
        setName(routine.name ?? '');
        setDescription(routine.description ?? '');
        setItems((routine.routineExercises ?? []).map(toItem));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load routine');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  const updateItem = (index, changes) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const moveItem = (index, delta) =>
    setItems((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSelectExercise = (exercise) => {
    setPickerVisible(false);
    if (items.some((item) => item.exerciseId === exercise.id)) return;
    setItems((prev) => [...prev, toItem({ exerciseId: exercise.id, exercise, ...DEFAULT_ITEM })]);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your routine a name');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one exercise');
      return;
    }
    setNameError(null);
    setError(null);
    setSaving(true);
    try {
      if (isEditing) {
        await updateRoutine(routineId, { name: trimmed, description: description.trim() });
        await saveRoutineExercises(routineId, toPayload(items));
      } else {
        await createRoutine({
          userId: user.id,
          name: trimmed,
          description: description.trim() || undefined,
          exercises: toPayload(items),
        });
      }
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Could not save routine');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete routine?', `"${name}" will be removed. Past workouts are kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRoutine(routineId);
            navigation.goBack();
          } catch (err) {
            setError(err.message || 'Could not delete routine');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Routine' : 'New Routine'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Input
            label="Routine name"
            placeholder="e.g. Push Day"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(null);
            }}
            maxLength={100}
            error={nameError}
          />
          <Input
            label="Description (optional)"
            placeholder="Chest, shoulders, triceps"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.sectionHeader}>
            <Text style={typography.h3}>Exercises</Text>
            <Text style={typography.caption}>{items.length}</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="barbell-outline" size={24} color={colors.textMuted} />
              <Text style={typography.caption}>No exercises yet — add some below.</Text>
            </View>
          ) : (
            items.map((item, index) => (
              <View key={item.key} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>
                      {index + 1}. {item.exercise.name}
                    </Text>
                    {item.exercise.primaryMuscle ? (
                      <Text style={typography.caption}>{formatEnum(item.exercise.primaryMuscle)}</Text>
                    ) : null}
                  </View>
                  <IconButton icon="chevron-up" disabled={index === 0} onPress={() => moveItem(index, -1)} />
                  <IconButton
                    icon="chevron-down"
                    disabled={index === items.length - 1}
                    onPress={() => moveItem(index, 1)}
                  />
                  <IconButton icon="trash-outline" color={colors.error} onPress={() => removeItem(index)} />
                </View>

                <View style={styles.fieldRow}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Sets</Text>
                    <View style={styles.stepper}>
                      <IconButton
                        icon="remove"
                        disabled={item.targetSets <= 1}
                        onPress={() => updateItem(index, { targetSets: item.targetSets - 1 })}
                      />
                      <Text style={styles.stepperValue}>{item.targetSets}</Text>
                      <IconButton
                        icon="add"
                        disabled={item.targetSets >= 10}
                        onPress={() => updateItem(index, { targetSets: item.targetSets + 1 })}
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Reps</Text>
                    <TextInput
                      style={styles.repsInput}
                      value={item.targetReps}
                      onChangeText={(text) => updateItem(index, { targetReps: text })}
                      placeholder="8-12"
                      placeholderTextColor={colors.textMuted}
                      maxLength={20}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Rest</Text>
                <View style={styles.restRow}>
                  {REST_OPTIONS.map((seconds) => {
                    const active = item.restSeconds === seconds;
                    return (
                      <Pressable
                        key={seconds}
                        onPress={() => updateItem(index, { restSeconds: seconds })}
                        style={[styles.restChip, active && styles.restChipActive]}
                      >
                        <Text style={[styles.restChipText, active && styles.restChipTextActive]}>
                          {seconds < 120 ? `${seconds}s` : `${seconds / 60}m`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <Button title="Add Exercise" variant="outline" onPress={() => setPickerVisible(true)} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title={isEditing ? 'Save Changes' : 'Create Routine'} onPress={handleSave} loading={saving} />
          {isEditing ? (
            <Button title="Delete Routine" variant="secondary" onPress={handleDelete} loading={deleting} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerVisible}
        selectedExerciseIds={items.map((item) => item.exerciseId)}
        onClose={() => setPickerVisible(false)}
        onSelectExercise={handleSelectExercise}
      />
    </ScreenContainer>
  );
}

function IconButton({ icon, onPress, disabled, color = colors.text }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, disabled && { opacity: 0.3 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 0 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: typography.h3,
  scroll: { paddingBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  exerciseName: { ...typography.body, fontWeight: '600' },
  iconButton: { padding: spacing.xs },
  fieldRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  field: { flex: 1 },
  fieldLabel: { ...typography.caption, marginBottom: spacing.xs },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    height: 40,
  },
  stepperValue: { ...typography.body, fontWeight: '600' },
  repsInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  restRow: { flexDirection: 'row', gap: spacing.sm },
  restChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  restChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  restChipText: { fontSize: 14, color: colors.text },
  restChipTextActive: { color: colors.textInverse, fontWeight: '600' },
  error: { color: colors.error, marginTop: spacing.sm, textAlign: 'center' },
});

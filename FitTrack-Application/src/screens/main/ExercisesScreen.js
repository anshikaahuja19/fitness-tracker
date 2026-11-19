import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, Chip, Input, ScreenContainer, Exercise3DModal } from '../../components';
import AddExerciseModal from '../../components/AddExerciseModal';
import { createExercise, fetchExerciseOptions, fetchExercises } from '../../services/exercises';
import { colors, spacing, typography } from '../../constants/theme';
import { formatEnum } from '../../utils/format';

// Used until /exercises/options responds, so the UI never renders empty pickers.
const FALLBACK_OPTIONS = {
  muscleGroups: ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'CORE', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'FULL_BODY'],
  categories: ['STRENGTH', 'CARDIO', 'FLEXIBILITY', 'BALANCE', 'HIIT', 'OTHER'],
  equipment: ['NONE', 'BARBELL', 'DUMBBELL', 'KETTLEBELL', 'MACHINE', 'CABLE', 'RESISTANCE_BAND', 'OTHER'],
};

const SEARCH_DEBOUNCE_MS = 350;

function ExerciseRow({ exercise, onSelect3D }) {
  const details = [formatEnum(exercise.primaryMuscle), formatEnum(exercise.equipment)].join(' · ');
  return (
    <Card style={styles.row} onPress={() => onSelect3D && onSelect3D(exercise)}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{exercise.name}</Text>
        <View style={styles.badgeGroup}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.badge3D}
            onPress={() => onSelect3D && onSelect3D(exercise)}
          >
            <Text style={styles.badge3DText}>⚡ 3D View</Text>
          </TouchableOpacity>
          {exercise.isCustom ? <Text style={styles.badge}>Custom</Text> : null}
        </View>
      </View>
      <Text style={styles.rowSub}>{details}</Text>
    </Card>
  );
}

export default function ExercisesScreen() {
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected3DExercise, setSelected3DExercise] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    fetchExerciseOptions()
      .then(setOptions)
      .catch(() => {}); // fallback options are fine
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { items } = await fetchExercises({ search: debouncedSearch, muscle });
      setExercises(items);
    } catch (err) {
      setError(err.message);
    }
  }, [debouncedSearch, muscle]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onCreate = async (exercise) => {
    await createExercise(exercise);
    await load();
  };

  const renderEmpty = () => {
    if (loading) return <ActivityIndicator style={styles.state} color={colors.primary} />;
    if (error) {
      return (
        <View style={styles.state}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="outline" size="sm" onPress={load} />
        </View>
      );
    }
    return (
      <Text style={[styles.state, styles.muted]}>
        {debouncedSearch || muscle ? 'No exercises match your filters.' : 'No exercises yet. Add your own!'}
      </Text>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.h2}>Exercises</Text>
        <Button title="+ Custom" size="sm" onPress={() => setModalVisible(true)} style={styles.addButton} />
      </View>

      <Input
        placeholder="Search exercises"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
          {options.muscleGroups.map((m) => (
            <Chip key={m} label={formatEnum(m)} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={loading || error ? [] : exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExerciseRow exercise={item} onSelect3D={setSelected3DExercise} />}
        ListEmptyComponent={renderEmpty}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
      />

      <Exercise3DModal
        visible={!!selected3DExercise}
        exercise={selected3DExercise}
        onClose={() => setSelected3DExercise(null)}
      />

      <AddExerciseModal
        visible={modalVisible}
        options={options}
        onClose={() => setModalVisible(false)}
        onSubmit={onCreate}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  addButton: { marginTop: 0 },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
  row: { marginBottom: spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { ...typography.h3, flexShrink: 1 },
  rowSub: { ...typography.caption, marginTop: spacing.xs },
  badgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge3D: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  badge3DText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    marginLeft: spacing.sm,
  },
  state: { marginTop: spacing.xl, alignItems: 'center', textAlign: 'center' },
  muted: { color: colors.textMuted },
  errorText: { color: colors.error, textAlign: 'center' },
});

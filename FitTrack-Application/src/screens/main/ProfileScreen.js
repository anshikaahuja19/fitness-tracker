import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Input, ScreenContainer } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../services/profile';
import { ROUTES } from '../../constants/routes';
import { colors, spacing, typography } from '../../constants/theme';
import { formatEnum, kgToLbs, lbsToKg } from '../../utils/format';

const GOALS = ['LOSE_WEIGHT', 'BUILD_MUSCLE', 'MAINTAIN', 'IMPROVE_ENDURANCE', 'GENERAL_FITNESS'];
const UNITS = { KG: 'kg', LBS: 'lbs' };

// Display helpers: the API always stores kg; the toggle only changes what the user sees/types.
const toDisplayWeight = (kg, unit) => {
  if (kg === null || kg === undefined) return '';
  const value = unit === UNITS.LBS ? kgToLbs(kg) : kg;
  return String(Math.round(value * 10) / 10);
};

const parseWeight = (text, unit) => {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return NaN;
  const kg = unit === UNITS.LBS ? lbsToKg(value) : value;
  return Math.round(kg * 100) / 100;
};

const parseHeight = (text) => {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : NaN;
};

const formFromUser = (user, unit) => ({
  name: user.name ?? '',
  weight: toDisplayWeight(user.profile?.weightKg, unit),
  targetWeight: toDisplayWeight(user.profile?.targetWeightKg, unit),
  height: user.profile?.heightCm != null ? String(user.profile.heightCm) : '',
  goal: user.profile?.goal ?? null,
});

export default function ProfileScreen({ navigation }) {
  const { signOut, setSession, token } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  // TODO: persist unit preference once a `unitSystem` field is added to UserProfile.
  const [unit, setUnit] = useState(UNITS.KG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile();
      setUser(data);
      setForm(formFromUser(data, UNITS.KG));
      setUnit(UNITS.KG);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field) => (value) => {
    setMessage(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Convert what's typed so switching units never loses the user's edits.
  const switchUnit = (next) => {
    if (next === unit) return;
    setForm((prev) => {
      const convert = (text) => {
        const kg = parseWeight(text, unit);
        return kg === null || Number.isNaN(kg) ? text : toDisplayWeight(kg, next);
      };
      return { ...prev, weight: convert(prev.weight), targetWeight: convert(prev.targetWeight) };
    });
    setUnit(next);
  };

  const save = async () => {
    const weightKg = parseWeight(form.weight, unit);
    const targetWeightKg = parseWeight(form.targetWeight, unit);
    const heightCm = parseHeight(form.height);

    if (!form.name.trim()) return setError('Name cannot be empty');
    if ([weightKg, targetWeightKg, heightCm].some(Number.isNaN)) {
      return setError('Weight and height must be numbers');
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateProfile({
        name: form.name.trim(),
        weightKg,
        targetWeightKg,
        heightCm,
        goal: form.goal,
      });
      setUser(updated);
      // Keep the app-wide user (e.g. the name on Home) in sync with the saved profile.
      setSession({ user: updated, token });
      setForm(formFromUser(updated, unit));
      setMessage('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!form) {
    return (
      <ScreenContainer style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Could not load your profile'}</Text>
        <Button title="Try again" variant="outline" onPress={load} />
        <Button title="Log out" variant="secondary" onPress={signOut} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={typography.h2}>Profile</Text>
          <Text style={styles.email}>{user.email}</Text>

          <Card>
            <Input label="Name" value={form.name} onChangeText={update('name')} maxLength={60} />

            <Text style={styles.label}>Units</Text>
            <View style={styles.row}>
              <Chip label="kg" selected={unit === UNITS.KG} onPress={() => switchUnit(UNITS.KG)} />
              <Chip label="lbs" selected={unit === UNITS.LBS} onPress={() => switchUnit(UNITS.LBS)} />
            </View>

            <View style={styles.row}>
              <Input
                label={`Weight (${unit})`}
                value={form.weight}
                onChangeText={update('weight')}
                keyboardType="decimal-pad"
                containerStyle={styles.half}
              />
              <Input
                label={`Target (${unit})`}
                value={form.targetWeight}
                onChangeText={update('targetWeight')}
                keyboardType="decimal-pad"
                containerStyle={styles.half}
              />
            </View>
            <Input label="Height (cm)" value={form.height} onChangeText={update('height')} keyboardType="decimal-pad" />

            <Text style={styles.label}>Goal</Text>
            <View style={styles.wrap}>
              {GOALS.map((g) => (
                <Chip key={g} label={formatEnum(g)} selected={form.goal === g} onPress={() => update('goal')(form.goal === g ? null : g)} />
              ))}
            </View>
          </Card>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <Button title="Save changes" onPress={save} loading={saving} />
          <Button
            title="Personal Records Showcase"
            variant="outline"
            onPress={() => navigation.navigate(ROUTES.PERSONAL_RECORDS)}
          />
          <Button
            title="View Progress & Analytics"
            variant="outline"
            onPress={() => navigation.navigate(ROUTES.ANALYTICS)}
          />
          <Button title="Log out" variant="outline" onPress={signOut} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  content: { paddingBottom: spacing.xl },
  email: { ...typography.caption, marginTop: spacing.xs, marginBottom: spacing.md },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  errorText: { color: colors.error, textAlign: 'center', marginTop: spacing.sm },
  success: { color: colors.success, textAlign: 'center', marginTop: spacing.sm },
});

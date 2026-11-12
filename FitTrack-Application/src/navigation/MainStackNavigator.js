import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import RoutineBuilderScreen from '../screens/routines/RoutineBuilderScreen';
import { ROUTES } from '../constants/routes';

const Stack = createNativeStackNavigator();

// Tabs at the root, with full-screen flows (like the Routine Builder) pushed on top.
export default function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.MAIN_TABS} component={MainTabNavigator} />
      <Stack.Screen
        name={ROUTES.ROUTINE_BUILDER}
        component={RoutineBuilderScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

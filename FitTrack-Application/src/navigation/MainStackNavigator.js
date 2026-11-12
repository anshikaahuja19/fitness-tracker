import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import RoutineBuilderScreen from '../screens/routines/RoutineBuilderScreen';
import WorkoutHistoryScreen from '../screens/workouts/WorkoutHistoryScreen';
import { ROUTES } from '../constants/routes';

const Stack = createNativeStackNavigator();

export default function MainStackNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name={ROUTES.MAIN_TABS} component={MainTabNavigator} />
            <Stack.Screen
                name={ROUTES.ROUTINE_BUILDER}
                component={RoutineBuilderScreen}
                options={{ presentation: 'modal' }}
            />
            <Stack.Screen
                name={ROUTES.WORKOUT_HISTORY}
                component={WorkoutHistoryScreen}
            />
        </Stack.Navigator>
    );
}

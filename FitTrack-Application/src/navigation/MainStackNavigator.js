import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import RoutineBuilderScreen from '../screens/routines/RoutineBuilderScreen';
import WorkoutHistoryScreen from '../screens/workouts/WorkoutHistoryScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import PersonalRecordsScreen from '../screens/prs/PersonalRecordsScreen';
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
            <Stack.Screen
                name={ROUTES.ANALYTICS}
                component={AnalyticsScreen}
            />
            <Stack.Screen
                name={ROUTES.PERSONAL_RECORDS}
                component={PersonalRecordsScreen}
            />
        </Stack.Navigator>
    );
}

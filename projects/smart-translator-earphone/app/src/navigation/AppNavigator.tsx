import React from 'react';
import { NavigationContainer, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ConversationScreen } from '../screens/ConversationScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LectureScreen } from '../screens/LectureScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { COLORS } from '../theme/colors';

export type RootStackParamList = {
  Home: undefined;
  Conversation: undefined;
  Lecture: undefined;
  Settings: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    primary: COLORS.primary,
    border: COLORS.border,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.surface },
          headerTitleStyle: { color: COLORS.text },
          headerTintColor: COLORS.text,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Smart Translator' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversation' }} />
        <Stack.Screen name="Lecture" component={LectureScreen} options={{ title: 'Lecture' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

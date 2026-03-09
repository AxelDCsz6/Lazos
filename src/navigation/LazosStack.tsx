import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LazosStackParamList } from '../types';
import { LazosListScreen } from '../screens/lazos/LazosListScreen';

const Stack = createNativeStackNavigator<LazosStackParamList>();

export function LazosStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="LazosList"
        component={LazosListScreen}
        options={{ title: 'Mis Lazos' }}
      />
      {/* Sprint 2: InviteCode, JoinLazo */}
      {/* Sprint 3: Chat */}
    </Stack.Navigator>
  );
}

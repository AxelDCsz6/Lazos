import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppTabParamList } from '../types';
import { LazosListScreen } from '../screens/lazos/LazosListScreen';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Sin tab bar — navegación via modales
      }}>
      <Tab.Screen name="Lazos" component={LazosListScreen} />
    </Tab.Navigator>
  );
}

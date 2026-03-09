import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';
import { RootStackParamList } from '../types';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
/*  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Root.Screen name="App" component={AppTabs} />
        ) : (
          <Root.Screen name="Auth" component={AuthStack} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
*/
// descomentar cuando sea necesario usar ahora si la autenticacion, por el momento durante el desarrollo por comodidad se hara simplemente asi
return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        <Root.Screen name="App" component={AppTabs} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

import React from 'react';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AuthProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FDF6EE" />
          <RootNavigator />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

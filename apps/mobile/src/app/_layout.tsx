import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../modules/auth/context/AuthContext';
import { getConfigurationError } from '../shared/config/env';
import { Page, H1, Notice } from '../shared/components/UI';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../shared/theme/colors';
export default function Root(){const error=getConfigurationError();if(error)return <SafeAreaProvider><SafeAreaView style={{flex:1}}><Page><H1>Configuración pendiente</H1><Notice message={error}/></Page></SafeAreaView></SafeAreaProvider>;return <AuthProvider><StatusBar style="dark"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.white},headerTintColor:colors.black,headerTitleStyle:{fontWeight:'800'},contentStyle:{backgroundColor:colors.background}}}><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="route/[id]" options={{title:'Detalle de ruta'}}/><Stack.Screen name="auth" options={{title:'Mi cuenta'}}/></Stack></AuthProvider>}

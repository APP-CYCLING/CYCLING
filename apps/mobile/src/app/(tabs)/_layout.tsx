import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../shared/theme/colors';
export default function TabsLayout(){return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:colors.background}}><Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.greenDark,tabBarInactiveTintColor:colors.muted,tabBarStyle:{height:65,paddingTop:6,paddingBottom:9,backgroundColor:colors.white},tabBarLabelStyle:{fontSize:11,fontWeight:'700'}}}>
<Tabs.Screen name="index" options={{title:'Inicio',tabBarIcon:({color,size})=><Ionicons name="home-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="explore" options={{title:'Explorar',tabBarIcon:({color,size})=><Ionicons name="map-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="ride" options={{title:'Pedalear',tabBarIcon:({color,size})=><Ionicons name="bicycle-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="activity" options={{title:'Actividad',tabBarIcon:({color,size})=><Ionicons name="stats-chart-outline" color={color} size={size}/>}}/>
<Tabs.Screen name="profile" options={{title:'Perfil',tabBarIcon:({color,size})=><Ionicons name="person-outline" color={color} size={size}/>}}/>
</Tabs></SafeAreaView>}

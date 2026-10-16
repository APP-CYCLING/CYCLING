import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { CyclingRoute } from '@cycling/contracts';
import { colors } from '../../../shared/theme/colors';
import { Panel } from '../../../shared/components/UI';
const diff={easy:'Fácil',moderate:'Intermedia',hard:'Exigente'};
export function RouteCard({route}:{route:CyclingRoute}){return <Pressable onPress={()=>router.push({pathname:'/route/[id]',params:{id:route.id}})}><Panel><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:18,fontWeight:'800',color:colors.black,flex:1}}>{route.title}</Text><Text style={{fontSize:11,backgroundColor:colors.softGreen,color:colors.greenDark,padding:7,borderRadius:10}}>{diff[route.difficulty]}</Text></View><Text style={{color:colors.muted}} numberOfLines={2}>{route.description}</Text><View style={{flexDirection:'row',gap:16,marginTop:5}}><Text style={{fontWeight:'700'}}>🚴 {route.distanceKm} km</Text><Text style={{color:colors.muted}}>◷ {route.durationMin} min</Text><Text style={{color:colors.muted}}>↗ {route.ascentM} m</Text></View>{route.isDemo&&<Text style={{color:'#9D6A16',fontSize:12}}>⚠ Trazado de demostración, no verificado</Text>}</Panel></Pressable>}

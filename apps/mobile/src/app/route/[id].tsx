import React,{useEffect,useState} from 'react';
import { Text,View } from 'react-native';
import { useLocalSearchParams,router } from 'expo-router';
import type { CyclingRoute } from '@cycling/contracts';
import { Page,H1,Subtitle,Panel,PrimaryButton,Busy,Notice } from '../../shared/components/UI';
import { routesService } from '../../modules/routes/services/routes.service';
import { CyclingMap } from '../../modules/maps/components/CyclingMap';
export default function Detail(){const {id}=useLocalSearchParams<{id:string}>();const [route,setRoute]=useState<CyclingRoute|null>(null),[error,setError]=useState('');useEffect(()=>{if(id)routesService.get(id).then(setRoute).catch(e=>setError(e.message))},[id]);
return <Page>{route?<><H1>{route.title}</H1><Subtitle>{route.description}</Subtitle><View style={{marginTop:20}}><CyclingMap routes={[route]} showUser={false} height={370}/></View><View style={{marginTop:18}}><Panel><Text style={{fontSize:19,fontWeight:'800'}}>🚴 {route.distanceKm} km  ·  ◷ {route.durationMin} min</Text><Text>Desnivel acumulado estimado: {route.ascentM} m</Text><Text>Dificultad: {route.difficulty}</Text></Panel></View>{route.isDemo&&<View style={{marginTop:14}}><Notice message="Esta ruta es un trazado sintético de prueba. No es una indicación segura para circular."/></View>}<View style={{marginTop:16}}><PrimaryButton title="Registrar un recorrido" onPress={()=>router.replace('/ride')}/></View></>:error?<Notice message={error}/>:<Busy/>}</Page>}

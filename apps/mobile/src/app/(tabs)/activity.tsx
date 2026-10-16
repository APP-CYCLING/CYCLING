import React,{useCallback,useState} from 'react';
import { Text } from 'react-native';
import { useFocusEffect,router } from 'expo-router';
import type { Ride } from '@cycling/contracts';
import { Page,H1,Subtitle,Panel,PrimaryButton,Section,Busy,Notice } from '../../shared/components/UI';
import { ridesService } from '../../modules/rides/services/rides.service';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { colors } from '../../shared/theme/colors';
export default function Activity(){const {user}=useAuth();return <ActivityContent key={user?.id??'guest'}/>;}
function ActivityContent(){const {user}=useAuth(),[rides,setRides]=useState<Ride[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useFocusEffect(useCallback(()=>{
 let current=true;
 setRides([]);setError('');setLoading(Boolean(user));
 if(user)ridesService.list().then(data=>{if(current)setRides(data)}).catch((e:unknown)=>{if(current)setError(e instanceof Error?e.message:'No se pudo cargar el historial.')}).finally(()=>{if(current)setLoading(false)});
 return ()=>{current=false};
},[user?.id]));
return <Page><H1>Mis recorridos</H1><Subtitle>Todos tus kilómetros en un solo lugar.</Subtitle>{!user?<Panel style={{marginTop:22}}><Text>Inicia sesión para guardar y consultar tus recorridos.</Text><PrimaryButton title="Iniciar sesión" onPress={()=>router.push('/auth')}/></Panel>:loading?<Busy/>:error?<Notice message={error}/>:<Section title={`${rides.length} actividades`}>{rides.length===0?<Notice message="Aún no tienes recorridos guardados. ¡Empieza a pedalear!"/>:rides.map(r=><Panel key={r.id}><Text style={{fontWeight:'800',fontSize:17}}>🚴 {r.distanceKm.toFixed(2)} km</Text><Text style={{color:colors.muted}}>{new Date(r.startedAt).toLocaleDateString()} · {Math.round(r.durationSec/60)} minutos</Text></Panel>)}</Section>}</Page>}

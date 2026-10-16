import React,{useEffect,useState} from 'react';
import { View,Text } from 'react-native';
import { router } from 'expo-router';
import type { CyclingRoute } from '@cycling/contracts';
import { Page,H1,Subtitle,Section,Panel,PrimaryButton,Busy,Notice } from '../../shared/components/UI';
import { colors } from '../../shared/theme/colors';
import { routesService } from '../../modules/routes/services/routes.service';
import { RouteCard } from '../../modules/routes/components/RouteCard';
export default function Home(){const [routes,setRoutes]=useState<CyclingRoute[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{routesService.list().then(setRoutes).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
return <Page><Text style={{color:colors.greenDark,fontWeight:'800',letterSpacing:3}}>CYCLING</Text><H1>Tu ciudad, a tu ritmo.</H1><Subtitle>Explora nuevos caminos y registra cada kilómetro.</Subtitle><View style={{marginTop:22}}><Panel style={{backgroundColor:colors.green,borderWidth:0,padding:23}}><Text style={{fontSize:40}}>🚴‍♀️</Text><Text style={{fontSize:26,fontWeight:'900',color:colors.black}}>¿Salimos a rodar?</Text><Text style={{color:colors.black,lineHeight:20}}>Descubre recorridos y empieza a pedalear.</Text><PrimaryButton title="Comenzar recorrido →" onPress={()=>router.push('/ride')} outline/></Panel></View>
<Section title="Rutas para explorar">{loading?<Busy/>:error?<Notice message={error}/>:routes.length?routes.slice(0,3).map(r=><RouteCard key={r.id} route={r}/>):<Notice message="Todavía no hay rutas disponibles."/>}</Section><Text style={{color:colors.muted,fontSize:12,marginTop:22}}>Las rutas demo no están verificadas para uso real.</Text></Page>}

import React from 'react';
import { Text,View } from 'react-native';
import { router } from 'expo-router';
import { Page,H1,Subtitle,Panel,PrimaryButton } from '../../shared/components/UI';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { colors } from '../../shared/theme/colors';
export default function Profile(){const {user,logout}=useAuth();return <Page><H1>Mi perfil</H1><Subtitle>Tu experiencia cycling.</Subtitle><View style={{marginTop:25}}><Panel><View style={{backgroundColor:colors.softGreen,width:66,height:66,borderRadius:33,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:29}}>🚴</Text></View><Text style={{fontWeight:'900',fontSize:22}}>{user?.name||'Ciclista invitado'}</Text><Text style={{color:colors.muted}}>{user?.email||'Explora libremente; inicia sesión para guardar tus actividades.'}</Text><PrimaryButton title={user?'Cerrar sesión':'Crear cuenta / iniciar sesión'} onPress={()=>user?logout():router.push('/auth')}/></Panel></View><Text style={{color:colors.muted,marginTop:25}}>cycling · MVP 0.1.0</Text></Page>}

import React,{createContext,useCallback,useContext,useEffect,useState} from 'react';
import { AppState, Platform } from 'react-native';
import { Busy, Notice, Page, PrimaryButton } from '../../../shared/components/UI';
import type {LoginInput,RegisterInput,User} from '@cycling/contracts';
import {getSupabase} from '../../../shared/supabase/client';
import {authService,sessionToUser} from '../services/auth.service';
type AuthContextType={user:User|null;ready:boolean;login:(d:LoginInput)=>Promise<void>;register:(d:RegisterInput)=>Promise<boolean>;logout:()=>Promise<void>};
const Context=createContext<AuthContextType|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [ready,setReady]=useState(false);
 const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let mounted=true;
  let authChanged=false;
  setReady(false);setError('');
  const auth=getSupabase().auth;
  const {data:{subscription}}=auth.onAuthStateChange((_event,session)=>{if(mounted){authChanged=true;setUser(sessionToUser(session))}});
  auth.getSession().then(({data,error:sessionError})=>{
   if(sessionError)throw sessionError;
   if(mounted&&!authChanged)setUser(sessionToUser(data.session));
  }).catch((e:unknown)=>{if(mounted)setError(e instanceof Error?e.message:'No se pudo restaurar la sesión.');}).finally(()=>{if(mounted)setReady(true)});
  const refresh=(state:string)=>{if(state==='active')auth.startAutoRefresh();else auth.stopAutoRefresh()};
  if(Platform.OS!=='web')refresh(AppState.currentState);
  const listener=Platform.OS!=='web'?AppState.addEventListener('change',refresh):null;
  return ()=>{mounted=false;subscription.unsubscribe();listener?.remove();if(Platform.OS!=='web')auth.stopAutoRefresh()};
 },[attempt]);
 const login=useCallback(async(d:LoginInput)=>{await authService.login(d)},[]);
 const register=useCallback(async(d:RegisterInput)=>{const result=await authService.register(d);return result.needsConfirmation},[]);
 const logout=useCallback(async()=>{await authService.logout()},[]);
 if(!ready)return <Page><Busy/></Page>;
 if(error)return <Page><Notice message={error}/><PrimaryButton title="Reintentar" onPress={()=>setAttempt(v=>v+1)}/></Page>;
 return <Context.Provider value={{user,ready,login,register,logout}}>{children}</Context.Provider>;
}
export function useAuth(){const v=useContext(Context);if(!v)throw new Error('AuthProvider missing');return v}

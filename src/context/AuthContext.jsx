import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const C=createContext(null)

const shapeUser=async authUser=>{
  if(!authUser) return null
  const {data}=await supabase.from('profiles').select('full_name').eq('id',authUser.id).maybeSingle()
  return {id:authUser.id,email:authUser.email,name:data?.full_name||authUser.user_metadata?.full_name||authUser.email?.split('@')[0]||'Usuário'}
}

export function AuthProvider({children}){
 const [user,setUser]=useState(null)
 const [loading,setLoading]=useState(Boolean(supabase))

 useEffect(()=>{
   if(!supabase){setLoading(false);return}
   let active=true
   supabase.auth.getSession().then(async({data})=>{
     if(active)setUser(await shapeUser(data.session?.user))
     if(active)setLoading(false)
   })
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
     setTimeout(async()=>{
       if(active)setUser(await shapeUser(session?.user))
       if(active)setLoading(false)
     },0)
   })
   return()=>{active=false;subscription.unsubscribe()}
 },[])

 const login=async({email,password})=>{
   if(!supabase) throw new Error('Supabase não está configurado.')
   const {data,error}=await supabase.auth.signInWithPassword({email,password})
   if(error) throw error
   const u=await shapeUser(data.user)
   setUser(u)
   return u
 }

 const register=async({name,email,password})=>{
   if(!supabase) throw new Error('Supabase não está configurado.')
   const emailRedirectTo='https://ajude-e-ganhe.netlify.app/painel'
   const {data,error}=await supabase.auth.signUp({
     email,
     password,
     options:{
       data:{full_name:name},
       emailRedirectTo
     }
   })
   if(error) throw error
   const u=data.session?await shapeUser(data.user):null
   if(u)setUser(u)
   return {user:u,needsConfirmation:!data.session}
 }

 const logout=async()=>{
   if(supabase) await supabase.auth.signOut()
   setUser(null)
 }

 return <C.Provider value={useMemo(()=>({user,loading,login,register,logout}),[user,loading])}>{children}</C.Provider>
}
export const useAuth=()=>useContext(C)

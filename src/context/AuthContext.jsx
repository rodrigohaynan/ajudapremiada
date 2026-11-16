import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isValidCpf, isValidMobile, onlyDigits } from '../utils/registration'

const C=createContext(null)
const PUBLIC_SITE_URL='https://ajudeeganhe.com.br'

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

 const register=async({name,email,cpf,phone,password})=>{
   if(!supabase) throw new Error('Supabase não está configurado.')
   const fullName=String(name||'').trim().replace(/\s+/g,' ')
   const cpfDigits=onlyDigits(cpf)
   const phoneDigits=onlyDigits(phone)
   if(fullName.length<3 || !fullName.includes(' '))throw new Error('Informe seu nome e sobrenome.')
   if(!isValidCpf(cpfDigits))throw new Error('O CPF informado é inválido.')
   if(!isValidMobile(phoneDigits))throw new Error('Informe um celular válido com DDD.')
   if(String(password||'').length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.')
   const emailRedirectTo=PUBLIC_SITE_URL+'/painel'
   const {data,error}=await supabase.auth.signUp({
     email:String(email||'').trim().toLowerCase(),
     password,
     options:{
       data:{full_name:fullName,cpf:cpfDigits,phone:phoneDigits},
       emailRedirectTo
     }
   })
   if(error) {
     if(/database error/i.test(error.message||'')) {
       throw new Error('Não foi possível concluir o cadastro. Verifique seus dados ou utilize outro e-mail.')
     }
     throw error
   }
   const u=data.session?await shapeUser(data.user):null
   if(u)setUser(u)
   return {user:u,needsConfirmation:!data.session}
 }

 const requestPasswordReset=async email=>{
   if(!supabase)throw new Error('Supabase não está configurado.')
   const normalized=String(email||'').trim().toLowerCase()
   if(!normalized)throw new Error('Informe seu e-mail para recuperar a senha.')
   const redirectTo=PUBLIC_SITE_URL+'/redefinir-senha'
   const {error}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo})
   if(error)throw error
 }

 const changePassword=async password=>{
   if(!supabase)throw new Error('Supabase não está configurado.')
   const {error}=await supabase.auth.updateUser({password})
   if(error)throw error
   await supabase.auth.signOut()
   setUser(null)
 }

 const logout=async()=>{
   if(supabase) await supabase.auth.signOut()
   setUser(null)
 }

 return <C.Provider value={useMemo(()=>({user,loading,login,register,logout,requestPasswordReset,changePassword}),[user,loading])}>{children}</C.Provider>
}
export const useAuth=()=>useContext(C)

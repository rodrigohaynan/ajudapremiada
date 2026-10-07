import { createContext, useContext, useMemo, useState } from 'react'
const C=createContext(null),KEY='ap:session'
const initial=()=>{try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}}
export function AuthProvider({children}){
 const [user,setUser]=useState(initial)
 const login=async({email})=>{const name=(email?.split('@')[0]||'Usuário').replace(/[._-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase());const u={id:`local-${btoa(email||'demo').replace(/=/g,'')}`,name,email};localStorage.setItem(KEY,JSON.stringify(u));setUser(u);return u}
 const register=async({name,email})=>{const u={id:`local-${Date.now()}`,name,email};localStorage.setItem(KEY,JSON.stringify(u));setUser(u);return u}
 const logout=()=>{localStorage.removeItem(KEY);setUser(null)}
 return <C.Provider value={useMemo(()=>({user,login,register,logout}),[user])}>{children}</C.Provider>
}
export const useAuth=()=>useContext(C)

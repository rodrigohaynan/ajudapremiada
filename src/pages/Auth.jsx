import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Layout'

export default function Auth(){
 const {login,register}=useAuth(),nav=useNavigate()
 const [mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 const submit=async e=>{
   e.preventDefault();setError('');setNotice('');setBusy(true)
   try{
     if(mode==='login'){await login({email,password});nav('/painel')}
     else{
       const result=await register({name,email,password})
       if(result.needsConfirmation)setNotice('Conta criada. Confirme seu e-mail para entrar no Ajude e Ganhe.')
       else nav('/painel')
     }
   }catch(err){setError(err.message||'Não foi possível entrar.')}
   finally{setBusy(false)}
 }
 return <main className="auth"><section className="authSide"><div><span>♥</span><h1>Ajude causas.<br/>Acompanhe números.<br/>Crie campanhas.</h1><p>O Ajude e Ganhe reúne tudo em uma experiência simples e organizada.</p></div></section><section className="authForm"><div className="authBox"><Logo/><span className="eyebrow">{mode==='login'?'BEM-VINDO DE VOLTA':'CRIE SUA CONTA'}</span><h2>{mode==='login'?'Entre na sua conta':'Comece no Ajude e Ganhe'}</h2><p>{mode==='login'?'Acesse suas participações e campanhas.':'Participe, acompanhe e crie suas próprias campanhas.'}</p><form onSubmit={submit}>{mode==='register'&&<label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)}/></label>}<label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}<button disabled={busy} className="btn primary wide">{busy?'Aguarde...':mode==='login'?'Entrar':'Criar conta'}</button></form><p className="switch">{mode==='login'?'Ainda não tem conta?':'Já tem conta?'} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setNotice('')}}>{mode==='login'?'Cadastre-se':'Entrar'}</button></p><small className="prototype">Conta protegida pelo Supabase Auth. As campanhas e participações ficam vinculadas ao seu usuário.</small><Link className="back" to="/">← Voltar ao início</Link></div></section></main>
}
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Logo(){return <Link to="/" className="logo"><span>♥</span><div><strong>Ajuda</strong> Premiada<small>ajudar pode transformar</small></div></Link>}
export default function Layout(){const {user,logout}=useAuth();const [open,setOpen]=useState(false);return <>
<header><div className="shell nav"><Logo/><button className="hamb" onClick={()=>setOpen(!open)}>☰</button><nav className={open?'open':''} onClick={()=>setOpen(false)}><NavLink to="/explorar">Explorar</NavLink><NavLink to="/como-funciona">Como funciona</NavLink><Link to="/criar" className="btn ghost">+ Criar ajuda</Link>{user?<><Link to="/painel" className="avatar">{user.name?.[0]||'U'}</Link><button className="linkbtn" onClick={logout}>Sair</button></>:<Link to="/entrar" className="btn primary">Entrar</Link>}</nav></div></header>
<Outlet/>
<footer><div className="shell foot"><div><Logo/><p>Conectando causas, pessoas e campanhas com transparência.</p></div><div><b>Plataforma</b><Link to="/explorar">Campanhas</Link><Link to="/criar">Criar campanha</Link><Link to="/como-funciona">Como funciona</Link></div><div><b>Importante</b><p>No MVP, pagamentos são feitos diretamente ao organizador. A plataforma não custodia valores nem executa o sorteio.</p></div></div></footer>
</>}

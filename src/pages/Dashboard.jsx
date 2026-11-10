import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dataService } from '../services/dataService'
import CampaignCard,{money} from '../components/CampaignCard'

const statusLabel={
  pending_payment:'Aguardando pagamento',
  paid:'Pagamento confirmado',
  expired:'Reserva expirada',
  cancelled:'Cancelada',
  refunded:'Reembolsada'
}

export default function Dashboard(){
 const {user,loading}=useAuth()
 const [tab,setTab]=useState('parts'),[parts,setParts]=useState([]),[owned,setOwned]=useState([]),[error,setError]=useState('')
 useEffect(()=>{
   if(!user)return
   Promise.all([dataService.listParticipations(user.id),dataService.listOwnedCampaigns(user.id)])
     .then(([p,o])=>{setParts(p);setOwned(o);setError('')})
     .catch(err=>setError(err.message||'Não foi possível carregar sua conta.'))
 },[user])
 if(loading)return <main className="shell page"><div className="empty"><b>…</b><h1>Carregando sua conta</h1></div></main>
 if(!user)return <main className="shell page"><div className="empty"><b>🔒</b><h1>Área do usuário</h1><Link className="btn primary" to="/entrar">Entrar</Link></div></main>
 return <main className="dash"><div className="shell">
   <section className="dashHero"><div><span className="eyebrow light">MINHA CONTA</span><h1>Olá, {user.name?.split(' ')[0]} 👋</h1><p>Acompanhe suas ajudas e organize suas campanhas.</p></div><Link className="btn white" to="/criar">+ Nova campanha</Link></section>
   {error&&<div className="error">{error}</div>}
   <div className="tabs"><button className={tab==='parts'?'active':''} onClick={()=>setTab('parts')}>Minhas participações <b>{parts.length}</b></button><button className={tab==='owned'?'active':''} onClick={()=>setTab('owned')}>Minhas campanhas <b>{owned.length}</b></button></div>
   {tab==='parts'
     ?<section className="list">{parts.map(p=><article className="participation" key={p.id}><span>♥</span><div><small>AJUDA REGISTRADA</small><h3>{p.campaign?.title||'Campanha'}</h3><p>Números: <b>{p.numbers.map(n=>String(n).padStart(3,'0')).join(', ')}</b></p></div><aside><i>{statusLabel[p.status]||p.status}</i><b>{money(p.amount)}</b>{p.campaign&&<Link to={`/campanha/${p.campaign.slug}`}>Abrir campanha →</Link>}</aside></article>)}{!parts.length&&<Empty text="Você ainda não participou de nenhuma campanha." link="/explorar" action="Explorar campanhas"/>}</section>
     :<section className="grid dashGrid">{owned.map(c=><CampaignCard key={c.id} campaign={c}/>)}{!owned.length&&<Empty text="Você ainda não criou uma campanha." link="/criar" action="Criar minha primeira ajuda"/>}</section>}
 </div></main>
}
function Empty({text,link,action}){return <div className="empty span"><b>♥</b><h2>{text}</h2><Link className="btn primary" to={link}>{action}</Link></div>}

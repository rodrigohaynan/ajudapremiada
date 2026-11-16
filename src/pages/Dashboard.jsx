import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dataService } from '../services/dataService'
import CampaignCard,{money} from '../components/CampaignCard'
import MercadoPagoConnect from '../components/MercadoPagoConnect'
import PaymentReview from '../components/PaymentReview'
import { formatMobile, isValidMobile } from '../utils/registration'

const statusLabel={
  pending_payment:'Aguardando pagamento',
  proof_review:'Comprovante em análise',
  paid:'Pagamento confirmado',
  expired:'Reserva expirada',
  cancelled:'Cancelada',
  refunded:'Reembolsada'
}

export default function Dashboard(){
 const {user,loading}=useAuth()
 const [tab,setTab]=useState(()=>new URLSearchParams(window.location.search).get('tab')==='owned'?'owned':'parts'),[parts,setParts]=useState([]),[owned,setOwned]=useState([]),[error,setError]=useState('')
 const [contact,setContact]=useState(null)
 const [contactPhone,setContactPhone]=useState('')
 const [contactError,setContactError]=useState('')
 const [contactBusy,setContactBusy]=useState(false)
 const [contactNotice,setContactNotice]=useState('')
 useEffect(()=>{
   if(!user)return
   Promise.all([
     dataService.listParticipations(user.id),
     dataService.listOwnedCampaigns(user.id),
     dataService.getParticipationContactStatus()
   ])
     .then(([p,o,c])=>{setParts(p);setOwned(o);setContact(c);setError('')})
     .catch(err=>setError(err.message||'Não foi possível carregar sua conta.'))
 },[user])
 const saveContactPhone=async event=>{
   event.preventDefault()
   setContactError('')
   setContactNotice('')
   if(!isValidMobile(contactPhone)){
     setContactError('Informe um celular válido, com DDD e nove dígitos.')
     return
   }
   setContactBusy(true)
   try{
     await dataService.setParticipationContactPhone(contactPhone)
     const [newStatus,updatedParts]=await Promise.all([
       dataService.getParticipationContactStatus(),
       dataService.listParticipations(user.id)
     ])
     setContact(newStatus)
     setParts(updatedParts)
     setContactPhone('')
     setContactNotice('Celular registrado. Suas participações sem login foram conferidas automaticamente.')
   }catch(err){
     setContactError(err.message||'Não foi possível salvar o celular.')
   }finally{setContactBusy(false)}
 }
 if(loading)return <main className="shell page"><div className="empty"><b>…</b><h1>Carregando sua conta</h1></div></main>
 if(!user)return <main className="shell page"><div className="empty"><b>🔒</b><h1>Área do usuário</h1><Link className="btn primary" to="/entrar">Entrar</Link></div></main>
 return <main className="dash"><div className="shell">
   <section className="dashHero"><div><span className="eyebrow light">MINHA CONTA</span><h1>Olá, {user.name?.split(' ')[0]} 👋</h1><p>Acompanhe suas ajudas e organize suas campanhas.</p></div><Link className="btn white" to="/criar">+ Nova campanha</Link></section>
   {error&&<div className="error">{error}</div>}
   <div className="tabs"><button className={tab==='parts'?'active':''} onClick={()=>setTab('parts')}>Minhas participações <b>{parts.length}</b></button><button className={tab==='owned'?'active':''} onClick={()=>setTab('owned')}>Minhas campanhas <b>{owned.length}</b></button></div>
   {tab==='owned' && <><MercadoPagoConnect user={user} /><PaymentReview /></>}
   {tab==='parts' && contact && !contact.configured && <section className="guestLinkCard">
     <div>
       <span className="eyebrow">PARTICIPAÇÕES SEM LOGIN</span>
       <h2>Reúna todas as suas participações</h2>
       <p>Em contas antigas, o celular não era informado no cadastro. Informe uma vez o seu celular com DDD para identificar automaticamente reservas feitas sem login, quando e-mail, celular e nome forem compatíveis.</p>
       {contact.emailVerified ? <form onSubmit={saveContactPhone} className="guestLinkForm">
         <label>Celular com DDD
           <input type="tel" inputMode="tel" autoComplete="tel-national" required
             placeholder="(67) 99999-9999" maxLength={15}
             value={contactPhone} onChange={e=>setContactPhone(formatMobile(e.target.value))}/>
         </label>
         <button className="btn primary" type="submit" disabled={contactBusy}>
           {contactBusy?'Conferindo…':'Salvar e identificar'}
         </button>
       </form> : <p>Confirme seu endereço de e-mail para habilitar a identificação segura das participações.</p>}
       {contactError && <div className="error" role="alert">{contactError}</div>}
     </div>
   </section>}
   {tab==='parts' && contactNotice && <p className="guestLinkNotice" role="status">{contactNotice}</p>}
   {tab==='parts'
     ?<section className="list">{parts.map(p=><article className="participation" key={p.id}><span>♥</span><div><small>{p.identifiedFromGuest?'PARTICIPAÇÃO IDENTIFICADA SEM LOGIN':'AJUDA REGISTRADA'}</small><h3>{p.campaign?.title||'Campanha'}</h3><p>Números: <b>{p.numbers.map(n=>String(n).padStart(3,'0')).join(', ')}</b></p></div><aside><i>{statusLabel[p.status]||p.status}</i><b>{money(p.amount)}</b>{p.campaign&&<Link to={`/campanha/${p.campaign.slug}`}>Abrir campanha →</Link>}</aside></article>)}{!parts.length&&<Empty text="Você ainda não participou de nenhuma campanha." link="/explorar" action="Explorar campanhas"/>}</section>
     :<section className="grid dashGrid">{owned.map(c=><div className={'ownedCard '+(c.status==='archived'?'ownedArchived':'')} key={c.id}>
      {c.status==='archived'&&<div className="archivedTag">📁 Arquivada — somente consulta</div>}
      <CampaignCard campaign={c}/>
      <div className="ownedActions">
        {c.status==='archived'
          ? <Link className="btn ghost" to={'/campanha/'+c.slug}>Consultar histórico</Link>
          : <><Link className="btn primary" to={'/campanha/'+c.slug+'/editar'}>✎ Editar / gerenciar</Link>
              <Link className="btn ghost" to={'/campanha/'+c.slug}>Visualizar</Link></>}
      </div>
    </div>)}{!owned.length&&<Empty text="Você ainda não criou uma campanha." link="/criar" action="Criar minha primeira ajuda"/>}</section>}
 </div></main>
}
function Empty({text,link,action}){return <div className="empty span"><b>♥</b><h2>{text}</h2><Link className="btn primary" to={link}>{action}</Link></div>}

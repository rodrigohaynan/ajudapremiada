import { useEffect, useState } from 'react'
import { dataService } from '../services/dataService'
import { money } from './CampaignCard'

export default function PaymentReview(){
 const [items,setItems]=useState([])
 const [busy,setBusy]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const load=async()=>{
  setLoading(true);setError('')
  try{setItems(await dataService.listPendingManualReceipts())}
  catch(e){setError(e.message||'Não foi possível carregar os comprovantes.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{load()},[])
 const decide=async(item,decision)=>{
  const approve=decision==='confirmed'
  if(!window.confirm(approve?
     'Você conferiu o recebimento do Pix no extrato e deseja marcar esses números como PAGOS?':
     'Deseja rejeitar o comprovante e liberar os números desta reserva?'))return
  setBusy(item.participation_id);setNotice('');setError('')
  try{
   await dataService.reviewManualReceipt(item.participation_id,decision)
   setItems(current=>current.filter(x=>x.participation_id!==item.participation_id))
   setNotice(approve?'Pagamento confirmado. Números registrados como pagos.':'Comprovante rejeitado. Números liberados.')
  }catch(e){setError(e.message||'Não foi possível analisar o comprovante.')}
  finally{setBusy('')}
 }
 return <section className="paymentReview">
  <div className="paymentReviewTop">
   <div><h2>Comprovantes para conferir</h2><p>Confira o recebimento no extrato bancário antes de confirmar.</p></div>
   <button className="btn ghost" type="button" disabled={loading} onClick={load}>Atualizar lista</button>
  </div>
  {loading&&<p>Carregando comprovantes…</p>}
  {error&&<div className="error">{error}</div>}
  {notice&&<div className="success">{notice}</div>}
  {!loading&&!items.length&&<p className="paymentEmpty">Nenhum comprovante aguardando análise.</p>}
  <div className="paymentReviewGrid">
  {items.map(item=><article key={item.participation_id} className="paymentReviewCard">
    <small>{item.campaign_title}</small>
    <h3>{item.full_name}</h3>
    <p>{item.email} · ({item.ddd}) {item.phone}</p>
    <p>Números: <b>{(item.numbers||[]).map(n=>String(n).padStart(3,'0')).join(', ')}</b></p>
    <p>Valor informado: <b>{money(item.amount)}</b></p>
    <p>Prazo para análise: <b>{new Date(item.expires_at).toLocaleString('pt-BR')}</b></p>
    {item.proofUrl
      ? <a className="btn ghost" href={item.proofUrl} target="_blank" rel="noopener noreferrer">Ver comprovante</a>
      : <span className="error">Link temporário indisponível. Atualize a lista.</span>}
    <div className="paymentReviewButtons">
      <button type="button" className="btn primary" disabled={Boolean(busy)} onClick={()=>decide(item,'confirmed')}>Confirmar recebimento</button>
      <button type="button" className="btn ghost" disabled={Boolean(busy)} onClick={()=>decide(item,'rejected')}>Rejeitar e liberar</button>
    </div>
  </article>)}
  </div>
 </section>
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dataService } from '../services/dataService'
import { money } from './CampaignCard'

export default function ManualProofForm({reservation,user,onChange,onReset}){
  const [file,setFile]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [note,setNote]=useState('')
  const expired=reservation.status==='expired'||(['pending_payment','proof_review'].includes(reservation.status)&&Date.parse(reservation.expiresAt)<=Date.now())
  const pending=reservation.status==='pending_payment'&&!expired
  const inReview=reservation.status==='proof_review'&&!expired
  const confirmed=reservation.status==='paid'
  const showPix=pending&&reservation.payment?.pixKey
  const formatDate=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
  const submit=async e=>{
    e.preventDefault()
    if(!file||busy)return
    setBusy(true);setError('');setNote('')
    try{
      const data=await dataService.submitManualProof(reservation,file)
      onChange({...reservation,status:data.status,expiresAt:data.expiresAt,proofSubmittedAt:new Date().toISOString()})
      setNote('Comprovante recebido. Seus números ficam reservados por até 3 dias para avaliação do organizador.')
    }catch(err){setError(err.message||'Não foi possível enviar o comprovante.')}
    finally{setBusy(false)}
  }
  const check=async()=>{
    setBusy(true);setError('')
    try{
      const latest=await dataService.getManualReservation(reservation.id,reservation.accessToken)
      onChange({...reservation,...latest})
      setNote('Situação atualizada.')
    }catch(e){setError(e.message||'Não foi possível consultar a reserva.')}
    finally{setBusy(false)}
  }
  const [pixCopied,setPixCopied]=useState(false)
  const copyPix=async()=>{
    const key=reservation.payment?.pixKey
    if(!key)return
    setPixCopied(false)
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(key)
      }else{
        const field=document.createElement('textarea')
        field.value=key
        field.setAttribute('readonly','')
        field.style.position='fixed'
        field.style.opacity='0'
        document.body.appendChild(field)
        field.select()
        const success=document.execCommand('copy')
        document.body.removeChild(field)
        if(!success)throw new Error('Clipboard unavailable')
      }
      setPixCopied(true)
      setNote('Chave Pix copiada! Abra o aplicativo do seu banco e cole a chave para realizar o pagamento.')
      setError('')
    }catch{
      setError('Não foi possível copiar automaticamente. Toque e segure a chave Pix para copiá-la.')
    }
  }
  const copy=async()=>{
    const url=window.location.origin+window.location.pathname+
      '#reserva='+encodeURIComponent(reservation.id)+'&token='+encodeURIComponent(reservation.accessToken)
    try{
      await navigator.clipboard.writeText(url)
      setNote('Link privado da reserva copiado. Guarde-o para enviar o comprovante ou acompanhar a confirmação.')
    }catch{setNote('Copie o endereço completo do navegador para recuperar sua reserva.')}
  }
  return <div className="reservationConfirmed" role="status">
    <h3>{confirmed?'✓ Pagamento confirmado':inReview?'📋 Comprovante em análise':expired?'Reserva encerrada':'✓ Números reservados'}</h3>
    <p>Números: <strong>{(reservation.numbers||[]).map(n=>String(n).padStart(3,'0')).join(', ')}</strong></p>
    <p>Total: <strong>{money(reservation.amount)}</strong></p>
    {confirmed
      ? <p className="success">O organizador confirmou o pagamento. Seus números estão registrados como pagos.</p>
      : expired
        ? <p className="paymentDisclaimer">O prazo desta reserva terminou. Os números podem ficar disponíveis para outros interessados. Se realizou um Pix, procure o organizador com o comprovante.</p>
        : inReview
          ? <p className="success">Seu comprovante foi recebido. Reserva preservada para conferência até <strong>{formatDate(reservation.expiresAt)}</strong>, por no máximo 3 dias. O pagamento ainda não foi confirmado.</p>
          : <p>Reserva manual válida por <strong>30 minutos</strong>, até <strong>{formatDate(reservation.expiresAt)}</strong>. Envie seu comprovante antes deste prazo.</p>
    }
    {showPix&&<div className="pix">
      <b>Dados do Pix manual</b>
      <div className="pixKeyRow">
        <span>Chave: <strong>{reservation.payment.pixKey}</strong></span>
        <button type="button" className="btn primary pixCopyButton" onClick={copyPix}>
          {pixCopied ? '✓ Chave copiada!' : '📋 Copiar chave Pix'}
        </button>
      </div>
      <span>Titular: <strong>{reservation.payment.pixHolder}</strong></span>
      <small>O Pix não é confirmado automaticamente. Guarde o comprovante e envie-o abaixo.</small>
    </div>}
    {pending&&<form className="manualProofUpload" onSubmit={submit}>
      <label>Enviar comprovante de pagamento
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required
          onChange={e=>setFile(e.target.files?.[0]||null)} />
      </label>
      <small>Imagem JPG, PNG, WEBP ou arquivo PDF, até 5 MB. Ao enviar dentro de 30 minutos, a reserva passa a durar até 3 dias enquanto o organizador confere.</small>
      <button className="btn primary wide" disabled={!file||busy} type="submit">
        {busy?'Enviando comprovante…':'Enviar comprovante e preservar números'}
      </button>
    </form>}
    {!confirmed&&!expired&&<p className="paymentDisclaimer"><strong>Importante:</strong> enviar um comprovante não confirma o pagamento. A confirmação depende do organizador verificar o recebimento dos valores.</p>}
    <div className="manualProofActions">
      <button type="button" className="btn ghost" onClick={copy}>Copiar link privado</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={check}>Atualizar situação</button>
    </div>
    <small>O link privado permite consultar esta reserva sem senha. Não o compartilhe publicamente.</small>
    {note&&<p className="success">{note}</p>}
    {error&&<div className="error" role="alert">{error}</div>}
    {!user&&<div className="registerInvite">
      <h4>Quer criar sua conta no Ajude e Ganhe?</h4>
      <p>O cadastro é opcional e não altera esta reserva.</p>
      <Link className="btn primary" to="/entrar?mode=register">Criar conta gratuitamente</Link>
    </div>}
    <button className="manualNewReservation" type="button" onClick={onReset}>Escolher outros números</button>
  </div>
}

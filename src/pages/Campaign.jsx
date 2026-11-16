import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { dataService } from '../services/dataService'
import { money } from '../components/CampaignCard'
import { useAuth } from '../context/AuthContext'
import ManualProofForm from '../components/ManualProofForm'
import StatusShare from '../components/StatusShare'

const dateBR = value => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) : 'Conforme regra'

export default function Campaign() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [c, setC] = useState(null)
  const [reserved, setReserved] = useState([])
  const [selected, setSelected] = useState([])
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [recoverError, setRecoverError] = useState('')
  const [participant,setParticipant] = useState({fullName:'',ddd:'',phone:'',email:''})
  const changeParticipant = (field,value) => setParticipant(prev=>({...prev,[field]:value}))
  useEffect(()=>{
    if(!user) return
    setParticipant(prev=>({
      ...prev,
      fullName:prev.fullName||user.name||'',
      email:prev.email||user.email||''
    }))
  },[user?.id])

  useEffect(() => {
    dataService.getCampaign(slug).then(item => {
      setC(item)
      if (item) dataService.listReservedNumbers(item.id).then(setReserved)
    }).catch(err=>setError(err.message||'Não foi possível carregar a campanha.'))
  }, [slug])

  useEffect(() => {
    const params=new URLSearchParams(window.location.hash.slice(1))
    const id=params.get('reserva'),token=params.get('token')
    if(!id||!token)return
    let active=true
    dataService.getManualReservation(id,token)
      .then(item=>{if(active)setPayment(item)})
      .catch(err=>{if(active)setRecoverError(err.message||'Não foi possível recuperar a reserva.')})
    return ()=>{active=false}
  }, [slug])

  useEffect(() => {
    if (!c) return
    const previousTitle = document.title
    document.title = `${c.title} | Ajude e Ganhe`
    return () => { document.title = previousTitle }
  }, [c])

  const total = useMemo(() => selected.length * (c?.price || 0), [selected, c])

  if (!c) return <main className="shell page"><div className="empty"><b>{error?'!':'…'}</b><h2>{error||'Carregando campanha'}</h2></div></main>

  const toggle = number => {
    if (reserved.includes(number)) return
    setSelected(current => current.includes(number) ? current.filter(x => x !== number) : [...current, number])
  }

  const shareCampaign = async () => {
    const url = window.location.origin + '/campanha/' + encodeURIComponent(c.slug) +
      '?v=' + encodeURIComponent(c.updatedAt || c.createdAt || '')
    const shareData = { title: c.title, text: c.cause || c.description, url }
    setShareStatus('')
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(url)
        setShareStatus('Link copiado! Ao enviar no WhatsApp, a miniatura será carregada a partir da capa da campanha.')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setShareStatus('Não foi possível compartilhar. Copie o endereço do navegador.')
    }
  }

  const reserve = async event => {
    event.preventDefault()
    if (!selected.length || busy) return
    setError('')
    setBusy(true)
    const chosen=[...selected]
    try {
      const result=await dataService.reserveGuestNumbers({
        campaignId:c.id,numbers:chosen,participant
      })
      setReserved(current=>[...new Set([...current,...chosen])])
      setSelected([])
      setPayment(result)
      if(result.id && result.accessToken){
        window.history.replaceState(null,'',window.location.pathname+window.location.search+
          '#reserva='+encodeURIComponent(result.id)+'&token='+encodeURIComponent(result.accessToken))
      }
    } catch(err) {
      const message=String(err.message||'Não foi possível registrar a reserva.')
      if(message.includes('disponível')||message.includes('NUMBER_UNAVAILABLE')) {
        dataService.listReservedNumbers(c.id).then(setReserved).catch(()=>{})
      }
      setError(message)
    } finally {setBusy(false)}
  }

  return <main className="shell detailPage">
    <Link className="back" to="/explorar">← Voltar para campanhas</Link>
    <div className="detailGrid">
      <section>
        <div className={`detailCover ${c.coverImage ? 'withImage' : ''}`} style={{ '--accent': c.accent || '#0f766e' }}>
          {c.coverImage ? <img src={c.coverImage} alt={`Imagem principal de ${c.title}`} /> : (c.emoji || '🎁')}
          <div className="badges"><i>{c.category}</i>{c.verified && <i>✓ Verificada</i>}</div>
        </div>
        <div className="detailTitle"><small>📍 {c.city}/{c.state} • por {c.organizer}</small><h1>{c.title}</h1><p>{c.description}</p>
          <div className="shareActions">
            <button className="btn primary" type="button" onClick={shareCampaign}>↗ Compartilhar campanha</button>
            {user?.id === c.ownerId && <Link className="btn ghost" to={'/campanha/' + c.slug + '/editar'}>✎ Editar campanha</Link>}
          </div>
          {shareStatus && <p role="status">{shareStatus}</p>}
        </div>
        <StatusShare campaign={c}/>
        <div className="infoCards"><article><small>Valor por número</small><b>{money(c.price)}</b></article><article><small>Quantidade</small><b>{c.quantity}</b></article><article><small>Sorteio</small><b>{c.drawType === 'date' ? dateBR(c.drawDate) : 'Ao preencher'}</b></article></div>
        <article className="box"><h2>🎁 {c.prizes?.length > 1 ? 'Prêmios' : 'Prêmio'}</h2><ul>{c.prizes?.map((prize, i) => <li key={`${prize}-${i}`}><b>{i + 1}º</b> {prize}</li>)}</ul></article>
        <article className="box"><h2>♥ Sobre a causa</h2><p><b>{c.cause}</b></p><p>{c.customText}</p></article>
        <article className="box"><h2>📋 Regra do sorteio</h2><p>{c.drawRule}</p></article>
      </section>

      <aside>
        <div className="buybox">
          <span className="eyebrow">ESCOLHA SEUS NÚMEROS</span>
          <h2>{selected.length ? `${selected.length} selecionado(s)` : 'Toque nos números disponíveis'}</h2>
          <div className="numberGrid">{Array.from({ length: c.quantity }, (_, i) => i + 1).map(number => <button key={number} disabled={reserved.includes(number)} onClick={() => toggle(number)} className={selected.includes(number) ? 'sel' : ''}>{String(number).padStart(3, '0')}</button>)}</div>
          <div className="legend"><span>□ Disponível</span><span>■ Selecionado</span><span>▨ Reservado</span></div>
          <div className="total"><span>Total</span><b>{money(total)}</b></div>
          {recoverError&&<div className="error">{recoverError}</div>}
          {payment ? <ManualProofForm reservation={payment} user={user}
            onChange={setPayment}
            onReset={()=>{
              setPayment(null);setRecoverError('')
              window.history.replaceState(null,'',window.location.pathname+window.location.search)
              dataService.listReservedNumbers(c.id).then(setReserved).catch(()=>{})
            }}/>
          : <>
            <form className="guestParticipantForm" onSubmit={reserve}>
              <h3>Seus dados para participar</h3>
              <p>Sem criar conta ou senha. Informe seus dados para reservar os números.</p>
              <label>Nome completo
                <input name="fullName" type="text" autoComplete="name" minLength="5" maxLength="120"
                  value={participant.fullName} required placeholder="Seu nome e sobrenome"
                  onChange={e=>changeParticipant('fullName',e.target.value)} />
              </label>
              <div className="guestPhoneRow">
                <label>DDD
                  <input name="ddd" type="tel" inputMode="numeric" pattern="[1-9][0-9]" maxLength="2"
                    autoComplete="tel-area-code" value={participant.ddd} required placeholder="67"
                    onChange={e=>changeParticipant('ddd',e.target.value.replace(/\D/g,'').slice(0,2))} />
                </label>
                <label>Celular
                  <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{8,9}" maxLength="9"
                    autoComplete="tel-local" value={participant.phone} required placeholder="999999999"
                    onChange={e=>changeParticipant('phone',e.target.value.replace(/\D/g,'').slice(0,9))} />
                </label>
              </div>
              <label>E-mail
                <input name="email" type="email" autoComplete="email" maxLength="254" required
                  value={participant.email} placeholder="exemplo@email.com"
                  onChange={e=>changeParticipant('email',e.target.value)} />
              </label>
              <small className="guestPrivacy">Dados privados, utilizados apenas para sua reserva e contato relacionado à campanha.</small>
              {error&&<div className="error" role="alert">{error}</div>}
              <button type="submit" disabled={busy||!selected.length} className="btn primary wide">
                {busy?'Reservando…':'Reservar por 30 minutos sem cadastro'}
              </button>
            </form>
            <div className="pix"><small>Após reservar, você poderá enviar o comprovante de Pix.</small>
              <span>Comprovantes enviados em até 30 minutos preservam os números por até 3 dias para conferência.</span>
            </div>
          </>}
        </div>
      </aside>
    </div>
  </main>
}

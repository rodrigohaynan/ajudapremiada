import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { dataService } from '../services/dataService'
import { money } from '../components/CampaignCard'
import { useAuth } from '../context/AuthContext'

const dateBR = value => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) : 'Conforme regra'

export default function Campaign() {
  const { slug } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [c, setC] = useState(null)
  const [reserved, setReserved] = useState([])
  const [selected, setSelected] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    dataService.getCampaign(slug).then(item => {
      setC(item)
      if (item) dataService.listReservedNumbers(item.id).then(setReserved)
    })
  }, [slug])

  useEffect(() => {
    if (!c) return
    const previousTitle = document.title
    document.title = `${c.title} | Ajuda Premiada`
    return () => { document.title = previousTitle }
  }, [c])

  const total = useMemo(() => selected.length * (c?.price || 0), [selected, c])

  if (!c) return <main className="shell page"><div className="empty"><b>…</b><h2>Carregando campanha</h2></div></main>

  const toggle = number => {
    if (reserved.includes(number)) return
    setSelected(current => current.includes(number) ? current.filter(x => x !== number) : [...current, number])
  }

  const reserve = async () => {
    if (!user) {
      nav('/entrar')
      return
    }
    if (!selected.length) return
    await dataService.reserveNumbers({ campaignId: c.id, numbers: selected, user, amount: total })
    setReserved([...reserved, ...selected])
    setSelected([])
    setDone(true)
  }

  return <main className="shell detailPage">
    <Link className="back" to="/explorar">← Voltar para campanhas</Link>
    <div className="detailGrid">
      <section>
        <div className={`detailCover ${c.coverImage ? 'withImage' : ''}`} style={{ '--accent': c.accent || '#0f766e' }}>
          {c.coverImage ? <img src={c.coverImage} alt={`Imagem principal de ${c.title}`} /> : (c.emoji || '🎁')}
          <div className="badges"><i>{c.category}</i>{c.verified && <i>✓ Verificada</i>}</div>
        </div>
        <div className="detailTitle"><small>📍 {c.city}/{c.state} • por {c.organizer}</small><h1>{c.title}</h1><p>{c.description}</p></div>
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
          <div className="legend"><span>□ Disponível</span><span>■ Selecionado</span><span>▨ Preenchido</span></div>
          <div className="total"><span>Total</span><b>{money(total)}</b></div>
          <button className="btn primary wide" onClick={reserve}>{user ? 'Registrar participação' : 'Entrar para participar'}</button>
          {done && <div className="success">✓ Participação registrada. Faça o Pix para <b>{c.pixKey}</b> — {c.pixHolder}.</div>}
          <div className="pix"><small>Pix informado pelo organizador</small><b>{c.pixKey}</b><span>{c.pixHolder}</span></div>
        </div>
      </aside>
    </div>
  </main>
}

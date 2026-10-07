import { Link } from 'react-router-dom'

export const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

export default function CampaignCard({ campaign: c }) {
  const pct = Math.min(100, Math.round((c.sold / c.quantity) * 100))

  return <Link className="card" to={`/campanha/${c.slug}`}>
    <div className={`cover ${c.coverImage ? 'withImage' : ''}`} style={{ '--accent': c.accent || '#0f766e' }}>
      {c.coverImage ? <img src={c.coverImage} alt={`Capa de ${c.title}`} /> : <span>{c.emoji || '🎁'}</span>}
      <div className="badges"><i>{c.category}</i>{c.verified && <i>✓ Verificada</i>}</div>
    </div>
    <div className="cardbody">
      <small>📍 {c.city}/{c.state}</small>
      <h3>{c.title}</h3>
      <p>por {c.organizer}</p>
      <div className="prize"><small>Prêmio</small><b>{c.prizes?.[0] || 'Prêmio da campanha'}</b></div>
      <div className="progress"><i style={{ width: `${pct}%` }} /></div>
      <div className="cardfoot"><span>{pct}% preenchida</span><b>{money(c.price)} <small>/ número</small></b></div>
    </div>
  </Link>
}

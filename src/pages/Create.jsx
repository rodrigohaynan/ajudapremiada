import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dataService } from '../services/dataService'
import { categories } from '../data/mockCampaigns'
import { money } from '../components/CampaignCard'
import { prepareCampaignCover } from '../utils/coverImage'
import MercadoPagoConnect from '../components/MercadoPagoConnect'

const initial = {
  title: '',
  category: 'Solidariedade',
  cause: '',
  city: 'Campo Grande',
  state: 'MS',
  description: '',
  quantity: 200,
  price: 10,
  drawType: 'date',
  drawDate: '',
  drawRule: '',
  pixKey: '',
  pixHolder: '',
  customText: '',
  emoji: '🎁',
  accent: '#0f766e',
  coverImage: '',
  coverImageName: '',
}

export default function Create() {
  const { user, loading: authLoading } = useAuth()
  const { slug } = useParams()
  const isEdit = Boolean(slug)
  const nav = useNavigate()
  const [form, setForm] = useState(initial)
  const [prizes, setPrizes] = useState([''])
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [processingImage, setProcessingImage] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [coverFit, setCoverFit] = useState('contain')
  const [selectedFile, setSelectedFile] = useState(null)
  const [loadingCampaign, setLoadingCampaign] = useState(isEdit)
  const [ownedCampaign, setOwnedCampaign] = useState(null)
  const [lifecycle, setLifecycle] = useState(null)
  const [manageBusy, setManageBusy] = useState(false)
  const [manageError, setManageError] = useState('')

  useEffect(() => {
    if (!isEdit || !user) return
    let active = true
    setLoadingCampaign(true)
    dataService.getCampaign(slug).then(async item => {
      if (!item || item.ownerId !== user.id) throw new Error('Você não tem permissão para editar esta campanha.')
      const [payment, lifecycleStatus] = await Promise.all([
        dataService.getPaymentSettings(item.id),dataService.getCampaignLifecycle(item.id)
      ])
      if (!active) return
      setOwnedCampaign(item)
      setLifecycle(lifecycleStatus)
      setPrizes(item.prizes?.length ? item.prizes : [''])
      setForm({
        title: item.title || '', category: item.category || 'Solidariedade',
        cause: item.cause || '', city: item.city || '', state: item.state || 'MS',
        description: item.description || '', quantity: item.quantity, price: item.price,
        drawType: item.drawType || 'date', drawDate: item.drawDate || '',
        drawRule: item.drawRule || '', pixKey: payment.pixKey || '',
        pixHolder: payment.pixHolder || '', customText: item.customText || '',
        emoji: item.emoji || '🎁', accent: item.accent || '#0f766e',
        coverImage: item.coverImage || '', coverImageName: ''
      })
    }).catch(err => { if (active) setError(err.message || 'Não foi possível carregar a campanha.') })
      .finally(() => { if (active) setLoadingCampaign(false) })
    return () => { active = false }
  }, [isEdit, slug, user?.id])

  if (authLoading || (isEdit && user && loadingCampaign)) {
    return <main className="shell page"><div className="empty"><h2>Carregando campanha…</h2></div></main>
  }
  if (!user) {
    return <main className="shell page"><div className="empty"><b>🔒</b><h1>Entre para criar uma campanha</h1><p>Sua conta reúne campanhas e participações.</p><Link className="btn primary" to="/entrar">Entrar ou cadastrar</Link></div></main>
  }

  if (isEdit && !ownedCampaign) {
    return <main className="shell page"><div className="empty"><h2>{error || 'Campanha não encontrada.'}</h2><Link to="/painel">Voltar ao painel</Link></div></main>
  }

  if (isEdit && ownedCampaign?.status === 'archived') {
    return <main className="shell page">
      <div className="empty"><b>📁</b><h1>Campanha arquivada</h1>
        <p>Ela não recebe novas participações. Os registros e comprovantes anteriores foram preservados.</p>
        <Link className="btn primary" to={'/campanha/'+ownedCampaign.slug}>Consultar campanha</Link>
        <Link className="btn ghost" to="/painel?tab=owned">Voltar às minhas campanhas</Link>
      </div>
    </main>
  }

  const u = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const handleFit = async mode => {
    setCoverFit(mode)
    if (!selectedFile) return
    setProcessingImage(true)
    try {
      const prepared = await prepareCampaignCover(selectedFile, { mode })
      setForm(current => ({...current,coverImage:prepared.dataUrl,coverImageName:prepared.originalName}))
      setImageError('')
    } catch (err) {
      setImageError(err.message || 'Não foi possível enquadrar a foto.')
    } finally { setProcessingImage(false) }
  }

  const handleCover = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImageError('')
    setProcessingImage(true)
    try {
      const prepared = await prepareCampaignCover(file, { mode: coverFit })
      setSelectedFile(file)
      setForm(current => ({
        ...current,
        coverImage: prepared.dataUrl,
        coverImageName: prepared.originalName,
      }))
    } catch (err) {
      setImageError(err.message || 'Não foi possível preparar a imagem.')
    } finally {
      setProcessingImage(false)
    }
  }

  const removeCover = () => {
    setImageError('')
    setSelectedFile(null)
    setForm(current => ({ ...current, coverImage: '', coverImageName: '' }))
  }

  const next = () => {
    setError('')
    if (step === 1 && (!form.title || !form.cause || !form.description)) return setError('Preencha título, causa e descrição.')
    if (step === 2 && (!form.quantity || !form.price || !prizes.filter(Boolean).length)) return setError('Informe pelo menos um prêmio, quantidade e valor.')
    if (step === 3 && !form.drawRule) return setError('Descreva a regra do sorteio.')
    setStep(current => Math.min(4, current + 1))
  }

  const publish = async () => {
    if (!form.pixKey || !form.pixHolder) return setError('Informe a chave Pix e o titular.')
    setError('')
    setPublishing(true)
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        price: Number(form.price),
        prizes: prizes.filter(Boolean),
      }
      const item = isEdit
        ? await dataService.updateCampaign(ownedCampaign.id, payload, user)
        : await dataService.createCampaign(payload, user)
      nav(`/campanha/${item.slug}`)
    } catch (err) {
      setError(err.message || (isEdit ? 'Não foi possível salvar as alterações.' : 'Não foi possível publicar a campanha.'))
    } finally {
      setPublishing(false)
    }
  }

  const manageCampaign = async action => {
    if (!isEdit || !ownedCampaign || !lifecycle || manageBusy) return
    setManageError('')
    if (action==='delete') {
      if (!lifecycle.canDelete) return setManageError('Esta campanha possui histórico. Arquive em vez de excluir.')
      if (!window.confirm('Excluir DEFINITIVAMENTE esta campanha sem participações? Esta ação não pode ser desfeita.')) return
      const typed=window.prompt('Para confirmar a exclusão, digite EXCLUIR:')
      if (typed?.trim().toUpperCase() !== 'EXCLUIR') return
    } else {
      if (!window.confirm('Arquivar esta campanha? Ela deixará de aceitar novos números, mas as reservas, comprovantes e o histórico permanecerão preservados.')) return
    }
    setManageBusy(true)
    try {
      await dataService.manageCampaignLifecycle(ownedCampaign.id,action,user)
      nav('/painel?tab=owned',{replace:true})
    } catch(err) {
      setManageError(err.message||'Não foi possível concluir a operação.')
    } finally {
      setManageBusy(false)
    }
  }

  return <main className="create"><div className="shell">
    <div className="createHead">
      <div><span className="eyebrow">{isEdit ? 'EDITAR CAMPANHA' : 'NOVA CAMPANHA'}</span><h1>{isEdit ? 'Atualize sua campanha' : 'Crie sua campanha no Ajude e Ganhe'}</h1><p>{isEdit ? 'Altere a foto e os dados da campanha sem mudar o link.' : 'Organize as informações antes de divulgar.'}</p>{isEdit && <Link to="/painel" className="back">← Voltar ao painel</Link>}</div>
      <div className="stepper">{[1, 2, 3, 4].map(n => <i key={n} className={n <= step ? 'active' : ''}>{n}</i>)}</div>
    </div>

    <div className="createGrid">
      <section className="formcard">
        {step === 1 && <>
          <h2>01. Campanha e causa</h2>
          <label>Título<input value={form.title} onChange={e => u('title', e.target.value)} placeholder="Ex.: Ajude nosso projeto e concorra..." /></label>
          <div className="row">
            <label>Categoria<select value={form.category} onChange={e => u('category', e.target.value)}>{categories.filter(x => x !== 'Todas').map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Cidade<input value={form.city} onChange={e => u('city', e.target.value)} /></label>
          </div>
          <label>Causa/objetivo<input value={form.cause} onChange={e => u('cause', e.target.value)} placeholder="Para que será utilizada a arrecadação?" /></label>
          <label>Descrição<textarea rows="5" value={form.description} onChange={e => u('description', e.target.value)} /></label>

          <div className="coverField">
            <span>Imagem principal da campanha</span>
            <label className={`coverUpload ${form.coverImage ? 'hasImage' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCover} />
              {form.coverImage
                ? <img src={form.coverImage} alt="Prévia da imagem principal" />
                : <div className="coverUploadEmpty"><div><div className="coverUploadIcon">🖼️</div><b>{processingImage ? 'Preparando imagem...' : 'Toque para escolher a imagem principal'}</b><small>JPG, PNG ou WEBP • até 12 MB</small></div></div>}
            </label>
            <div className="coverHelp">
              <span>A imagem terá 1200 × 630 px para a miniatura de compartilhamento. Escolha o enquadramento abaixo.</span>
              {form.coverImage && <button type="button" onClick={removeCover}>Remover imagem</button>}
            </div>
            <div className="coverFitActions">
              <button type="button" className={coverFit === 'contain' ? 'active' : ''} onClick={() => handleFit('contain')}>Mostrar imagem inteira</button>
              <button type="button" className={coverFit === 'cover' ? 'active' : ''} onClick={() => handleFit('cover')}>Preencher a área (recortar)</button>
            </div>
            {isEdit && !selectedFile && form.coverImage && <small>Para recuperar partes cortadas da foto antiga, escolha novamente o arquivo original.</small>}
            {imageError && <div className="imageError">{imageError}</div>}
            <div className="coverSocialHint"><b>Miniatura de compartilhamento:</b> esta é a imagem preparada para aparecer quando o link da campanha for compartilhado no WhatsApp e nas redes sociais. A imagem será enviada ao Storage do Supabase e ficará vinculada à campanha. Ao compartilhar o link, a miniatura será gerada com base na capa pública atualizada.</div>
          </div>
        </>}

        {step === 2 && <>
          <h2>02. Prêmios e números</h2>
          <label>Prêmios</label>
          {prizes.map((prize, i) => <div className="prizeRow" key={i}><input value={prize} onChange={e => setPrizes(items => items.map((x, j) => j === i ? e.target.value : x))} placeholder={`${i + 1}º prêmio`} />{prizes.length > 1 && <button onClick={() => setPrizes(items => items.filter((_, j) => j !== i))}>×</button>}</div>)}
          <button className="smallBtn" onClick={() => setPrizes([...prizes, ''])}>+ Adicionar outro prêmio</button>
          <div className="row">
            <label>Quantidade de números<input type="number" min="10" max="5000" disabled={isEdit} value={form.quantity} onChange={e => u('quantity', e.target.value)} /></label>
            <label>Valor por número<input type="number" min="1" step="0.5" disabled={isEdit} value={form.price} onChange={e => u('price', e.target.value)} /></label>
          </div>
          {isEdit && <div className="editWarning">Quantidade e preço ficam bloqueados após a publicação para proteger os números e participações já registrados.</div>}
          <div className="projection"><small>Potencial bruto se 100% preenchida</small><b>{money(Number(form.quantity) * Number(form.price))}</b></div>
        </>}

        {step === 3 && <>
          <h2>03. Regra do sorteio</h2>
          <div className="choice"><button className={form.drawType === 'date' ? 'active' : ''} onClick={() => u('drawType', 'date')}>📅 Em uma data</button><button className={form.drawType === 'soldout' ? 'active' : ''} onClick={() => u('drawType', 'soldout')}>✓ Ao preencher 100%</button></div>
          {form.drawType === 'date' && <label>Data prevista<input type="date" value={form.drawDate} onChange={e => u('drawDate', e.target.value)} /></label>}
          <label>Regra<textarea rows="6" value={form.drawRule} onChange={e => u('drawRule', e.target.value)} placeholder="Explique o critério, transmissão, prazo e forma de divulgação do resultado." /></label>
        </>}

        {step === 4 && <>
          <h2>04. Pix e mensagem</h2>
          <MercadoPagoConnect user={user} />
          <div className="editWarning">A conexão Mercado Pago é uma preparação para pagamentos automáticos. Até a homologação e a aprovação comercial da modalidade, os recebimentos continuam por Pix manual.</div>
          <label>Chave Pix<input value={form.pixKey} onChange={e => u('pixKey', e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" /></label>
          <label>Titular da chave<input value={form.pixHolder} onChange={e => u('pixHolder', e.target.value)} /></label>
          <label>Mensagem personalizada<textarea rows="4" value={form.customText} onChange={e => u('customText', e.target.value)} placeholder="Agradecimento, orientação ou chamada para compartilhar." /></label>
          <div className="notice"><b>⚠ Antes de publicar</b><p>O organizador responde pela veracidade das informações, prêmio, recebimento do Pix, regras, autorizações aplicáveis e realização/divulgação do resultado.</p></div>
        </>}

        {error && <div className="error">{error}</div>}
        <div className="actions">{step > 1 && <button className="btn ghost" onClick={() => { setError(''); setStep(step - 1) }}>Voltar</button>}<button disabled={publishing} className="btn primary" onClick={step === 4 ? publish : next}>{step === 4 ? (publishing ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Publicar campanha')) : 'Continuar'}</button></div>
      </section>

      <aside className="preview">
        <span className="eyebrow">PRÉVIA</span>
        <div className={`previewCover ${form.coverImage ? 'withImage' : ''}`} style={{ '--accent': form.accent }}>{form.coverImage ? <img src={form.coverImage} alt="Capa da campanha" /> : form.emoji}</div>
        <small>{form.category} • {form.city}/{form.state}</small>
        <h3>{form.title || 'Título da sua campanha'}</h3>
        <p>{prizes.filter(Boolean)[0] || 'Seu prêmio aparecerá aqui'}</p>
        <b>{money(form.price)} <small>/ número</small></b>
        <div className="progress"><i style={{ width: '18%' }} /></div>
        <small>{form.quantity} números no lançamento</small>
      </aside>
    </div>

    {isEdit && <section className="manageCampaign" aria-label="Gerenciar campanha">
      <div>
        <span className="eyebrow">GERENCIAMENTO</span>
        <h2>Gerenciar esta campanha</h2>
        {lifecycle?.canDelete ? <>
          <p>Nenhuma participação foi registrada. É possível excluir definitivamente esta campanha.</p>
          <small>A exclusão apaga a campanha, os números e seus dados de configuração. Não poderá ser desfeita.</small>
        </> : <>
          <p>Esta campanha já possui histórico ou foi encerrada. Para preservar a identificação dos participantes, reservas e comprovantes, utilize o arquivamento.</p>
          <small>{lifecycle?.participations||0} participação(ões) registrada(s). Campanhas arquivadas deixam de receber novos números, mas mantêm o link para consulta e acompanhamento de reservas já realizadas.</small>
        </>}
      </div>
      {lifecycle && <button type="button" disabled={manageBusy||publishing} className={'btn '+(lifecycle.canDelete?'manageDelete':'manageArchive')}
        onClick={()=>manageCampaign(lifecycle.canDelete?'delete':'archive')}>
        {manageBusy?'Processando…':lifecycle.canDelete?'Excluir campanha definitivamente':'Arquivar campanha'}
      </button>}
      {manageError && <div className="error" role="alert">{manageError}</div>}
    </section>}
  </div></main>
}

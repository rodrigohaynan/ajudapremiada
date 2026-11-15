import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MercadoPagoConnect({ user }) {
  const [connection, setConnection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!user || !supabase) return
    let active = true
    supabase.from('payment_connections')
      .select('provider_user_id,status,connected_at')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setConnection(data)
        const status = new URLSearchParams(window.location.search).get('mp')
        if (status === 'connected') setNotice('Conta Mercado Pago conectada com sucesso.')
        if (status === 'cancelled') setNotice('Conexão cancelada pelo organizador.')
        if (status === 'unconfigured') setError('Integração aguardando credenciais.')
        if (status === 'error' || status === 'expired') setError('Não foi possível completar a conexão. Tente novamente.')
      }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id])

  const connect = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-oauth', {
        body: { action: 'start' }
      })
      if (error) {
        let message = 'Não foi possível conectar o Mercado Pago.'
        try { const response = await error.context.json(); message = response.error || message } catch (_) {}
        throw new Error(message)
      }
      if (!data?.url || !data.url.startsWith('https://auth.mercadopago.com.br/authorization')) {
        throw new Error('O Mercado Pago não retornou uma URL de autorização válida.')
      }
      window.location.assign(data.url)
    } catch (err) { setError(err.message || 'Falha na conexão.') }
    finally { setBusy(false) }
  }

  const disconnect = async () => {
    if (!window.confirm('Desconectar a conta Mercado Pago deste perfil?')) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.from('payment_connections')
        .delete().eq('user_id', user.id)
      if (error) throw error
      setConnection(null)
      setNotice('Conexão local removida. Revogue também o acesso no Mercado Pago, se desejar.')
    } catch (err) { setError(err.message || 'Não foi possível desconectar.') }
    finally { setBusy(false) }
  }

  return <div className="mpConnectBox">
    <h3>💳 Recebimentos pelo Mercado Pago</h3>
    {loading ? <p>Consultando conexão…</p> : connection?.status === 'connected' ? <>
      <p>✓ Conta conectada (identificador: <strong>{connection.provider_user_id}</strong>).</p>
      <p>Os pagamentos automáticos ainda não estão ativados. Por enquanto, continue utilizando o Pix manual.</p>
      <button type="button" className="btn ghost" disabled={busy} onClick={disconnect}>Desconectar conta</button>
    </> : <>
      <p>Autorize uma conta que você já possui, sem informar sua senha no Ajude e Ganhe. A conexão só ficará operacional após habilitação comercial.</p>
      <button type="button" className="btn primary" disabled={busy || loading} onClick={connect}>
        {busy ? 'Conectando…' : 'Conectar Mercado Pago'}
      </button>
    </>}
    {notice && <div className="success">{notice}</div>}
    {error && <div className="error">{error}</div>}
  </div>
}

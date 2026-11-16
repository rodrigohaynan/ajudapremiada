import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { changePassword } = useAuth()
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setError('A recuperação de senha está temporariamente indisponível.')
      setChecking(false)
      return
    }

    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const linkError = query.get('error_description') || hash.get('error_description')
      || query.get('error') || hash.get('error')
    if (linkError) {
      setError('Este link de recuperação é inválido ou expirou. Solicite um novo link.')
      setChecking(false)
      return
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !['PASSWORD_RECOVERY', 'SIGNED_IN', 'INITIAL_SESSION', 'SIGNED_OUT'].includes(event)) return
      setAuthorized(Boolean(session))
      setChecking(false)
    })

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) setError('Não foi possível validar o link. Solicite uma nova recuperação.')
        setAuthorized(Boolean(data?.session))
        setChecking(false)
      })
      .catch(() => {
        if (!active) return
        setError('Não foi possível validar o link. Tente solicitar outro.')
        setChecking(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const submit = async event => {
    event.preventDefault()
    if (busy || completed) return
    setError('')
    if (password.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As duas senhas precisam ser iguais.')
      return
    }

    setBusy(true)
    try {
      await changePassword(password)
      setPassword('')
      setConfirm('')
      setCompleted(true)
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha. Solicite um novo link.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth">
    <section className="authSide">
      <div>
        <span>♥</span>
        <h1>Uma nova senha.<br/>A mesma vontade<br/>de ajudar.</h1>
        <p>Proteja sua conta e continue participando do Ajude e Ganhe.</p>
      </div>
    </section>
    <section className="authForm">
      <div className="authBox">
        <Logo/>
        <span className="eyebrow">SEGURANÇA DA CONTA</span>
        <h2>{completed ? 'Senha alterada com sucesso!' : 'Definir nova senha'}</h2>

        {completed ? <>
          <p>Sua senha foi atualizada. Entre novamente usando a nova senha.</p>
          <Link className="btn primary wide" to="/entrar">Ir para o login</Link>
        </> : checking ? <>
          <p>Verificando seu link de recuperação…</p>
        </> : authorized ? <>
          <p>Crie uma nova senha para acessar sua conta.</p>
          <form onSubmit={submit}>
            <label>Nova senha
              <input type="password" autoComplete="new-password" minLength="8"
                value={password} onChange={event => setPassword(event.target.value)} required/>
            </label>
            <label>Confirmar nova senha
              <input type="password" autoComplete="new-password" minLength="8"
                value={confirm} onChange={event => setConfirm(event.target.value)} required/>
            </label>
            <small className="authPasswordHint">Use pelo menos 8 caracteres e evite senhas utilizadas em outros sites.</small>
            {error && <div className="error" role="alert">{error}</div>}
            <button type="submit" className="btn primary wide" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        </> : <>
          <p>Não foi possível validar uma sessão de recuperação. O link pode ter expirado ou já ter sido utilizado.</p>
          {error && <div className="error" role="alert">{error}</div>}
          <Link className="btn primary wide" to="/entrar?mode=forgot">Solicitar outro link</Link>
        </>}
        <p className="switch"><Link to="/entrar">Voltar ao login</Link></p>
        <small className="prototype">A alteração é processada pelo Supabase Auth. Nunca compartilhe links ou códigos de recuperação.</small>
        <Link className="back" to="/">← Voltar ao início</Link>
      </div>
    </section>
  </main>
}

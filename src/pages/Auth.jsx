import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/Layout'

export default function Auth() {
  const { login, register, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => {
    const selected = new URLSearchParams(window.location.search).get('mode')
    return selected === 'register' ? 'register' : selected === 'forgot' ? 'forgot' : 'login'
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const changeMode = next => {
    setMode(next)
    setError('')
    setNotice('')
    setPassword('')
  }

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password })
        navigate('/painel')
      } else if (mode === 'register') {
        const result = await register({ name, email: email.trim(), password })
        if (result.needsConfirmation) {
          setNotice('Conta criada. Confirme seu e-mail para entrar no Ajude e Ganhe.')
        } else {
          navigate('/painel')
        }
      } else {
        await requestPasswordReset(email.trim())
        setNotice('Se existir uma conta com este e-mail, você receberá um link para redefinir sua senha. Confira também a caixa de spam.')
      }
    } catch (err) {
      setError(err.message || 'Não foi possível concluir a solicitação. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'login'
    ? 'Entre na sua conta'
    : mode === 'register' ? 'Comece no Ajude e Ganhe' : 'Recuperar sua senha'

  return <main className="auth">
    <section className="authSide">
      <div>
        <span>♥</span>
        <h1>Ajude causas.<br/>Acompanhe números.<br/>Crie campanhas.</h1>
        <p>O Ajude e Ganhe reúne tudo em uma experiência simples e organizada.</p>
      </div>
    </section>
    <section className="authForm">
      <div className="authBox">
        <Logo/>
        <span className="eyebrow">
          {mode === 'login' ? 'BEM-VINDO DE VOLTA' : mode === 'register' ? 'CRIE SUA CONTA' : 'REDEFINIÇÃO DE SENHA'}
        </span>
        <h2>{title}</h2>
        <p>{mode === 'forgot'
          ? 'Informe o e-mail da sua conta para receber as instruções de redefinição.'
          : mode === 'login' ? 'Acesse suas participações e campanhas.'
          : 'Participe, acompanhe e crie suas próprias campanhas.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <label>Nome completo
            <input autoComplete="name" required value={name} onChange={event => setName(event.target.value)}/>
          </label>}
          <label>E-mail
            <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="seuemail@exemplo.com"/>
          </label>
          {mode !== 'forgot' && <label>Senha
            <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength="6" required value={password} onChange={event => setPassword(event.target.value)}/>
          </label>}
          {mode === 'login' && <div className="authForgot">
            <button type="button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button>
          </div>}
          {error && <div className="error" role="alert">{error}</div>}
          {notice && <div className="success authNotice" role="status">{notice}</div>}
          <button type="submit" disabled={busy} className="btn primary wide">
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar link para redefinir senha'}
          </button>
        </form>
        <p className="switch">
          {mode === 'forgot'
            ? <button type="button" onClick={() => changeMode('login')}>← Voltar para o login</button>
            : <>
                {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
                <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>
                  {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
                </button>
              </>}
        </p>
        <small className="prototype">Conta protegida pelo Supabase Auth. Nunca informe sua senha ou código de recuperação a outras pessoas.</small>
        <Link className="back" to="/">← Voltar ao início</Link>
      </div>
    </section>
  </main>
}

import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const { setUser } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.requestCode(email);
      setDevCode(res.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el código');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.verify(email, code);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <p className="admin-kicker">Cat &amp; Cobra</p>
        <h1>Acceso admin</h1>
        <p className="admin-muted">
          Introduce un correo autorizado. Te enviamos un código de un solo uso — sin contraseña.
        </p>

        {step === 'email' ? (
          <form onSubmit={onRequest} className="admin-form">
            <label>
              Correo
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@estudio.com"
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" disabled={busy} className="admin-btn primary">
              {busy ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="admin-form">
            <p className="admin-muted">
              Código enviado a <strong>{email}</strong>
            </p>
            {devCode && (
              <p className="admin-dev-code">
                Código de desarrollo: <code>{devCode}</code>
              </p>
            )}
            <label>
              Código de 6 dígitos
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className="admin-btn primary">
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="admin-btn ghost"
              onClick={() => {
                setStep('email');
                setCode('');
                setDevCode(null);
                setError(null);
              }}
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Sign in and create account share one form. Visitors are sent back to the page that asked for a login.
export default function Login() {
  const { status, user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [mode, setMode] = useState('signin'); // signin | signup
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user) return <Navigate to={from} replace />;

  const signup = mode === 'signup';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (signup) await signUp(form);
      else await signIn({ email: form.email, password: form.password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel auth-card" onSubmit={submit}>
      <h2>{signup ? 'Create your account' : 'Sign in'}</h2>
      {error && <p className="alert" role="alert">{error}</p>}
      {signup && (
        <label className="field">
          Name
          <input className="input" value={form.name} onChange={set('name')} autoComplete="name" maxLength={100} />
        </label>
      )}
      <label className="field">
        Email
        <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          type="password"
          value={form.password}
          onChange={set('password')}
          autoComplete={signup ? 'new-password' : 'current-password'}
          minLength={signup ? 8 : undefined}
          required
        />
        {signup && <small className="muted">At least 8 characters.</small>}
      </label>
      <button type="submit" className="btn full" disabled={submitting}>
        {submitting ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}
      </button>
      <p className="muted small center">
        {signup ? 'Already have an account? ' : 'New here? '}
        <button type="button" className="link-btn auth-switch" onClick={() => { setMode(signup ? 'signin' : 'signup'); setError(''); }}>
          {signup ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </form>
  );
}
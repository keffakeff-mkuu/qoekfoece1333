import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button, Card, InlineAlert } from '../components/ui';

const AuthShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-screen bg-[#0B132B] flex items-center justify-center p-4">
    <Card className="w-full max-w-md p-6">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/" className="h-9 w-9 rounded-lg bg-[#059669] flex items-center justify-center text-white shrink-0">
          <Shield className="h-5 w-5" />
        </Link>
        <div>
          <div className="text-xs text-slate-500 font-medium">AI Africa Platform</div>
          <h1 className="text-lg font-bold text-[#0B132B] font-display">{title}</h1>
        </div>
      </div>
      {subtitle && <p className="text-xs text-slate-600 mb-4">{subtitle}</p>}
      {children}
    </Card>
  </div>
);

export const LoginPage: React.FC = () => {
  const { login, enterDemoWorkspace } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (res.needsOnboarding) {
      navigate('/onboarding');
    } else {
      navigate('/app/home');
    }
  };

  const handleDemo = async () => {
    setBusy(true);
    const res = await enterDemoWorkspace('owner');
    setBusy(false);
    if (!res.error) navigate('/app/fieldforce/dashboard');
  };

  return (
    <AuthShell title="Sign in to AI Africa" subtitle="Use your organisation credentials or launch the Nairobi sample workspace.">
      <form onSubmit={submit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.co.ke"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
        <Button type="button" variant="secondary" onClick={handleDemo} disabled={busy} className="w-full">
          Open Sample Demo Workspace
        </Button>
        <div className="flex justify-between text-xs text-slate-600">
          <Link to="/auth/register" className="text-[#059669] font-medium hover:underline">
            Create Owner Account
          </Link>
          <Link to="/auth/forgot-password" className="hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
    </AuthShell>
  );
};

export const RegisterPage: React.FC = () => {
  const { register } = useApp();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    const res = await register(email, password, fullName);
    setBusy(false);
    if (res.error) setError(res.error);
    else navigate('/onboarding');
  };

  return (
    <AuthShell title="Create Owner Account" subtitle="Step 1 of 2: Register your administrator account before setting up your company.">
      <form onSubmit={submit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Wanjiku Kamau"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ops@company.co.ke"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 8 characters)</label>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating Account...' : 'Continue to Organisation Setup'}
        </Button>
        <div className="text-xs text-center text-slate-600">
          Already registered?{' '}
          <Link to="/auth/login" className="text-[#059669] font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [previewToken, setPreviewToken] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await apiRequest<{ message: string; previewResetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    if (res.error) setError(res.error);
    else if (res.data) {
      setMessage(res.data.message);
      if (res.data.previewResetToken) setPreviewToken(res.data.previewResetToken);
    }
  };

  return (
    <AuthShell title="Reset Password">
      {message ? (
        <div className="space-y-4">
          <InlineAlert tone="success">{message}</InlineAlert>
          {previewToken && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
              <div>Local reset token issued:</div>
              <Link
                to={`/auth/reset-password?token=${encodeURIComponent(previewToken)}`}
                className="text-[#059669] font-semibold underline break-all block"
              >
                Continue to Set New Password →
              </Link>
            </div>
          )}
          <Link to="/auth/login" className="text-xs font-medium text-[#059669] hover:underline block">
            Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <InlineAlert tone="error">{error}</InlineAlert>}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your work email"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <Button type="submit" className="w-full">Send Reset Instructions</Button>
          <div className="text-xs text-center">
            <Link to="/auth/login" className="text-slate-600 hover:underline">Back to Sign In</Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    });
    if (res.error) setError(res.error);
    else navigate('/auth/login');
  };

  return (
    <AuthShell title="Set New Password">
      <form onSubmit={submit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Reset Token</label>
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">New Password (min 8 chars)</label>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" className="w-full">Update Password</Button>
      </form>
    </AuthShell>
  );
};

export const OnboardingPage: React.FC = () => {
  const { user, createOrganization } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <AuthShell title="Organisation Setup">
        <InlineAlert tone="info">Please sign in or register first to create an organisation.</InlineAlert>
        <div className="mt-4">
          <Link to="/auth/register" className="text-sm font-medium text-[#059669] hover:underline">
            Go to Registration →
          </Link>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await createOrganization(name, legalName);
    setBusy(false);
    if (res.error) setError(res.error);
    else navigate('/app/home');
  };

  return (
    <AuthShell
      title="Set Up Your Organisation"
      subtitle="Step 2 of 2: Owner permissions and FieldForce AI entitlement are provisioned on the server. Default locale: Kenya (KES · Africa/Nairobi)."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Company Trading Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rift Valley Security Services"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Registered Legal Name (Optional)</label>
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="e.g. Rift Valley Security Services Ltd"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Provisioning Workspace...' : 'Launch Workspace'}
        </Button>
      </form>
    </AuthShell>
  );
};

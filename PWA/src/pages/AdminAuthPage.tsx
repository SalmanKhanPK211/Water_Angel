import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  onAuthed: () => void;
}

const AdminAuthPage = ({ onAuthed }: Props) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('admin_exists');
      if (error) toast.error(error.message);
      setAdminExists(!!data);
      setChecking(false);
    })();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);

    // Sign up the admin user
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });

    if (signUpErr) {
      // If already registered, try sign-in
      if (signUpErr.message.toLowerCase().includes('already')) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (siErr) { toast.error(siErr.message); setSubmitting(false); return; }
      } else {
        toast.error(signUpErr.message);
        setSubmitting(false);
        return;
      }
    }

    // If a session exists now, claim admin
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      toast.success('Check your email to confirm, then come back to /admin to finish setup.');
      setSubmitting(false);
      return;
    }

    const { error: claimErr } = await supabase.rpc('claim_first_admin');
    if (claimErr) {
      toast.error('Could not claim admin: ' + claimErr.message);
      setSubmitting(false);
      return;
    }

    toast.success('Admin registered!');
    setSubmitting(false);
    onAuthed();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }

    // Verify the email is in admin_emails
    const { data: ok } = await supabase.rpc('is_admin');
    if (!ok) {
      toast.error('This account is not an admin.');
      await signOut();
      return;
    }
    toast.success('Welcome, admin');
    onAuthed();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRegister = !adminExists;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm water-card space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {isRegister ? 'Register Admin' : 'Admin Login'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isRegister
              ? 'No admin exists yet. The first account created here becomes the admin.'
              : 'Sign in with your admin credentials to manage devices.'}
          </p>
        </div>

        <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password" type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? (isRegister ? 'Registering...' : 'Signing in...')
              : (isRegister ? 'Register Admin' : 'Sign In')}
          </Button>
        </form>

        {user && !isRegister && (
          <p className="text-xs text-center text-muted-foreground">
            Logged in as {user.email}.{' '}
            <button className="underline" onClick={async () => { await signOut(); }}>
              Sign out
            </button>
          </p>
        )}

        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Back to app
        </button>
      </div>
    </div>
  );
};

export default AdminAuthPage;

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Activity } from 'lucide-react';
import './Login.css';

type AuthMode = 'login' | 'signup' | 'forgot';

const LoginView: React.FC = () => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage('Account created! Please log in or verify your email.');
                setMode('login');
            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/update-password`,
                });
                if (error) throw error;
                setMessage('Password reset link sent! Check your email.');
                setMode('login');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade-in">
            <div className="auth-brand">
                <div className="auth-logo">
                    <Activity size={32} className="text-primary" />
                </div>
                <h1>Life OS</h1>
                <p className="text-secondary">Gamify your life. Achieve your goals.</p>
            </div>

            <Card glass padding="lg" className="auth-card mt-xl">
                <h2 className="mb-md">
                    {mode === 'login' && 'Welcome Back'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Reset Password'}
                </h2>

                {error && <div className="auth-error mb-md">{error}</div>}
                {message && <div style={{ color: 'var(--success-color)', marginBottom: '1rem', textAlign: 'center' }}>{message}</div>}

                <form onSubmit={handleAuth} className="auth-form">
                    <div className="form-group mb-md">
                        <Input
                            label="Email Address"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </div>
                    {mode !== 'forgot' && (
                        <div className="form-group mb-lg">
                            <Input
                                label="Password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Processing...' : (
                            mode === 'login' ? 'Sign In' :
                                mode === 'signup' ? 'Sign Up' : 'Send Reset Link'
                        )}
                    </Button>
                </form>

                <div className="auth-switch mt-lg" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {mode === 'login' && (
                        <>
                            <Button variant="ghost" onClick={() => setMode('forgot')} className="w-full text-sm">
                                Forgot password?
                            </Button>
                            <Button variant="ghost" onClick={() => setMode('signup')} className="w-full text-sm">
                                Don't have an account? Sign up
                            </Button>
                        </>
                    )}
                    {mode === 'signup' && (
                        <Button variant="ghost" onClick={() => setMode('login')} className="w-full text-sm">
                            Already have an account? Sign in
                        </Button>
                    )}
                    {mode === 'forgot' && (
                        <Button variant="ghost" onClick={() => setMode('login')} className="w-full text-sm">
                            Back to sign in
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default LoginView;

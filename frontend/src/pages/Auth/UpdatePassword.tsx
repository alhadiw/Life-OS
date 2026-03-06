import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Activity, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Login.css'; // Reuse login styles

const UpdatePasswordView: React.FC = () => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters long.');
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            // Successfully updated
            alert('Password updated successfully!');
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'An error occurred while updating the password.');
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
                <p className="text-secondary">Set your new password</p>
            </div>

            <Card glass padding="lg" className="auth-card mt-xl">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <Lock size={20} className="text-primary" />
                    <h2 style={{ margin: 0 }}>Update Password</h2>
                </div>

                {error && <div className="auth-error mb-md">{error}</div>}

                <form onSubmit={handleUpdate} className="auth-form">
                    <div className="form-group mb-lg">
                        <Input
                            label="New Password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoFocus
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Updating...' : 'Save New Password'}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default UpdatePasswordView;

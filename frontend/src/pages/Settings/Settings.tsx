import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Sliders, Database, Download, Save, AlertTriangle, LogOut } from 'lucide-react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import './Settings.css';

const SettingsView: React.FC = () => {
    const { conversionRate, setConversionRate, currencySymbol, setCurrencySymbol, unspentPoints } = usePoints();
    const { user, signOut } = useAuth();

    const [localRate, setLocalRate] = useState(conversionRate.toString());
    const [localSymbol, setLocalSymbol] = useState(currencySymbol);

    const [profileData, setProfileData] = useState({
        name: '',
        email: user?.email || ''
    });

    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setLocalRate(conversionRate.toString());
        setLocalSymbol(currencySymbol);
    }, [conversionRate, currencySymbol]);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('display_name, email').eq('id', user.id).single();
            if (data) {
                setProfileData({
                    name: data.display_name || '',
                    email: data.email || user.email || ''
                });
            }
        };
        fetchProfile();
    }, [user]);

    const handleSavePointsSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const rateNumber = parseFloat(localRate);
        if (!isNaN(rateNumber) && rateNumber > 0) {
            await setConversionRate(rateNumber);
        }
        await setCurrencySymbol(localSymbol);
        alert('Economics settings saved successfully!');
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSavingProfile(true);
        try {
            const { error: profileError } = await supabase.from('profiles').update({
                display_name: profileData.name
            }).eq('id', user.id);

            if (profileError) throw profileError;

            // Optional: update email
            if (profileData.email !== user.email) {
                const { error: emailError } = await supabase.auth.updateUser({ email: profileData.email });
                if (emailError) throw emailError;
                alert('Profile saved! If you changed your email, please check your inbox to verify it.');
            } else {
                alert('Profile saved successfully!');
            }
        } catch (err: any) {
            alert(err.message || 'Failed to update profile.');
        } finally {
            setIsSavingProfile(false);
        }
    };



    const currentUnspentValue = (unspentPoints / conversionRate).toFixed(2);
    const previewUnspentValue = (unspentPoints / (parseFloat(localRate) || conversionRate)).toFixed(2);

    const handleExportData = async () => {
        if (!user) return;
        setIsExporting(true);
        try {
            // Fetch everything
            const [tasks, goals, bills, savings, investments, books, workouts, lists, history] = await Promise.all([
                supabase.from('tasks').select('*').eq('user_id', user.id),
                supabase.from('goals').select('*').eq('user_id', user.id),
                supabase.from('finance_bills').select('*').eq('user_id', user.id),
                supabase.from('finance_savings').select('*').eq('user_id', user.id),
                supabase.from('finance_investments').select('*').eq('user_id', user.id),
                supabase.from('books').select('*').eq('user_id', user.id),
                supabase.from('exercises').select('*').eq('user_id', user.id),
                supabase.from('user_lists').select('*, list_items(*)').eq('user_id', user.id),
                supabase.from('points_history').select('*').eq('user_id', user.id)
            ]);

            const exportPayload = {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                user: { id: user.id, email: user.email },
                data: {
                    tasks: tasks.data,
                    goals: goals.data,
                    finance: { bills: bills.data, savings: savings.data, investments: investments.data },
                    books: books.data,
                    workouts: workouts.data,
                    lists: lists.data,
                    pointsHistory: history.data
                }
            };

            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (err: any) {
            alert('Failed to export data: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        if (!window.confirm("CRITICAL WARNING: This will permanently delete all your data. This action CANNOT be undone. Are you absolutely sure?")) return;

        setIsDeleting(true);
        try {
            // Clean up all user data
            await Promise.all([
                supabase.from('tasks').delete().eq('user_id', user.id),
                supabase.from('goals').delete().eq('user_id', user.id),
                supabase.from('finance_bills').delete().eq('user_id', user.id),
                supabase.from('finance_savings').delete().eq('user_id', user.id),
                supabase.from('finance_investments').delete().eq('user_id', user.id),
                supabase.from('books').delete().eq('user_id', user.id),
                supabase.from('exercises').delete().eq('user_id', user.id),
                supabase.from('exercise_goals').delete().eq('user_id', user.id),
                // lists deletion auto-cascades to list_items
                supabase.from('user_lists').delete().eq('user_id', user.id),
                supabase.from('points_history').delete().eq('user_id', user.id)
            ]);

            // Delete profile
            await supabase.from('profiles').delete().eq('id', user.id);

            // Sign out
            await signOut();
        } catch (err: any) {
            alert('Failed to delete account data: ' + err.message);
            setIsDeleting(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Settings</h2>
                    <p className="text-secondary mt-1">Configure your preferences and account details.</p>
                </div>
            </div>

            <div className="settings-grid">
                {/* Points & Currency Configuration */}
                <section className="settings-section">
                    <div className="section-header">
                        <Sliders size={20} className="text-primary" />
                        <h3>Points Economics</h3>
                    </div>
                    <Card glass padding="lg">
                        <form onSubmit={handleSavePointsSettings} className="settings-form">
                            <div className="form-group mb-md">
                                <label className="input-label">Points to Currency Ratio</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                    <input
                                        type="number"
                                        value={localRate}
                                        onChange={e => setLocalRate(e.target.value)}
                                        min="1"
                                        step="0.01"
                                        className="input-field"
                                        style={{ width: '100px', margin: 0 }}
                                    />
                                    <span className="text-secondary font-bold">Points</span>
                                    <span className="text-muted font-bold">=</span>
                                    <span className="font-bold text-lg text-primary">{localSymbol || '$'}1.00</span>
                                </div>
                                <p className="setting-hint mt-sm">Set how many points equal 1.00 unit of your currency.</p>
                            </div>

                            <div className="form-group mb-md">
                                <Input
                                    label="Currency Symbol (e.g. $, €, £)"
                                    value={localSymbol}
                                    onChange={e => setLocalSymbol(e.target.value)}
                                    maxLength={5}
                                />
                                <p className="setting-hint">This is just the character used for display purposes.</p>
                            </div>

                            {(parseFloat(localRate) !== conversionRate || localSymbol !== currencySymbol) && (
                                <div className="rate-preview mt-md bg-warning-light p-sm" style={{ borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                    <strong>Preview:</strong> Your current unspent balance of {unspentPoints.toLocaleString()} points is worth <span className="font-bold">{currencySymbol}{currentUnspentValue}</span>. After saving, it will be displayed as <span className="font-bold">{localSymbol}{previewUnspentValue}</span>.
                                </div>
                            )}

                            <div className="form-actions mt-lg">
                                <Button type="submit"><Save size={16} /> Save Economy Settings</Button>
                            </div>
                        </form>
                    </Card>
                </section>

                {/* Profile Settings */}
                <section className="settings-section">
                    <div className="section-header">
                        <User size={20} className="text-primary" />
                        <h3>Profile & Account</h3>
                    </div>
                    <Card glass padding="lg">
                        <form className="settings-form" onSubmit={handleSaveProfile}>
                            <div className="form-group mb-md">
                                <Input
                                    label="Display Name"
                                    value={profileData.name}
                                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group mb-md">
                                <Input
                                    label="Email Address"
                                    type="email"
                                    value={profileData.email}
                                    onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <Button variant="secondary" type="button" onClick={async () => {
                                    if (window.confirm('Send a password recovery link to your email?')) {
                                        await supabase.auth.resetPasswordForEmail(user?.email || '', {
                                            redirectTo: `${window.location.origin}/update-password`,
                                        });
                                        alert('Password reset link sent!');
                                    }
                                }}>Change Password</Button>
                            </div>
                            <div className="form-actions mt-lg" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Button type="submit" disabled={isSavingProfile}>
                                    <Save size={16} /> {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </section>

                {/* Account Access */}
                <section className="settings-section">
                    <div className="section-header">
                        <LogOut size={20} className="text-primary" />
                        <h3>Account Access</h3>
                    </div>
                    <Card glass padding="lg">
                        <p className="text-secondary mb-md">Sign out of your Life OS account on this device.</p>
                        <Button type="button" variant="secondary" onClick={() => {
                            if (window.confirm('Are you sure you want to log out?')) signOut();
                        }}>
                            <LogOut size={16} /> Log Out
                        </Button>
                    </Card>
                </section>

                {/* Data Management */}
                <section className="settings-section">
                    <div className="section-header">
                        <Database size={20} className="text-primary" />
                        <h3>Data Management</h3>
                    </div>
                    <Card glass padding="lg">
                        <p className="text-secondary mb-md">Export your complete Life OS data as a JSON file for backup purposes.</p>
                        <Button variant="secondary" onClick={handleExportData} disabled={isExporting}>
                            <Download size={16} /> {isExporting ? 'Exporting...' : 'Export All Data'}
                        </Button>

                        <div className="danger-zone mt-xl">
                            <h4 className="text-danger mb-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={18} /> Danger Zone
                            </h4>
                            <p className="text-secondary mb-md">Permanently delete your account and all associated data. This action cannot be undone.</p>
                            <Button variant="danger" onClick={handleDeleteAccount} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete Account & Data'}
                            </Button>
                        </div>
                    </Card>
                </section>
            </div>
        </div>
    );
};

export default SettingsView;

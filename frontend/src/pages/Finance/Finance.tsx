import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Check, WalletCards, PiggyBank, TrendingUp, Calendar, Trash2, Edit2 } from 'lucide-react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import './Finance.css';

type FinanceTab = 'bills' | 'savings' | 'investments';

// --- Types ---
interface Bill {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    paid: boolean;
    category: string;
    frequency: string;
}

interface SavingsGoal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
}

interface Investment {
    id: string;
    platform: string;
    asset: string;
    amount: number;
    date: string;
}

const FinanceView: React.FC = () => {
    const { currencySymbol } = usePoints();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<FinanceTab>('bills');

    const [bills, setBills] = useState<Bill[]>([]);
    const [savings, setSavings] = useState<SavingsGoal[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);

    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Create Form States
    const [newBill, setNewBill] = useState({ name: '', amount: 0, dueDate: '', category: 'General', frequency: 'monthly' });
    const [newSaving, setNewSaving] = useState({ name: '', targetAmount: 0 });
    const [newInvestment, setNewInvestment] = useState({ platform: '', asset: '', amount: 0, date: new Date().toISOString().split('T')[0] });

    // Edit States
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [editingSaving, setEditingSaving] = useState<SavingsGoal | null>(null);
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

    useEffect(() => {
        if (user) {
            fetchFinanceData();
        }
    }, [user, activeTab]);

    const fetchFinanceData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'bills') {
                const { data, error } = await supabase.from('finance_bills').select('*').order('due_date', { ascending: true });
                if (error) throw error;
                if (data) {
                    setBills(data.map(b => ({
                        id: b.id, name: b.name, amount: Number(b.amount),
                        dueDate: b.due_date, paid: b.paid, category: b.category, frequency: b.frequency
                    })));
                }
            } else if (activeTab === 'savings') {
                const { data, error } = await supabase.from('finance_savings').select('*').order('created_at', { ascending: true });
                if (error) throw error;
                if (data) {
                    setSavings(data.map(s => ({
                        id: s.id, name: s.name, targetAmount: Number(s.target_amount), currentAmount: Number(s.current_amount)
                    })));
                }
            } else if (activeTab === 'investments') {
                const { data, error } = await supabase.from('finance_investments').select('*').order('investment_date', { ascending: false });
                if (error) throw error;
                if (data) {
                    setInvestments(data.map(i => ({
                        id: i.id, platform: i.platform, asset: i.asset, amount: Number(i.amount), date: i.investment_date
                    })));
                }
            }
        } catch (error) {
            console.error('Error fetching finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---
    const toggleBillPaid = async (id: string, currentlyPaid: boolean) => {
        const newPaidStatus = !currentlyPaid;
        setBills(prev => prev.map(b => b.id === id ? { ...b, paid: newPaidStatus } : b));
        try {
            await supabase.from('finance_bills').update({ paid: newPaidStatus }).eq('id', id);
        } catch (error) {
            console.error(error);
            setBills(prev => prev.map(b => b.id === id ? { ...b, paid: currentlyPaid } : b));
        }
    };

    const addSavings = async (id: string, currentAmount: number, addAmount: number) => {
        const newAmount = currentAmount + addAmount;
        setSavings(prev => prev.map(s => s.id === id ? { ...s, currentAmount: newAmount } : s));
        try {
            await supabase.from('finance_savings').update({ current_amount: newAmount }).eq('id', id);
        } catch (error) {
            console.error(error);
            setSavings(prev => prev.map(s => s.id === id ? { ...s, currentAmount: currentAmount } : s));
        }
    };

    // --- Create Handlers ---
    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newBill.name.trim() || !newBill.dueDate) return;
        try {
            const { data, error } = await supabase.from('finance_bills').insert({
                user_id: user.id, name: newBill.name, amount: newBill.amount, due_date: newBill.dueDate,
                category: newBill.category, frequency: newBill.frequency, paid: false
            }).select().single();

            if (error) throw error;
            if (data) {
                setBills(prev => [...prev, {
                    id: data.id, name: data.name, amount: Number(data.amount), dueDate: data.due_date,
                    paid: data.paid, category: data.category, frequency: data.frequency
                }].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
            }
            setShowForm(false);
            setNewBill({ name: '', amount: 0, dueDate: '', category: 'General', frequency: 'monthly' });
        } catch (e) { console.error(e); }
    };

    const handleCreateSaving = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newSaving.name.trim() || newSaving.targetAmount <= 0) return;
        try {
            const { data, error } = await supabase.from('finance_savings').insert({
                user_id: user.id, name: newSaving.name, target_amount: newSaving.targetAmount, current_amount: 0
            }).select().single();

            if (error) throw error;
            if (data) {
                setSavings(prev => [...prev, {
                    id: data.id, name: data.name, targetAmount: Number(data.target_amount), currentAmount: 0
                }]);
            }
            setShowForm(false);
            setNewSaving({ name: '', targetAmount: 0 });
        } catch (e) { console.error(e); }
    };

    const handleCreateInvestment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newInvestment.platform.trim() || !newInvestment.asset.trim()) return;
        try {
            const { data, error } = await supabase.from('finance_investments').insert({
                user_id: user.id, platform: newInvestment.platform, asset: newInvestment.asset,
                amount: newInvestment.amount, investment_date: newInvestment.date
            }).select().single();

            if (error) throw error;
            if (data) {
                setInvestments(prev => [{
                    id: data.id, platform: data.platform, asset: data.asset, amount: Number(data.amount), date: data.investment_date
                }, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
            setShowForm(false);
            setNewInvestment({ platform: '', asset: '', amount: 0, date: new Date().toISOString().split('T')[0] });
        } catch (e) { console.error(e); }
    };

    // --- Update Handlers ---
    const handleUpdateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBill || !editingBill.name.trim()) return;
        try {
            await supabase.from('finance_bills').update({
                name: editingBill.name, amount: editingBill.amount, due_date: editingBill.dueDate,
                category: editingBill.category, frequency: editingBill.frequency
            }).eq('id', editingBill.id);
            setBills(prev => prev.map(b => b.id === editingBill.id ? editingBill : b));
            setEditingBill(null);
        } catch (e) { console.error(e); }
    };

    const handleUpdateSaving = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSaving || !editingSaving.name.trim()) return;
        try {
            await supabase.from('finance_savings').update({
                name: editingSaving.name, target_amount: editingSaving.targetAmount
            }).eq('id', editingSaving.id);
            setSavings(prev => prev.map(s => s.id === editingSaving.id ? editingSaving : s));
            setEditingSaving(null);
        } catch (e) { console.error(e); }
    };

    const handleUpdateInvestment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvestment || !editingInvestment.platform.trim()) return;
        try {
            await supabase.from('finance_investments').update({
                platform: editingInvestment.platform, asset: editingInvestment.asset,
                amount: editingInvestment.amount, investment_date: editingInvestment.date
            }).eq('id', editingInvestment.id);
            setInvestments(prev => prev.map(i => i.id === editingInvestment.id ? editingInvestment : i));
            setEditingInvestment(null);
        } catch (e) { console.error(e); }
    };

    // --- Delete Handlers ---
    const handleDeleteBill = async (bill: Bill) => {
        if (!window.confirm(`Are you sure you want to delete bill "${bill.name}"?`)) return;
        try {
            await supabase.from('finance_bills').delete().eq('id', bill.id);
            setBills(prev => prev.filter(b => b.id !== bill.id));
        } catch (e) { console.error(e); }
    };
    const handleDeleteSaving = async (saving: SavingsGoal) => {
        if (!window.confirm(`Are you sure you want to delete goal "${saving.name}"?`)) return;
        try {
            await supabase.from('finance_savings').delete().eq('id', saving.id);
            setSavings(prev => prev.filter(s => s.id !== saving.id));
        } catch (e) { console.error(e); }
    };
    const handleDeleteInvestment = async (inv: Investment) => {
        if (!window.confirm(`Are you sure you want to delete investment "${inv.asset}"?`)) return;
        try {
            await supabase.from('finance_investments').delete().eq('id', inv.id);
            setInvestments(prev => prev.filter(i => i.id !== inv.id));
        } catch (e) { console.error(e); }
    };


    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Finance Hub</h2>
                    <p className="text-secondary mt-1">Track your bills, savings, and investments manually.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> Add {activeTab === 'bills' ? 'Bill' : activeTab === 'savings' ? 'Goal' : 'Investment'}
                </Button>
            </div>

            <div className="finance-summary-grid mb-xl">
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-danger-light"><WalletCards size={24} className="text-danger" /></div>
                    <div>
                        <div className="stat-label">Upcoming Bills (Unpaid)</div>
                        <div className="stat-value">{currencySymbol}{bills.filter(b => !b.paid).reduce((acc, b) => acc + b.amount, 0).toLocaleString()}</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-success-light"><PiggyBank size={24} className="text-success" /></div>
                    <div>
                        <div className="stat-label">Total Savings</div>
                        <div className="stat-value">{currencySymbol}{savings.reduce((acc, s) => acc + s.currentAmount, 0).toLocaleString()}</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-primary-light"><TrendingUp size={24} className="text-primary" /></div>
                    <div>
                        <div className="stat-label">Total Invested</div>
                        <div className="stat-value">{currencySymbol}{investments.reduce((acc, i) => acc + i.amount, 0).toLocaleString()}</div>
                    </div>
                </Card>
            </div>

            <div className="tabs mb-lg">
                <button className={`tab ${activeTab === 'bills' ? 'active' : ''}`} onClick={() => { setActiveTab('bills'); setShowForm(false); }}>Bills</button>
                <button className={`tab ${activeTab === 'savings' ? 'active' : ''}`} onClick={() => { setActiveTab('savings'); setShowForm(false); }}>Savings</button>
                <button className={`tab ${activeTab === 'investments' ? 'active' : ''}`} onClick={() => { setActiveTab('investments'); setShowForm(false); }}>Investments</button>
            </div>

            {/* Forms */}
            {showForm && activeTab === 'bills' && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateBill} className="task-form">
                        <Input label="Bill Name" value={newBill.name} onChange={e => setNewBill({ ...newBill, name: e.target.value })} autoFocus required />
                        <div className="form-row">
                            <Input type="number" step="0.01" label="Amount" value={newBill.amount} onChange={e => setNewBill({ ...newBill, amount: Number(e.target.value) })} required />
                            <Input type="date" label="Due Date" value={newBill.dueDate} onChange={e => setNewBill({ ...newBill, dueDate: e.target.value })} required />
                        </div>
                        <div className="form-group mb-md mt-sm">
                            <label className="input-label">Bill Type (Frequency)</label>
                            <select
                                className="input-field"
                                value={newBill.frequency}
                                onChange={e => setNewBill({ ...newBill, frequency: e.target.value })}
                            >
                                <option value="monthly">Recurring (Monthly)</option>
                                <option value="one-time">One-Time Only</option>
                            </select>
                            <p className="text-muted text-sm mt-xs">Recurring bills will automatically reset and update their due date on the 1st of every month.</p>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Create Bill</Button>
                        </div>
                    </form>
                </Card>
            )}

            {showForm && activeTab === 'savings' && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateSaving} className="task-form">
                        <Input label="Goal Name" value={newSaving.name} onChange={e => setNewSaving({ ...newSaving, name: e.target.value })} autoFocus required />
                        <Input type="number" label="Target Amount" value={newSaving.targetAmount} onChange={e => setNewSaving({ ...newSaving, targetAmount: Number(e.target.value) })} required />
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Create Goal</Button>
                        </div>
                    </form>
                </Card>
            )}

            {showForm && activeTab === 'investments' && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateInvestment} className="task-form">
                        <div className="form-row">
                            <Input label="Platform/Account" value={newInvestment.platform} onChange={e => setNewInvestment({ ...newInvestment, platform: e.target.value })} autoFocus required />
                            <Input label="Asset" value={newInvestment.asset} onChange={e => setNewInvestment({ ...newInvestment, asset: e.target.value })} required />
                        </div>
                        <div className="form-row">
                            <Input type="number" step="0.01" label="Amount Invested" value={newInvestment.amount} onChange={e => setNewInvestment({ ...newInvestment, amount: Number(e.target.value) })} required />
                            <Input type="date" label="Investment Date" value={newInvestment.date} onChange={e => setNewInvestment({ ...newInvestment, date: e.target.value })} required />
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Log Investment</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="finance-content">
                {loading && <p className="text-secondary text-center py-xl">Loading...</p>}

                {!loading && activeTab === 'bills' && (
                    <div className="finance-list">
                        {bills.map(bill => (
                            <Card key={bill.id} hoverable padding="sm" className={`bill-card ${bill.paid ? 'paid' : ''}`}>
                                <div className="bill-card-inner">
                                    <button
                                        className={`task-checkbox ${bill.paid ? 'checked' : ''}`}
                                        onClick={() => toggleBillPaid(bill.id, bill.paid)}
                                    >
                                        {bill.paid && <Check size={16} strokeWidth={3} />}
                                    </button>
                                    <div className="bill-details">
                                        <h4 className="bill-title">{bill.name}</h4>
                                        <div className="bill-meta">
                                            <span className="badge badge-neutral">{bill.frequency === 'monthly' ? 'Recurring (Monthly)' : 'One-Time'}</span>
                                            <span className="bill-date"><Calendar size={14} /> Due {bill.dueDate}</span>
                                        </div>
                                    </div>
                                    <div className={`bill-amount ${bill.paid ? 'text-secondary' : 'text-danger'}`}>
                                        {currencySymbol}{bill.amount.toLocaleString()}
                                    </div>
                                    <div className="finance-actions ml-md">
                                        <button className="icon-btn" onClick={() => setEditingBill(bill)}><Edit2 size={16} /></button>
                                        <button className="icon-btn hover-danger" onClick={() => handleDeleteBill(bill)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {bills.length === 0 && <p className="text-secondary text-center">No bills. Add one above.</p>}
                    </div>
                )}

                {!loading && activeTab === 'savings' && (
                    <div className="finance-grid">
                        {savings.map(goal => {
                            const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                            return (
                                <Card key={goal.id} padding="md" glass hoverable className="savings-card">
                                    <div className="savings-header">
                                        <h4>{goal.name}</h4>
                                        <div className="finance-actions">
                                            <button className="icon-btn" onClick={() => setEditingSaving(goal)}><Edit2 size={16} /></button>
                                            <button className="icon-btn hover-danger" onClick={() => handleDeleteSaving(goal)}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="savings-amounts mt-sm">
                                        <strong className="text-primary">{currencySymbol}{goal.currentAmount.toLocaleString()}</strong>
                                        <span className="text-muted"> / {currencySymbol}{goal.targetAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="progress-bg mt-md mb-md">
                                        <div className="progress-fill" style={{ width: `${percent}%` }}></div>
                                    </div>
                                    <div className="savings-actions-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <Button variant="secondary" size="sm" onClick={() => addSavings(goal.id, goal.currentAmount, 100)}>
                                            + {currencySymbol}100
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => addSavings(goal.id, goal.currentAmount, 500)}>
                                            + {currencySymbol}500
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                        {savings.length === 0 && <p className="text-secondary text-center width-full col-span-full">No savings goals. Add one above.</p>}
                    </div>
                )}

                {!loading && activeTab === 'investments' && (
                    <div className="finance-list">
                        {investments.length > 0 ? (
                            <table className="investments-table">
                                <thead>
                                    <tr>
                                        <th>Platform/Account</th>
                                        <th>Asset</th>
                                        <th>Amount</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {investments.map(inv => (
                                        <tr key={inv.id}>
                                            <td>{inv.platform}</td>
                                            <td>{inv.asset}</td>
                                            <td className="text-primary font-medium">{currencySymbol}{inv.amount.toLocaleString()}</td>
                                            <td className="text-muted">{inv.date}</td>
                                            <td>
                                                <div className="finance-actions" style={{ justifyContent: 'flex-end' }}>
                                                    <button className="icon-btn" onClick={() => setEditingInvestment(inv)}><Edit2 size={16} /></button>
                                                    <button className="icon-btn hover-danger" onClick={() => handleDeleteInvestment(inv)}><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state mt-lg">
                                <TrendingUp size={48} className="text-muted mb-sm" />
                                <p>No investments logged yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Editing Modals */}
            <Modal isOpen={!!editingBill} onClose={() => setEditingBill(null)} title="Edit Bill">
                {editingBill && (
                    <form onSubmit={handleUpdateBill}>
                        <Input label="Bill Name" value={editingBill.name} onChange={e => setEditingBill({ ...editingBill, name: e.target.value })} required />
                        <div className="form-row">
                            <Input type="number" step="0.01" label="Amount" value={editingBill.amount} onChange={e => setEditingBill({ ...editingBill, amount: Number(e.target.value) })} required />
                            <Input type="date" label="Due Date" value={editingBill.dueDate} onChange={e => setEditingBill({ ...editingBill, dueDate: e.target.value })} required />
                        </div>
                        <div className="form-group mb-md mt-sm">
                            <label className="input-label">Bill Type (Frequency)</label>
                            <select
                                className="input-field"
                                value={editingBill.frequency}
                                onChange={e => setEditingBill({ ...editingBill, frequency: e.target.value })}
                            >
                                <option value="monthly">Recurring (Monthly)</option>
                                <option value="one-time">One-Time Only</option>
                            </select>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingBill(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={!!editingSaving} onClose={() => setEditingSaving(null)} title="Edit Savings Goal">
                {editingSaving && (
                    <form onSubmit={handleUpdateSaving}>
                        <Input label="Goal Name" value={editingSaving.name} onChange={e => setEditingSaving({ ...editingSaving, name: e.target.value })} required />
                        <Input type="number" label="Target Amount" value={editingSaving.targetAmount} onChange={e => setEditingSaving({ ...editingSaving, targetAmount: Number(e.target.value) })} required />
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingSaving(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={!!editingInvestment} onClose={() => setEditingInvestment(null)} title="Edit Investment">
                {editingInvestment && (
                    <form onSubmit={handleUpdateInvestment}>
                        <div className="form-row">
                            <Input label="Platform/Account" value={editingInvestment.platform} onChange={e => setEditingInvestment({ ...editingInvestment, platform: e.target.value })} required />
                            <Input label="Asset" value={editingInvestment.asset} onChange={e => setEditingInvestment({ ...editingInvestment, asset: e.target.value })} required />
                        </div>
                        <div className="form-row">
                            <Input type="number" step="0.01" label="Amount Invested" value={editingInvestment.amount} onChange={e => setEditingInvestment({ ...editingInvestment, amount: Number(e.target.value) })} required />
                            <Input type="date" label="Investment Date" value={editingInvestment.date} onChange={e => setEditingInvestment({ ...editingInvestment, date: e.target.value })} required />
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingInvestment(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>

        </div>
    );
};

export default FinanceView;

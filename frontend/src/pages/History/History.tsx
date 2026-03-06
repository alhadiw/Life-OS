import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { History, ArrowUpRight, Search, Gift, Trash2 } from 'lucide-react';
import { usePoints } from '../../contexts/PointsContext';
import { format, parseISO } from 'date-fns';
import './History.css';

const HistoryView: React.FC = () => {
    const { history, lifetimePoints, totalMoneyEarned, currencySymbol, spendPoints, unspentPoints, conversionRate, clearHistory } = usePoints();
    const [searchTerm, setSearchTerm] = useState('');

    const [showRedeemForm, setShowRedeemForm] = useState(false);
    const [redeemDesc, setRedeemDesc] = useState('');
    const [redeemAmount, setRedeemAmount] = useState<number | ''>(''); // This is in points

    const filteredHistory = history.filter(tx =>
        tx.source.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRedeem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!redeemDesc || !redeemAmount || Number(redeemAmount) <= 0) return;

        if (Number(redeemAmount) > unspentPoints) {
            alert("You don't have enough points for this redemption.");
            return;
        }

        spendPoints(Number(redeemAmount), redeemDesc);
        setShowRedeemForm(false);
        setRedeemDesc('');
        setRedeemAmount('');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Points History</h2>
                    <p className="text-secondary mt-1">A complete ledger of your achievements and rewards.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant="ghost" className="text-danger hover-danger" onClick={clearHistory} title="Permanently delete all history and reset points to 0">
                        <Trash2 size={18} /> Clear History
                    </Button>
                    <Button onClick={() => setShowRedeemForm(!showRedeemForm)}>
                        <Gift size={18} /> Redeem Points
                    </Button>
                </div>
            </div>

            <div className="history-stats mb-lg">
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-success-light"><ArrowUpRight size={24} className="text-success" /></div>
                    <div>
                        <div className="stat-label">Total Earned All-Time</div>
                        <div className="stat-value">{lifetimePoints.toLocaleString()} pts</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-primary-light"><History size={24} className="text-primary" /></div>
                    <div>
                        <div className="stat-label">Total Transactions</div>
                        <div className="stat-value">{history.length}</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-warning-light"><Gift size={24} className="text-warning" /></div>
                    <div>
                        <div className="stat-label">Lifetime Value</div>
                        <div className="stat-value">{currencySymbol}{totalMoneyEarned.toFixed(2)}</div>
                    </div>
                </Card>
            </div>

            {showRedeemForm && (
                <Card glass className="mb-lg redeem-card">
                    <div className="redeem-header mb-md">
                        <h3>Redeem Points</h3>
                        <p className="text-secondary">Spend your hard-earned points on something nice for yourself! You have <strong className="text-warning">{unspentPoints.toLocaleString()}</strong> points ({currencySymbol}{(unspentPoints / conversionRate).toFixed(2)}) available.</p>
                    </div>
                    <form onSubmit={handleRedeem} className="redeem-form">
                        <Input
                            label="Reward Description"
                            value={redeemDesc}
                            onChange={e => setRedeemDesc(e.target.value)}
                            placeholder="e.g. Bought a coffee, New video game, Massage"
                            required
                        />
                        <div className="form-row">
                            <Input
                                type="number"
                                label="Points to Spend"
                                value={redeemAmount}
                                onChange={e => setRedeemAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="0"
                                required
                                min="1"
                                max={unspentPoints}
                            />
                            <div className="redeem-preview input-group">
                                <label className="input-label">Monetary Value</label>
                                <div className="input-field" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'transparent' }}>
                                    {currencySymbol}{redeemAmount ? (Number(redeemAmount) / conversionRate).toFixed(2) : '0.00'}
                                </div>
                            </div>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowRedeemForm(false)}>Cancel</Button>
                            <Button type="submit" variant="primary">Confirm Redemption</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="history-filters mb-md">
                <div className="search-bar">
                    <Search size={18} className="text-muted search-icon" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <Card padding="none" glass className="history-table-card">
                {filteredHistory.length > 0 ? (
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Source</th>
                                <th>Points</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map(tx => {
                                const isPositive = tx.points > 0;
                                return (
                                    <tr key={tx.id}>
                                        <td className="text-muted">
                                            {format(parseISO(tx.timestamp), 'MMM d, yyyy • h:mm a')}
                                        </td>
                                        <td className="font-medium">{tx.source}</td>
                                        <td className={isPositive ? 'text-success font-bold' : 'text-danger font-bold'}>
                                            {isPositive ? '+' : ''}{tx.points.toLocaleString()}
                                        </td>
                                        <td className="text-secondary">
                                            {isPositive ? '+' : ''}{currencySymbol}{tx.monetaryValue.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <History size={48} className="text-muted mb-sm" />
                        <h3 className="mb-1">No Transactions Found</h3>
                        <p className="text-secondary">
                            {searchTerm ? "No transactions match your search." : "Complete tasks and goals to earn your first points!"}
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default HistoryView;

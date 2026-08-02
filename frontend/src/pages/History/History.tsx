import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonList } from '../../components/ui/Skeleton';
import { History, ArrowUpRight, Search, Gift, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useQuery } from '../../hooks/useQuery';
import { format, parseISO } from 'date-fns';
import './History.css';

/** FIX-14 — rows per page. The whole ledger used to load on every login. */
const PAGE_SIZE = 50;

interface LedgerRow {
    rows: {
        id: string;
        created_at: string;
        points: number;
        source: string;
        monetary_value: number;
    }[];
    total: number;
}

const HistoryView: React.FC = () => {
    const { lifetimePoints, totalMoneyEarned, currencySymbol, spendPoints, unspentPoints, conversionRate, clearHistory, entryCount } = usePoints();
    const { user } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);

    const [showRedeemForm, setShowRedeemForm] = useState(false);
    const [redeemDesc, setRedeemDesc] = useState('');
    const [redeemAmount, setRedeemAmount] = useState<number | ''>(''); // This is in points

    // Searching now hits the database rather than an array in memory, so it is
    // debounced — otherwise every keystroke is a query.
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(0);
        }, 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // FIX-14 — one page at a time, with the count coming back in the same
    // round trip via PostgREST's exact count.
    const ledger = useQuery<LedgerRow>(
        user ? `points:history:${debouncedSearch}:${page}` : null,
        async () => {
            let q = supabase
                .from('points_history')
                .select('id, created_at, points, source, monetary_value', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

            if (debouncedSearch) {
                // ilike is index-less but the ledger is per-user and small;
                // correctness first, and it matches the previous behaviour.
                q = q.ilike('source', `%${debouncedSearch}%`);
            }

            const { data, error, count } = await q;
            if (error) throw error;
            return { rows: data ?? [], total: count ?? 0 };
        }
    );

    const rows = ledger.data?.rows ?? [];
    const total = ledger.data?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleRedeem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!redeemDesc || !redeemAmount || Number(redeemAmount) <= 0) return;

        // spendPoints itself refuses and explains if the balance is short.
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
                    <Button variant="ghost" className="text-danger hover-danger" onClick={clearHistory} title="Permanently delete every points transaction and reset your balance to 0. Nothing else is affected.">
                        <Trash2 size={18} /> Erase Points History
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
                        <div className="stat-value">{entryCount.toLocaleString()}</div>
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
                {ledger.loading ? (
                    <div style={{ padding: '1rem' }}>
                        <SkeletonList count={6} label="Loading transactions" />
                    </div>
                ) : rows.length > 0 ? (
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
                            {rows.map(tx => {
                                const isPositive = tx.points > 0;
                                return (
                                    <tr key={tx.id}>
                                        <td className="text-muted">
                                            {format(parseISO(tx.created_at), 'MMM d, yyyy • h:mm a')}
                                        </td>
                                        <td className="font-medium">{tx.source}</td>
                                        <td className={isPositive ? 'text-success font-bold' : 'text-danger font-bold'}>
                                            {isPositive ? '+' : ''}{tx.points.toLocaleString()}
                                        </td>
                                        <td className="text-secondary">
                                            {isPositive ? '+' : ''}{currencySymbol}{Number(tx.monetary_value).toFixed(2)}
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
                            {searchTerm ? "No transactions match your search." : "Complete tasks, habits and goals to earn your first points!"}
                        </p>
                    </div>
                )}
            </Card>

            {pageCount > 1 && (
                <div className="history-pager mt-md">
                    <Button
                        variant="ghost"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0 || ledger.loading}
                    >
                        <ChevronLeft size={16} /> Previous
                    </Button>
                    <span className="text-secondary">
                        Page {page + 1} of {pageCount} · {total.toLocaleString()} transactions
                    </span>
                    <Button
                        variant="ghost"
                        onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                        disabled={page >= pageCount - 1 || ledger.loading}
                    >
                        Next <ChevronRight size={16} />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default HistoryView;

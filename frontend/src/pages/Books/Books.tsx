import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonGrid } from '../../components/ui/Skeleton';
import { BookOpen, Star, Clock, CheckCircle2, Plus, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { useQuery, fromSupabase, invalidate, setQueryData } from '../../hooks/useQuery';
import './Books.css';

type BookStatus = 'want_to_read' | 'reading' | 'finished';

interface Book {
    id: string;
    title: string;
    author: string;
    status: BookStatus;
    genre?: string;
    rating?: number;
    coverImage?: string;
}

const BooksView: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<BookStatus>('reading');

    const [showForm, setShowForm] = useState(false);
    const [newBook, setNewBook] = useState({ title: '', author: '', genre: '', coverImage: '' });

    const [editingBook, setEditingBook] = useState<Book | null>(null);

    // ARCH-3 — one shared, cached query instead of a hand-rolled useEffect.
    const booksQ = useQuery<Book[]>(user ? 'books' : null, async () => {
        const rows = await fromSupabase(
            supabase.from('books').select('*').order('created_at', { ascending: false })
        );
        return rows.map(b => ({
            id: b.id, title: b.title, author: b.author, status: b.status as BookStatus,
            genre: b.genre ?? undefined, rating: b.rating ?? undefined,
            coverImage: b.cover_image ?? undefined
        }));
    });

    const books = booksQ.data ?? [];
    const loading = booksQ.loading;

    const handleCreateBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newBook.title.trim() || !newBook.author.trim()) return;

        try {
            const { error } = await supabase.from('books').insert({
                user_id: user.id,
                title: newBook.title,
                author: newBook.author,
                status: activeTab,
                genre: newBook.genre,
                cover_image: newBook.coverImage
            });

            if (error) throw error;
            invalidate('books');
            setShowForm(false);
            setNewBook({ title: '', author: '', genre: '', coverImage: '' });
        } catch (error) {
            console.error(error);
            toast.error("Couldn't add that book.");
        }
    };

    const handleUpdateBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBook || !editingBook.title.trim() || !editingBook.author.trim()) return;

        const { error } = await supabase.from('books').update({
            title: editingBook.title,
            author: editingBook.author,
            genre: editingBook.genre,
            cover_image: editingBook.coverImage,
            rating: editingBook.rating
        }).eq('id', editingBook.id);

        if (error) {
            console.error(error);
            toast.error("Couldn't save that book.");
            return;
        }
        invalidate('books');
        setEditingBook(null);
    };

    const handleDeleteBook = async (book: Book) => {
        if (!window.confirm(`Are you sure you want to delete "${book.title}"?`)) return;
        const { error } = await supabase.from('books').delete().eq('id', book.id);
        if (error) {
            console.error(error);
            toast.error("Couldn't delete that book.");
            return;
        }
        invalidate('books');
    };

    const moveBook = async (id: string, newStatus: BookStatus) => {
        if (!books.some(b => b.id === id)) return;

        // Optimistic through the cache rather than local state, so every
        // component reading 'books' moves together. On failure we re-read the
        // truth instead of trying to reconstruct it (FIX-2's contract: the UI
        // must never keep showing a change the database rejected).
        setQueryData<Book[]>('books', prev =>
            (prev ?? []).map(b => (b.id === id ? { ...b, status: newStatus } : b)));

        const { error } = await supabase.from('books').update({ status: newStatus }).eq('id', id);
        if (error) {
            console.error(error);
            invalidate('books');
            toast.error("Couldn't move that book.");
            return;
        }
        invalidate('books');
    };

    const filteredBooks = books.filter(b => b.status === activeTab);

    const getStatusIcon = (status: BookStatus) => {
        if (status === 'want_to_read') return <Clock size={16} />;
        if (status === 'reading') return <BookOpen size={16} />;
        return <CheckCircle2 size={16} />;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Books Library</h2>
                    <p className="text-secondary mt-1">Track your reading progress and catalog your books.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> Add Book
                </Button>
            </div>

            <div className="books-stats mb-xl">
                <div className="book-stat">
                    <div className="book-stat-value">{books.filter(b => b.status === 'finished').length}</div>
                    <div className="book-stat-label">Finished</div>
                </div>
                <div className="book-stat">
                    <div className="book-stat-value">{books.filter(b => b.status === 'reading').length}</div>
                    <div className="book-stat-label">Reading</div>
                </div>
                <div className="book-stat">
                    <div className="book-stat-value">{books.filter(b => b.status === 'want_to_read').length}</div>
                    <div className="book-stat-label">To Read</div>
                </div>
            </div>

            <div className="tabs mb-lg">
                <button className={`tab ${activeTab === 'reading' ? 'active' : ''}`} onClick={() => { setActiveTab('reading'); setShowForm(false); }}>Reading</button>
                <button className={`tab ${activeTab === 'want_to_read' ? 'active' : ''}`} onClick={() => { setActiveTab('want_to_read'); setShowForm(false); }}>Want to Read</button>
                <button className={`tab ${activeTab === 'finished' ? 'active' : ''}`} onClick={() => { setActiveTab('finished'); setShowForm(false); }}>Finished</button>
            </div>

            {showForm && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateBook} className="task-form">
                        <div className="form-row">
                            <Input label="Title" value={newBook.title} onChange={e => setNewBook({ ...newBook, title: e.target.value })} autoFocus required />
                            <Input label="Author" value={newBook.author} onChange={e => setNewBook({ ...newBook, author: e.target.value })} required />
                        </div>
                        <div className="form-row">
                            <Input label="Genre" value={newBook.genre} onChange={e => setNewBook({ ...newBook, genre: e.target.value })} />
                            <Input label="Cover Image URL (Optional)" value={newBook.coverImage} onChange={e => setNewBook({ ...newBook, coverImage: e.target.value })} />
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Add Book</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="books-grid">
                {loading && <SkeletonGrid count={6} height="280px" label="Loading library" />}

                {!loading && filteredBooks.map(book => (
                    <Card key={book.id} hoverable padding="none" className="book-card">
                        <div className="book-cover-container">
                            {book.coverImage ? (
                                <img src={book.coverImage} alt={`Cover for ${book.title}`} className="book-cover" />
                            ) : (
                                <div className="book-cover-placeholder">
                                    <BookOpen size={32} className="text-muted" />
                                </div>
                            )}
                            <div className="book-status-badge">
                                {getStatusIcon(book.status)}
                            </div>
                        </div>
                        <div className="book-info">
                            <h4 className="book-title">{book.title}</h4>
                            <p className="book-author">{book.author}</p>

                            <div className="book-meta mt-2 mb-md">
                                {book.genre && <span className="badge badge-neutral">{book.genre}</span>}
                                {book.rating && (
                                    <div className="book-rating text-warning">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} size={14} fill={i < book.rating! ? "currentColor" : "none"} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="book-actions">
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button className="book-icon-btn text-secondary" onClick={() => setEditingBook(book)} aria-label="Edit Book">
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="book-icon-btn text-secondary hover-danger" onClick={() => handleDeleteBook(book)} aria-label="Delete Book">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div style={{ flex: 1 }}>
                                    {book.status === 'want_to_read' && (
                                        <Button size="sm" fullWidth onClick={() => moveBook(book.id, 'reading')}>Start</Button>
                                    )}
                                    {book.status === 'reading' && (
                                        <Button size="sm" fullWidth onClick={() => moveBook(book.id, 'finished')}>Finish</Button>
                                    )}
                                    {book.status === 'finished' && (
                                        <Button size="sm" variant="secondary" fullWidth disabled>Completed</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}

                {!loading && filteredBooks.length === 0 && !showForm && (
                    <div className="empty-state col-span-full">
                        <BookOpen size={48} className="text-muted mb-sm" />
                        <p>No books in this section.</p>
                    </div>
                )}
            </div>

            <Modal isOpen={!!editingBook} onClose={() => setEditingBook(null)} title="Edit Book">
                {editingBook && (
                    <form onSubmit={handleUpdateBook}>
                        <div className="form-row">
                            <Input label="Title" value={editingBook.title} onChange={e => setEditingBook({ ...editingBook, title: e.target.value })} required />
                            <Input label="Author" value={editingBook.author} onChange={e => setEditingBook({ ...editingBook, author: e.target.value })} required />
                        </div>
                        <div className="form-row">
                            <Input label="Genre" value={editingBook.genre} onChange={e => setEditingBook({ ...editingBook, genre: e.target.value })} />
                            <Input label="Cover Image URL" value={editingBook.coverImage || ''} onChange={e => setEditingBook({ ...editingBook, coverImage: e.target.value })} />
                        </div>
                        {editingBook.status === 'finished' && (
                            <div className="form-row">
                                <Input type="number" label="Rating (1-5)" min={1} max={5} value={editingBook.rating || ''} onChange={e => setEditingBook({ ...editingBook, rating: Number(e.target.value) })} />
                            </div>
                        )}
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingBook(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default BooksView;

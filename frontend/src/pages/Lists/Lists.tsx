import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ShoppingCart, Film, Plane, Book, CheckSquare, Plus, Check, ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import './Lists.css';

interface ListItem {
    id: string;
    text: string;
    checked: boolean;
}

interface UserList {
    id: string;
    name: string;
    iconName: 'ShoppingCart' | 'Film' | 'Plane' | 'Book' | 'CheckSquare';
    color: string;
    items: ListItem[];
}

const IconMap = {
    ShoppingCart,
    Film,
    Plane,
    Book,
    CheckSquare
};

const defaultColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

const ListsView: React.FC = () => {
    const { user } = useAuth();
    const [lists, setLists] = useState<UserList[]>([]);
    const [activeListId, setActiveListId] = useState<string | null>(null);
    const [newItemText, setNewItemText] = useState('');
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [newList, setNewList] = useState({ name: '', iconName: 'CheckSquare' as UserList['iconName'], color: defaultColors[0] });

    // Edit states
    const [editingList, setEditingList] = useState<UserList | null>(null);
    const [editingItem, setEditingItem] = useState<{ listId: string, item: ListItem } | null>(null);

    useEffect(() => {
        if (user) fetchLists();
    }, [user]);

    const fetchLists = async () => {
        setLoading(true);
        try {
            const { data: listsData, error: listsError } = await supabase
                .from('user_lists')
                .select('*')
                .order('created_at', { ascending: false });

            if (listsError) throw listsError;

            if (listsData) {
                const listIds = listsData.map(l => l.id);

                let itemsData: any[] = [];
                if (listIds.length > 0) {
                    const { data: fetchItems, error: itemsError } = await supabase
                        .from('list_items')
                        .select('*')
                        .in('list_id', listIds)
                        .order('created_at', { ascending: true });

                    if (itemsError) throw itemsError;
                    if (fetchItems) itemsData = fetchItems;
                }

                const formattedLists: UserList[] = listsData.map(l => {
                    const listItems = itemsData.filter(item => item.list_id === l.id).map(item => ({
                        id: item.id,
                        text: item.text,
                        checked: item.checked
                    }));

                    return {
                        id: l.id,
                        name: l.name,
                        iconName: l.icon as UserList['iconName'] || 'CheckSquare',
                        color: l.color || '#3B82F6',
                        items: listItems
                    };
                });

                setLists(formattedLists);
            }
        } catch (error) {
            console.error('Error fetching lists:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Create Actions ---
    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newList.name.trim()) return;

        try {
            const { data, error } = await supabase.from('user_lists').insert({
                user_id: user.id,
                name: newList.name,
                icon: newList.iconName,
                color: newList.color
            }).select().single();

            if (error) throw error;
            if (data) {
                setLists(prev => [{
                    id: data.id, name: data.name, iconName: data.icon as UserList['iconName'],
                    color: data.color, items: []
                }, ...prev]);
            }
            setShowForm(false);
            setNewList({ name: '', iconName: 'CheckSquare', color: defaultColors[0] });
        } catch (error) {
            console.error(error);
        }
    };

    const addItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newItemText.trim() || !activeListId) return;

        try {
            const { data, error } = await supabase.from('list_items').insert({
                user_id: user.id, list_id: activeListId, text: newItemText, checked: false
            }).select().single();

            if (error) throw error;
            if (data) {
                const newItem: ListItem = { id: data.id, text: data.text, checked: data.checked };
                setLists(prev => prev.map(l => l.id === activeListId ? { ...l, items: [...l.items, newItem] } : l));
            }
            setNewItemText('');
        } catch (error) {
            console.error(error);
        }
    };

    // --- Edit Actions ---
    const handleUpdateList = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingList || !editingList.name.trim()) return;

        try {
            await supabase.from('user_lists').update({
                name: editingList.name, icon: editingList.iconName, color: editingList.color
            }).eq('id', editingList.id);

            setLists(prev => prev.map(l => l.id === editingList.id ? editingList : l));
            setEditingList(null);
        } catch (error) {
            console.error('Error updating list:', error);
        }
    };

    const handleUpdateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem || !editingItem.item.text.trim()) return;

        try {
            await supabase.from('list_items').update({
                text: editingItem.item.text
            }).eq('id', editingItem.item.id);

            setLists(prev => prev.map(l => {
                if (l.id !== editingItem.listId) return l;
                return {
                    ...l,
                    items: l.items.map(i => i.id === editingItem.item.id ? editingItem.item : i)
                };
            }));
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating item:', error);
        }
    };

    const toggleItem = async (listId: string, itemId: string) => {
        const itemToUpdate = lists.find(l => l.id === listId)?.items.find(i => i.id === itemId);
        if (!itemToUpdate) return;

        const newCheckedStatus = !itemToUpdate.checked;
        setLists(prev => prev.map(l => l.id === listId ? {
            ...l, items: l.items.map(item => item.id === itemId ? { ...item, checked: newCheckedStatus } : item)
        } : l));

        try {
            await supabase.from('list_items').update({ checked: newCheckedStatus }).eq('id', itemId);
        } catch (error) {
            console.error(error);
            setLists(prev => prev.map(l => l.id === listId ? {
                ...l, items: l.items.map(item => item.id === itemId ? { ...item, checked: !newCheckedStatus } : item)
            } : l));
        }
    };

    // --- Delete Actions ---
    const handleDeleteList = async (list: UserList) => {
        if (!window.confirm(`Are you sure you want to delete the list "${list.name}"?`)) return;
        try {
            await supabase.from('user_lists').delete().eq('id', list.id);
            setLists(prev => prev.filter(l => l.id !== list.id));
        } catch (error) {
            console.error('Error deleting list:', error);
        }
    };

    const handleDeleteItem = async (listId: string, item: ListItem) => {
        if (!window.confirm(`Are you sure you want to delete "${item.text}"?`)) return;
        try {
            await supabase.from('list_items').delete().eq('id', item.id);
            setLists(prev => prev.map(l => l.id === listId ? {
                ...l, items: l.items.filter(i => i.id !== item.id)
            } : l));
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const clearCompleted = async () => {
        if (!activeListId) return;
        const listToClear = lists.find(l => l.id === activeListId);
        if (!listToClear) return;

        const completedItemIds = listToClear.items.filter(i => i.checked).map(i => i.id);
        if (completedItemIds.length === 0) return;

        setLists(prev => prev.map(l => l.id === activeListId ? {
            ...l, items: l.items.filter(item => !item.checked)
        } : l));

        try {
            await supabase.from('list_items').delete().in('id', completedItemIds);
        } catch (error) {
            console.error('Error clearing items:', error);
            fetchLists(); // revert
        }
    };


    const activeList = lists.find(l => l.id === activeListId);

    if (activeList) {
        const Icon = IconMap[activeList.iconName];
        const completedCount = activeList.items.filter(i => i.checked).length;
        const totalCount = activeList.items.length;

        return (
            <div className="animate-fade-in">
                <div className="list-detail-header mb-lg">
                    <Button variant="ghost" className="back-btn" onClick={() => setActiveListId(null)}>
                        <ChevronLeft size={20} /> Back
                    </Button>
                    <div className="list-title-header mt-md">
                        <div className="list-icon-large" style={{ backgroundColor: `${activeList.color}20`, color: activeList.color }}>
                            <Icon size={32} />
                        </div>
                        <div>
                            <h2>{activeList.name}</h2>
                            <p className="text-secondary">{completedCount} of {totalCount} completed</p>
                        </div>
                    </div>
                </div>

                <div className="list-progress mb-xl">
                    <div className="progress-bg" style={{ height: '6px' }}>
                        <div className="progress-fill" style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%', backgroundColor: activeList.color }}></div>
                    </div>
                </div>

                <form onSubmit={addItem} className="add-item-form mb-lg">
                    <Input value={newItemText} onChange={(e) => setNewItemText(e.target.value)} placeholder="Add a new item..." autoFocus />
                    <Button type="submit"><Plus size={18} /> Add</Button>
                </form>

                <div className="list-items">
                    {activeList.items.map(item => (
                        <div key={item.id} className={`list-item ${item.checked ? 'checked' : ''}`}>
                            <button
                                className={`task-checkbox ${item.checked ? 'checked' : ''}`}
                                style={item.checked ? { backgroundColor: activeList.color, borderColor: activeList.color } : {}}
                                onClick={() => toggleItem(activeList.id, item.id)}
                            >
                                {item.checked && <Check size={16} strokeWidth={3} />}
                            </button>
                            <span className="list-item-text">{item.text}</span>
                            <div className="item-actions-hover">
                                <button className="icon-btn text-secondary" onClick={() => setEditingItem({ listId: activeList.id, item })}><Edit2 size={16} /></button>
                                <button className="icon-btn text-secondary hover-danger" onClick={() => handleDeleteItem(activeList.id, item)}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {activeList.items.length === 0 && (
                        <p className="text-muted text-center mt-xl">This list is empty. Add something above!</p>
                    )}
                </div>

                {completedCount > 0 && (
                    <div className="list-actions mt-xl">
                        <Button variant="ghost" onClick={clearCompleted} className="text-danger">
                            <Trash2 size={16} /> Clear Completed
                        </Button>
                    </div>
                )}

                {/* Edit Item Modal */}
                <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Item">
                    {editingItem && (
                        <form onSubmit={handleUpdateItem}>
                            <Input
                                label="Item Text"
                                value={editingItem.item.text}
                                onChange={e => setEditingItem({ listId: editingItem.listId, item: { ...editingItem.item, text: e.target.value } })}
                                required autoFocus
                            />
                            <div className="form-actions mt-md">
                                <Button type="button" variant="ghost" onClick={() => setEditingItem(null)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        );
    }

    // --- Grid View ---
    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>My Lists</h2>
                    <p className="text-secondary mt-1">Flexible checklists for anything in your life.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> New List
                </Button>
            </div>

            {showForm && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateList} className="task-form">
                        <Input label="List Name" value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })} autoFocus required placeholder="e.g. Shopping, Movies" />
                        <div className="form-row">
                            <div className="input-group">
                                <label className="input-label">Icon</label>
                                <select className="input-field" value={newList.iconName} onChange={e => setNewList({ ...newList, iconName: e.target.value as UserList['iconName'] })}>
                                    <option value="CheckSquare">Checklist</option>
                                    <option value="ShoppingCart">Shopping Cart</option>
                                    <option value="Film">Film Reel</option>
                                    <option value="Book">Book</option>
                                    <option value="Plane">Airplane</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Color</label>
                                <div className="color-picker" style={{ display: 'flex', gap: '8px', padding: '8px 0' }}>
                                    {defaultColors.map(color => (
                                        <button
                                            key={color} type="button" onClick={() => setNewList({ ...newList, color })}
                                            style={{
                                                width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color,
                                                border: newList.color === color ? '2px solid white' : '2px solid transparent', cursor: 'pointer'
                                            }}
                                            aria-label={`Select color ${color}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Create List</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="lists-grid">
                {loading && <p className="text-secondary col-span-full text-center py-lg">Loading lists...</p>}

                {!loading && lists.map(list => {
                    const Icon = IconMap[list.iconName] || CheckSquare;
                    const total = list.items.length;
                    const completed = list.items.filter(i => i.checked).length;
                    const percent = total > 0 ? (completed / total) * 100 : 0;

                    return (
                        <Card key={list.id} glass hoverable padding="md" className="list-folder-card" onClick={() => setActiveListId(list.id)}>
                            <div className="list-folder-header">
                                <div className="list-icon-badge" style={{ backgroundColor: `${list.color}20`, color: list.color }}>
                                    <Icon size={24} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="badge badge-neutral">{completed}/{total}</span>
                                    <div className="list-actions-hover">
                                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setEditingList(list); }}><Edit2 size={16} /></button>
                                        <button className="icon-btn hover-danger" onClick={(e) => { e.stopPropagation(); handleDeleteList(list); }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                            <h4 className="list-folder-title">{list.name}</h4>
                            <div className="progress-bg mt-sm">
                                <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: list.color }}></div>
                            </div>
                        </Card>
                    );
                })}

                {!loading && lists.length === 0 && !showForm && (
                    <div className="empty-state col-span-full">
                        <CheckSquare size={48} className="text-muted mb-sm" />
                        <p>No lists yet. Add one above.</p>
                    </div>
                )}
            </div>

            {/* Edit List Folder Modal */}
            <Modal isOpen={!!editingList} onClose={() => setEditingList(null)} title="Edit List">
                {editingList && (
                    <form onSubmit={handleUpdateList}>
                        <Input label="List Name" value={editingList.name} onChange={e => setEditingList({ ...editingList, name: e.target.value })} required />
                        <div className="form-row">
                            <div className="input-group">
                                <label className="input-label">Icon</label>
                                <select className="input-field" value={editingList.iconName} onChange={e => setEditingList({ ...editingList, iconName: e.target.value as UserList['iconName'] })}>
                                    <option value="CheckSquare">Checklist</option>
                                    <option value="ShoppingCart">Shopping Cart</option>
                                    <option value="Film">Film Reel</option>
                                    <option value="Book">Book</option>
                                    <option value="Plane">Airplane</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Color</label>
                                <div className="color-picker" style={{ display: 'flex', gap: '8px', padding: '8px 0' }}>
                                    {defaultColors.map(color => (
                                        <button
                                            key={color} type="button" onClick={() => setEditingList({ ...editingList, color })}
                                            style={{
                                                width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color,
                                                border: editingList.color === color ? '2px solid white' : '2px solid transparent', cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingList(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ListsView;

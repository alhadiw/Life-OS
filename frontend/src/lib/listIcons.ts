import { ShoppingCart, Film, Plane, Book, CheckSquare } from 'lucide-react';

/**
 * The icons a user list can carry.
 *
 * `user_lists.icon` is a plain text column holding the icon's *name*, so
 * rendering it needs this lookup. The Dashboard was missing it and printed the
 * raw string — "CheckSquare Things I want to buy" — while the Lists page kept a
 * private copy of the map. One shared table means the two cannot drift, and the
 * fallback means an unknown name renders an icon rather than leaking a
 * database value into the UI.
 */
export const LIST_ICONS = {
    ShoppingCart,
    Film,
    Plane,
    Book,
    CheckSquare
} as const;

export type ListIconName = keyof typeof LIST_ICONS;

export const listIcon = (name: string | null | undefined) =>
    LIST_ICONS[name as ListIconName] ?? CheckSquare;

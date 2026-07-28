/**
 * Pull a human-readable message out of anything a `catch` can hand you.
 *
 * Supabase rejects with `PostgrestError`, which is a plain object with a
 * `message` — not an `Error` — so `err.message` needs a type assertion and
 * `String(err)` gives you "[object Object]". This handles both, plus the
 * genuinely unexpected.
 */
export const errorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
        return String((err as { message: unknown }).message);
    }
    return 'Something went wrong.';
};

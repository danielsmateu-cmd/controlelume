import { createClient } from '@supabase/supabase-js';

let cachedClient = null;

export function getSupabaseClient() {
    if (cachedClient) return cachedClient;
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error('Supabase URL/Key não configurados nas variáveis de ambiente.');
    }
    cachedClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    return cachedClient;
}

export async function getSetting(key, fallback = null, client = null) {
    const sb = client || getSupabaseClient();
    const { data, error } = await sb
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    if (error) {
        console.error(`Error reading setting "${key}":`, error.message);
        return fallback;
    }
    return data?.value ?? fallback;
}

export async function saveSetting(key, value, client = null) {
    const sb = client || getSupabaseClient();
    const { error } = await sb
        .from('settings')
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error(`Error saving setting "${key}":`, error.message);
        return false;
    }
    return true;
}

export async function verifyAdminCredentials(login, password, client = null) {
    if (!login || !password) return null;
    const users = await getSetting('system_users', [], client);
    const matched = (Array.isArray(users) ? users : []).find(
        u => u.login === login && u.password === password
    );
    if (!matched) return null;
    const isAdmin = matched.role === 'admin' || matched.login === 'dsmateu';
    return isAdmin ? { id: matched.id, name: matched.name, login: matched.login, role: matched.role } : null;
}

export async function verifySessionUser(userId, login, client = null) {
    if (!userId && !login) return null;
    const users = await getSetting('system_users', [], client);
    return (Array.isArray(users) ? users : []).find(
        u => (userId && u.id === userId) || (login && u.login === login)
    ) || null;
}

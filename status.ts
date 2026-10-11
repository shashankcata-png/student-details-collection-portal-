import { db, isPostgresConfigured } from '../server/db.js';
import { isSupabaseAuthConfigured } from '../server/supabase-auth.js';

export default async function handler(req: any, res: any) {
  const configured = isPostgresConfigured();
  const payload: Record<string, unknown> = {
    databaseConfigured: configured,
    databaseType: configured ? 'Supabase PostgreSQL' : 'Memory Database (Fallback)',
    supabaseAuthConfigured: isSupabaseAuthConfigured(),
  };

  if (req?.query?.check === '1' || req?.query?.probe === 'true') {
    try {
      const isLive = await db.ping();
      payload.databaseConnected = isLive;
      return res.status(isLive ? 200 : 503).json(payload);
    } catch {
      payload.databaseConnected = false;
      return res.status(503).json(payload);
    }
  }

  return res.json(payload);
}

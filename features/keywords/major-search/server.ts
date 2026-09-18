import { createClient } from '@supabase/supabase-js';

import 'server-only';
export function majorSearchDb() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('전공 검색 기록을 위한 서버 설정이 필요합니다.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type RuntimeConfig = {
  naverClientId?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

declare global {
  interface Window { MBCPLUS_MAP_CONFIG?: RuntimeConfig }
}

let client:SupabaseClient|null = null;

export function getSupabaseClient(){
  if(typeof window==='undefined') return null;
  if(client) return client;
  const config=window.MBCPLUS_MAP_CONFIG;
  if(!config?.supabaseUrl||!config?.supabasePublishableKey) return null;
  client=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}

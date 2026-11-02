import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useStore, now, loadData } from '../data/store';
import { getDatabase, upsert } from '../data/database';
import { SYNC_TABLES } from '../data/schema';
import type { Entity, Row } from '../lib/types';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudConfigured=!!(url&&key&&/^https:\/\//.test(url));
export const supabase:SupabaseClient|null=cloudConfigured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!Capacitor.isNativePlatform(),flowType:'pkce'}}):null;
export const cloudUnavailable=()=>{if(!supabase)throw new Error('Cloud is not configured. Your local data is safe. See SUPABASE_SETUP.md to connect your own project.');return supabase;};
let syncing:Promise<string>|null=null;
export function syncNow():Promise<string>{return syncing??=runSync().finally(()=>{syncing=null;});}
async function runSync(){
  const client=cloudUnavailable();
  if(!navigator.onLine)throw new Error('You are offline. Changes stay safely queued on this device.');
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session)throw new Error('Sign in to back up your data. Guest mode works completely offline.');
  const cloudId=session.user.id,localId=useStore.getState().data!.profile.id,db=await getDatabase();
  const queue=await db.query<{id:string;entity_type:Entity;entity_id:string;payload:string}>(`SELECT * FROM sync_queue ORDER BY CASE entity_type WHEN 'accounts' THEN 0 WHEN 'categories' THEN 1 WHEN 'debts' THEN 2 WHEN 'goals' THEN 3 WHEN 'investments' THEN 4 WHEN 'budgets' THEN 5 WHEN 'transactions' THEN 6 WHEN 'contributions' THEN 7 WHEN 'valuations' THEN 8 ELSE 9 END, created_at ASC`);
  for(const item of queue){
    const row=JSON.parse(item.payload) as Row;
    const payload:Row={...row,user_id:cloudId};
    // Receipt binaries stay local. Store only remote storage references, never data URLs.
    if(item.entity_type==='transactions'&&String(payload.attachment_url).startsWith('data:'))payload.attachment_url='';
    const remote=await client.from(item.entity_type).select('updated_at').eq('id',item.entity_id).eq('user_id',cloudId).maybeSingle();
    if(remote.error)throw remote.error;
    if(!remote.data||Number(remote.data.updated_at)<=Number(row.updated_at)){
      const result=remote.data?await client.from(item.entity_type).update(payload).eq('id',item.entity_id).eq('user_id',cloudId).lte('updated_at',row.updated_at):await client.from(item.entity_type).insert(payload);
      if(result.error)throw result.error;
    }
    await db.transact([{statement:'DELETE FROM sync_queue WHERE id=?',values:[item.id]}]);
  }
  for(const table of SYNC_TABLES){
    let offset=0;
    while(true){
      const {data:rows,error:pullError}=await client.from(table).select('*').eq('user_id',cloudId).order('updated_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
      if(pullError)throw pullError;
      if(!rows?.length)break;
      const statements=[];
      for(const remote of rows as Row[]){
        const [local]=await db.query<Row>(`SELECT * FROM ${table} WHERE id=?`,[remote.id]);
        const pending=await db.query('SELECT id FROM sync_queue WHERE entity_type=? AND entity_id=?',[table,remote.id]);
        if((!local||Number(remote.updated_at)>Number(local.updated_at))&&!pending.length)statements.push(upsert(table,{...remote,user_id:localId,synced_at:now()}));
      }
      if(statements.length)await db.transact(statements);
      if(rows.length<500)break;offset+=500;
    }
  }
  const data=await loadData();
  await db.transact([upsert('settings',{...data.settings,last_sync:now(),updated_at:now()})]);
  await useStore.getState().refresh();
  return 'Backup and sync complete.';
}
export async function signIn(email:string,password:string){const client=cloudUnavailable();const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await useStore.getState().updateProfile({email});await syncNow();}
export async function signUp(name:string,email:string,password:string){const client=cloudUnavailable();const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:Capacitor.isNativePlatform()?'com.takagelokoi.finance://auth/callback':window.location.origin+'/auth'}});if(error)throw error;if(data.session){await useStore.getState().updateProfile({display_name:name,email});await syncNow();}return !!data.session;}
export async function resetPassword(email:string){const {error}=await cloudUnavailable().auth.resetPasswordForEmail(email,{redirectTo:Capacitor.isNativePlatform()?'com.takagelokoi.finance://auth/callback':window.location.origin+'/auth'});if(error)throw error;}
export async function googleSignIn(){const client=cloudUnavailable();const redirectTo=Capacitor.isNativePlatform()?'com.takagelokoi.finance://auth/callback':window.location.origin+'/#/auth';const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:Capacitor.isNativePlatform()}});if(error)throw error;if(Capacitor.isNativePlatform()&&data.url)await Browser.open({url:data.url,windowName:'_blank'});}
export async function handleAuthCallback(url:string){const client=cloudUnavailable();const parsed=new URL(url);const code=parsed.searchParams.get('code');if(code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;}else{const hash=new URLSearchParams(parsed.hash.replace(/^#/,''));const access_token=hash.get('access_token'),refresh_token=hash.get('refresh_token');if(access_token&&refresh_token){const {error}=await client.auth.setSession({access_token,refresh_token});if(error)throw error;}}if(Capacitor.isNativePlatform())await Browser.close().catch(()=>{});const {data:{session}}=await client.auth.getSession();if(session){await useStore.getState().updateProfile({email:session.user.email??''});await syncNow();}return parsed.searchParams.get('type')==='recovery'||new URLSearchParams(parsed.hash.replace(/^#/,'')).get('type')==='recovery';}
export async function updatePassword(password:string){const {error}=await cloudUnavailable().auth.updateUser({password});if(error)throw error;}
export async function signOut(){const pending=useStore.getState().data!.queueCount;if(pending)throw new Error(`Sync your ${pending} pending changes before signing out.`);const {error}=await cloudUnavailable().auth.signOut();if(error)throw error;await useStore.getState().updateProfile({email:''});}
export async function registerPushToken(token:string){const client=cloudUnavailable(),{data:{session}}=await client.auth.getSession();if(!session)throw new Error('Sign in before enabling push.');const {error}=await client.from('device_tokens').upsert({user_id:session.user.id,token,platform:'android',updated_at:now()},{onConflict:'token'});if(error)throw error;}

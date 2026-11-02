import { useEffect, useState, Component, Suspense, lazy, type ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useStore } from './data/store';
import { Shell } from './components/Shell';
import { Button, Loading } from './components/ui';
import { Home } from './pages/Home';
const Accounts = lazy(() => import('./pages/Accounts').then(m => ({ default: m.Accounts })));
const AccountDetail = lazy(() => import('./pages/Accounts').then(m => ({ default: m.AccountDetail })));
const Transactions = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const TransactionDetail = lazy(() => import('./pages/Transactions').then(m => ({ default: m.TransactionDetail })));
const NewTransaction = lazy(() => import('./pages/Transactions').then(m => ({ default: m.NewTransaction })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Budgets = lazy(() => import('./pages/Planning').then(m => ({ default: m.Budgets })));
const Goals = lazy(() => import('./pages/Planning').then(m => ({ default: m.Goals })));
const GoalDetail = lazy(() => import('./pages/Planning').then(m => ({ default: m.GoalDetail })));
const Debts = lazy(() => import('./pages/Planning').then(m => ({ default: m.Debts })));
const DebtDetail = lazy(() => import('./pages/Planning').then(m => ({ default: m.DebtDetail })));
const Investments = lazy(() => import('./pages/Investments').then(m => ({ default: m.Investments })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Categories = lazy(() => import('./pages/Other').then(m => ({ default: m.Categories })));
const Notifications = lazy(() => import('./pages/Other').then(m => ({ default: m.Notifications })));
const Help = lazy(() => import('./pages/Other').then(m => ({ default: m.Help })));
const Privacy = lazy(() => import('./pages/Other').then(m => ({ default: m.Privacy })));
import { Onboarding } from './pages/Onboarding';
import { Auth } from './pages/Auth';
import { LockScreen } from './pages/Security';
import { hasPin } from './services/security';
import { syncNow, supabase, handleAuthCallback } from './services/cloud';
import { processRecurring } from './services/recurring';
import { checkAlerts, syncReminders, initializeNotificationListeners } from './services/notifications';
function AppRoutes(){
  const data=useStore(s=>s.data),locked=useStore(s=>s.locked);
  if(locked)return <LockScreen/>;
  return <Suspense fallback={<Loading/>}><Routes><Route path="/welcome" element={<Onboarding/>}/><Route path="/auth" element={<Auth/>}/><Route element={data!.profile.onboarded?<Shell/>:<Navigate to="/welcome" replace/>}><Route index element={<Home/>}/><Route path="accounts" element={<Accounts/>}/><Route path="accounts/:id" element={<AccountDetail/>}/><Route path="transactions" element={<Transactions/>}/><Route path="transactions/new" element={<NewTransaction/>}/><Route path="transactions/:id" element={<TransactionDetail/>}/><Route path="analytics" element={<Analytics/>}/><Route path="budgets" element={<Budgets/>}/><Route path="goals" element={<Goals/>}/><Route path="goals/:id" element={<GoalDetail/>}/><Route path="debts" element={<Debts/>}/><Route path="debts/:id" element={<DebtDetail/>}/><Route path="investments" element={<Investments/>}/><Route path="profile" element={<Profile/>}/><Route path="settings" element={<Settings/>}/><Route path="categories" element={<Categories/>}/><Route path="notifications" element={<Notifications/>}/><Route path="help" element={<Help/>}/><Route path="privacy" element={<Privacy/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></Suspense>;
}
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return{error:e.message};}render(){if(this.state.error)return <div className="loading-state flex-col p-8"><AlertCircle size={32}/><h1>Something went wrong</h1><p className="muted text-sm max-w-md text-center">{this.state.error}</p><Button onClick={()=>window.location.reload()}><RefreshCw size={16}/>Try again</Button></div>;return this.props.children;}}
export default function App(){
  const ready=useStore(s=>s.ready),error=useStore(s=>s.error),data=useStore(s=>s.data),toast=useStore(s=>s.toast),[systemDark,setSystemDark]=useState(window.matchMedia('(prefers-color-scheme: dark)').matches),[booting,setBooting]=useState(true);
  useEffect(()=>{useStore.getState().initialize();const media=window.matchMedia('(prefers-color-scheme: dark)'),listener=()=>setSystemDark(media.matches);media.addEventListener('change',listener);const timer=setTimeout(()=>setBooting(false),650);return()=>{media.removeEventListener('change',listener);clearTimeout(timer);};},[]);
  const theme=data?.profile.theme??'dark',reduced=!!data?.profile.reduced_motion;
  useEffect(()=>{document.documentElement.dataset.theme=theme==='system'?(systemDark?'dark':'light'):theme;document.documentElement.dataset.reducedMotion=String(reduced);document.documentElement.lang=data?.profile.language??'en';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#F7FBF8':'#051F20');},[theme,systemDark,reduced,data?.profile.language]);
  useEffect(()=>{
    if(!ready||!data?.profile.onboarded)return;
    let active=true,backgroundAt=0;
    hasPin().then(async has=>{if(!active)return;if(has){useStore.getState().setLocked(true);if(useStore.getState().data!.profile.auto_lock===0){const {biometricEnabled,unlockBiometric}=await import('./services/security');if(await biometricEnabled())unlockBiometric().catch(()=>{});}}});
    processRecurring().then(()=>checkAlerts()).then(()=>syncReminders()).catch(e=>useStore.getState().notify(e.message,'error'));
    if(navigator.onLine&&useStore.getState().data!.profile.email)syncNow().catch(e=>useStore.getState().notify(e.message,'error'));
    const online=()=>{if(useStore.getState().data!.profile.email)syncNow().then(()=>useStore.getState().notify('Back online. Backup complete.')).catch(e=>useStore.getState().notify(e.message,'error'));};
    window.addEventListener('online',online);
    const interval=setInterval(()=>{if(navigator.onLine&&useStore.getState().data!.profile.email&&!useStore.getState().locked)syncNow().catch(()=>{});checkAlerts().catch(()=>{});},15*60*1000);
    const visibility=async()=>{if(document.hidden){backgroundAt=Date.now();}else if(backgroundAt&&await hasPin()){const timeout=useStore.getState().data!.profile.auto_lock*1000;if(Date.now()-backgroundAt>=timeout)useStore.getState().setLocked(true);backgroundAt=0;}else{processRecurring().then(checkAlerts).catch(()=>{});}};
    document.addEventListener('visibilitychange',visibility);
    const removeListeners=initializeNotificationListeners();
    const authDeepLink=Capacitor.isNativePlatform()?CapacitorApp.addListener('appUrlOpen',({url})=>{if(url.startsWith('com.takagelokoi.finance://auth'))handleAuthCallback(url).then(recovery=>{window.location.hash=recovery?'/auth?recovery=1':'/';}).catch(e=>useStore.getState().notify(e.message,'error'));}):null;
    const lifecycle=Capacitor.isNativePlatform()?CapacitorApp.addListener('appStateChange',({isActive})=>{if(!isActive)backgroundAt=Date.now();else void visibility();}):null;
    const authListener=supabase?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'&&navigator.onLine)syncNow().catch(e=>useStore.getState().notify(e.message,'error'));});
    const cloudClient=supabase;let realtime:ReturnType<NonNullable<typeof supabase>['channel']>|null=null,realtimeTimer:ReturnType<typeof setTimeout>|null=null;
    if(cloudClient&&useStore.getState().data!.profile.email){void cloudClient.auth.getSession().then(({data:{session}})=>{if(!session||!cloudClient)return;realtime=cloudClient.channel('takagelokoi-sync').on('postgres_changes',{event:'*',schema:'public'},(payload)=>{const row=(payload.new??payload.old) as {user_id?:string};if(row?.user_id!==session.user.id)return;if(realtimeTimer)clearTimeout(realtimeTimer);realtimeTimer=setTimeout(()=>{if(navigator.onLine)syncNow().catch(()=>{});},1500);}).subscribe();});}
    return()=>{active=false;window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visibility);clearInterval(interval);removeListeners();void lifecycle?.then(h=>h.remove());void authDeepLink?.then(h=>h.remove());authListener?.data.subscription.unsubscribe();if(realtimeTimer)clearTimeout(realtimeTimer);if(realtime&&cloudClient)void cloudClient.removeChannel(realtime);};
  },[ready,data?.profile.id]);
  return <ErrorBoundary><MotionConfig reducedMotion={reduced?'always':'user'}>{!ready||booting?<div className="loading-state"><img src="./icon.svg" width="60" height="60" alt="TakaGeloKoi"/><span className="sr-only">Opening your private workspace…</span></div>:error?<div className="loading-state flex-col p-8"><AlertCircle size={30}/><p>{error}</p><Button onClick={()=>useStore.getState().initialize()}>Try again</Button></div>:<HashRouter><AppRoutes/></HashRouter>}{toast&&<div className={`toast ${toast.kind}`} role="status">{toast.kind==='success'?<CheckCircle2 size={18}/>:toast.kind==='error'?<AlertCircle size={18}/>:<Info size={18}/>}<span>{toast.text}</span></div>}</MotionConfig></ErrorBoundary>;
}

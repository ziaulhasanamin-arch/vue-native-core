import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { useStore, uid, now } from '../data/store';
import { getDatabase, upsert } from '../data/database';
import { budgetSpent, debtRemaining, goalSaved } from '../lib/finance';
import { money } from '../lib/money';
import { monthStart, monthEnd } from '../data/store';
import { registerPushToken } from './cloud';
import type { Notification } from '../lib/types';
export async function logNotification(n:{type:string;title:string;body:string;deep_link:string;dedupe_key?:string}){
  const data=useStore.getState().data!;if(n.dedupe_key&&data.notifications.some(x=>x.dedupe_key===n.dedupe_key))return;
  const time=now(),row:Notification={id:uid(),user_id:data.profile.id,is_read:0,created_at:time,updated_at:time,dedupe_key:'',...n};
  await(await getDatabase()).transact([upsert('notifications',{...row})]);await useStore.getState().refresh();
}
export async function requestLocalPermission(){if(!Capacitor.isNativePlatform())return false;const result=await LocalNotifications.requestPermissions();return result.display==='granted';}
function notificationId(key:string){let h=0;for(const c of key)h=(Math.imul(h,31)+c.charCodeAt(0))|0;return Math.abs(h)||1;}
export async function scheduleNative(title:string,body:string,date:Date,key:string,link:string){if(!Capacitor.isNativePlatform()||date.getTime()<Date.now())return;await LocalNotifications.schedule({notifications:[{id:notificationId(key),title,body,schedule:{at:date,allowWhileIdle:true},extra:{link},smallIcon:'ic_stat_icon',iconColor:'#10B981'}]});}
export async function syncReminders(){
  const data=useStore.getState().data!,{profile}=data;
  if(Capacitor.isNativePlatform())await LocalNotifications.cancel({notifications:(await LocalNotifications.getPending()).notifications.map(n=>({id:n.id}))});
  if(profile.daily_reminder&&await requestLocalPermission()){
    const dates=Array.from({length:7},(_,i)=>{const [h,m]=profile.daily_reminder.split(':').map(Number);const d=new Date();d.setDate(d.getDate()+i);d.setHours(h,m,0,0);return d;});
    if(Capacitor.isNativePlatform())await LocalNotifications.schedule({notifications:dates.filter(d=>d.getTime()>Date.now()).map((d,i)=>({id:notificationId('daily'+i),title:'A moment for your money',body:'Take a minute to log today’s transactions.',schedule:{at:d,allowWhileIdle:true},extra:{link:'/transactions/new'},smallIcon:'ic_stat_icon',iconColor:'#10B981'}))});
  }
  if(profile.due_alerts)for(const debt of data.debts){
    if(!debt.reminder_enabled||!debt.due_date||debtRemaining(debt,data.transactions)<=0)continue;
    for(const days of [1,0]){const date=new Date(debt.due_date);date.setDate(date.getDate()-days);date.setHours(9,0,0,0);const key=`debt-${debt.id}-${days}-${debt.due_date}`;await scheduleNative(debt.direction==='payable'?'Payment reminder':'Collection reminder',`${debt.party_name} · ${money(debtRemaining(debt,data.transactions),debt.currency,profile.language)}`,date,key,`/debts/${debt.id}`);if(days===0&&date.getTime()<=Date.now())await logNotification({type:'debt',title:debt.direction==='payable'?'Payment due':'Collection due',body:debt.party_name,deep_link:`/debts/${debt.id}`,dedupe_key:key});}
  }
  await checkAlerts();
}
export async function checkAlerts(){
  const data=useStore.getState().data!;if(!data.profile.onboarded)return;
  if(data.profile.budget_alerts)for(const budget of data.budgets.filter(b=>b.is_active&&!b.is_archived)){
    const start=budget.period==='monthly'?monthStart():budget.period==='yearly'?new Date(new Date().getFullYear(),0,1).getTime():new Date(new Date().setDate(new Date().getDate()-((new Date().getDay()+6)%7))).getTime();
    const end=budget.period==='monthly'?monthEnd():budget.period==='yearly'?new Date(new Date().getFullYear()+1,0,1).getTime():start+7*86400000;
    const p=budgetSpent(budget,data.transactions.filter(x=>x.currency===budget.currency),[start,end])/budget.amount*100;
    for(const threshold of [budget.warning_threshold,100])if(p>=threshold){const n={type:'budget',title:threshold===100?'Budget limit reached':'Budget check-in',body:`${budget.name}: ${Math.round(p)}% of your budget has been used.`,deep_link:'/budgets',dedupe_key:`budget-${budget.id}-${start}-${threshold}-${budget.amount}`};await logNotification(n);if(await requestLocalPermission())await scheduleNative(n.title,n.body,new Date(Date.now()+1000),n.dedupe_key,n.deep_link);}
  }
  for(const goal of data.goals){const p=goalSaved(goal,data.contributions)/goal.target_amount*100;for(const threshold of [25,50,75,100])if(p>=threshold)await logNotification({type:'goal',title:threshold===100?'Goal reached!':'A little closer to your goal',body:`${goal.name} · ${threshold}% milestone`,deep_link:`/goals/${goal.id}`,dedupe_key:`goal-${goal.id}-${threshold}`});}
}
export async function testNotification(){await logNotification({type:'system',title:'A little peace of mind',body:'Your notification center is working. All financial data stays on this device.',deep_link:'/settings'});if(await requestLocalPermission())await scheduleNative('TakaGeloKoi','Your notifications are ready.',new Date(Date.now()+1500),'test-'+now(),'/notifications');}
let pushStarted=false;
export async function enablePush(){
  if(!Capacitor.isNativePlatform())throw new Error('Live push is available in the Android app after Firebase is configured.');
  if(import.meta.env.VITE_PUSH_ENABLED!=='true')throw new Error('Push is not configured. Add Firebase configuration and enable VITE_PUSH_ENABLED.');
  const permission=await PushNotifications.requestPermissions();if(permission.receive!=='granted')throw new Error('Notification permission was not granted.');
  if(!pushStarted){await PushNotifications.addListener('registration',token=>{registerPushToken(token.value).catch(e=>useStore.getState().notify(e.message,'error'));});await PushNotifications.addListener('registrationError',e=>useStore.getState().notify(e.error,'error'));await PushNotifications.addListener('pushNotificationReceived',n=>{logNotification({type:'push',title:n.title??'TakaGeloKoi',body:n.body??'',deep_link:String(n.data?.link??'/notifications')});});await PushNotifications.addListener('pushNotificationActionPerformed',n=>{const link=String(n.notification.data?.link??'/notifications');if(link.startsWith('/')&&!link.startsWith('//'))window.location.hash=link;});pushStarted=true;}
  await PushNotifications.register();await useStore.getState().updateProfile({push_enabled:1});
}
export function initializeNotificationListeners(){if(!Capacitor.isNativePlatform())return()=>{};const handle=LocalNotifications.addListener('localNotificationActionPerformed',n=>{const link=String(n.notification.extra?.link??'/notifications');if(link.startsWith('/')&&!link.startsWith('//'))window.location.hash=link;});return()=>{void handle.then(h=>h.remove());};}

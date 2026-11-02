import { getDatabase, upsert } from '../data/database';
import { uid, now, useStore } from '../data/store';
import { enqueue } from '../data/store';
import type { Transaction } from '../lib/types';
import { validateTransaction } from '../lib/finance';
export function nextOccurrence(date:number,frequency:string,anchorDay=new Date(date).getDate()):number{
  const d=new Date(date),day=d.getDate();
  if(frequency==='daily'){d.setDate(day+1);return d.getTime();}
  if(frequency==='weekly'){d.setDate(day+7);return d.getTime();}
  d.setDate(1);
  if(frequency==='yearly')d.setFullYear(d.getFullYear()+1);
  else d.setMonth(d.getMonth()+1);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(anchorDay,last));return d.getTime();
}
export async function processRecurring(){
  const db=await getDatabase(),data=useStore.getState().data!,time=now();
  for(const source of data.transactions.filter(t=>t.is_recurring&&!t.is_deleted&&t.type!=='debt_payment'&&t.type!=='receivable_collection')){
    const rule=JSON.parse(source.recurrence_rule||'{}');if(!['daily','weekly','monthly','yearly'].includes(rule.frequency))continue;
    let occurrence=source.transaction_date,count=0;const anchor=new Date(occurrence).getDate();
    while(count<366){
      occurrence=nextOccurrence(occurrence,rule.frequency,anchor);
      if(occurrence>time||(rule.end_date&&occurrence>rule.end_date))break;
      const existing=await db.query('SELECT rule_id FROM recurrence_history WHERE rule_id=? AND occurrence=?',[source.id,occurrence]);
      if(!existing.length){
        const account=data.accounts.find(a=>a.id===source.account_id),destination=data.accounts.find(a=>a.id===source.destination_account_id);
        if(!account||account.is_archived||(source.type==='transfer'&&(!destination||destination.is_archived)))break;
        const row:Transaction={...source,id:uid(),transaction_date:occurrence,is_recurring:0,recurrence_rule:'',created_at:time,updated_at:time,attachment_url:'',linked_debt_id:null,linked_goal_id:null};
        validateTransaction(row,data.accounts);
        await db.transact([...await enqueue('transactions',{...row}),upsert('recurrence_history',{rule_id:source.id,occurrence,transaction_id:row.id})]);count++;
      }
    }
  }
  await useStore.getState().refresh();
}

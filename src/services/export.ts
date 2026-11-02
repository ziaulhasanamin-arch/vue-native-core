import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { z } from 'zod';
import type { Data, Transaction } from '../lib/types';
import { decimalMoney } from '../lib/money';
import { flow } from '../lib/finance';
import { SYNC_TABLES } from '../data/schema';
import { useStore } from '../data/store';
async function download(name:string,blob:Blob){
  if(Capacitor.isNativePlatform()){
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
    const result=await Filesystem.writeFile({path:name,data:base64,directory:Directory.Cache});
    await Share.share({title:name,url:result.uri,dialogTitle:'Export from TakaGeloKoi'});
  }else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
const escapeCSV=(value:unknown)=>{let s=String(value??'');if(/^[=+@\t\r]/.test(s)||(/^-\D/.test(s)))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
export async function exportCSV(transactions:Transaction[],data:Data){
  const header=['Date','Type','Description','Payee','Category','Account','Destination','Currency','Amount (minor units)','Amount','Received (minor units)','Exchange rate (ppm)','Tags'];
  const rows=transactions.map(t=>[new Date(t.transaction_date).toISOString(),t.type,t.description,t.payee,data.categories.find(c=>c.id===t.category_id)?.name??'',data.accounts.find(a=>a.id===t.account_id)?.name??'',data.accounts.find(a=>a.id===t.destination_account_id)?.name??'',t.currency,t.amount,decimalMoney(t.amount,t.currency),t.destination_amount,t.exchange_rate_ppm,JSON.parse(t.tags||'[]').join(';')]);
  await download(`TakaGeloKoi-transactions-${new Date().toISOString().slice(0,10)}.csv`,new Blob(['\uFEFF'+[header,...rows].map(row=>row.map(escapeCSV).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
}
async function loadPdfFont(doc:jsPDF){const response=await fetch('./fonts/NotoSansBengali-Regular.ttf');if(!response.ok)throw new Error('Could not load the report font.');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));doc.addFileToVFS('NotoSansBengali-Regular.ttf',btoa(binary));doc.addFont('NotoSansBengali-Regular.ttf','NotoSansBengali','normal');doc.setFont('NotoSansBengali','normal');}
export async function exportPDF(transactions:Transaction[],data:Data,from:number,to:number){
  const doc=new jsPDF();await loadPdfFont(doc);const currency=data.profile.base_currency,rows=transactions.filter(t=>t.currency===currency);let y=55;
  doc.setFontSize(23);doc.setTextColor(5,31,32);doc.text('TakaGeloKoi',18,23);doc.setFontSize(12);doc.text('Financial report',18,34);doc.setFontSize(9);doc.setTextColor(90,110,100);doc.text(`${new Date(from).toLocaleDateString()} - ${new Date(to-1).toLocaleDateString()} | ${currency}`,18,43);
  const f=flow(rows,from,to);doc.text(`Income: ${decimalMoney(f.income,currency)} | Expenses: ${decimalMoney(f.expense,currency)} | Net: ${decimalMoney(f.net,currency)}`,18,51);
  doc.setFontSize(8);
  for(const t of rows){if(y>275){doc.addPage();y=22;}const text=`${new Date(t.transaction_date).toLocaleDateString()}  ${t.type}  ${decimalMoney(t.amount,currency)}  ${(t.description||t.payee||'').slice(0,55)}`;doc.text(text,18,y);y+=7;}
  const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.text(`Private financial information | Page ${p} of ${pages}`,18,288);}
  await download('TakaGeloKoi-report.pdf',doc.output('blob'));
}
export async function exportBackup(){
  const data=useStore.getState().data!;
  const {profile}=data;const safeProfile={...profile,email:''};
  const backup={app:'TakaGeloKoi',schemaVersion:1,exportedAt:new Date().toISOString(),profile:safeProfile,data:Object.fromEntries(SYNC_TABLES.map(table=>[table,data[table]]))};
  await download(`TakaGeloKoi-backup-${new Date().toISOString().slice(0,10)}.json`,new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
}
const recordSchema=z.object({id:z.string().uuid(),user_id:z.string(),created_at:z.number().int().nonnegative(),updated_at:z.number().int().nonnegative(),is_deleted:z.number().int().min(0).max(1)}).passthrough();
const moneyField=z.number().int().nonnegative().max(99999999999999);
const entitySchemas:Record<string,z.ZodTypeAny>={
 accounts:recordSchema.extend({name:z.string().min(1).max(80),type:z.enum(['cash','bank','mobile_wallet','credit_card','savings','investment','loan']),currency:z.string().length(3),opening_balance:z.number().int().min(-99999999999999).max(99999999999999),color:z.string().regex(/^#[0-9a-f]{6}$/i),icon:z.string().max(60)}),
 categories:recordSchema.extend({name:z.string().min(1).max(80),type:z.enum(['income','expense']),icon:z.string().max(60),color:z.string().regex(/^#[0-9a-f]{6}$/i)}),
 transactions:recordSchema.extend({type:z.enum(['income','expense','transfer','refund','adjustment','debt_payment','receivable_collection']),amount:moneyField.positive(),destination_amount:moneyField,account_id:z.string(),currency:z.string().length(3),transaction_date:z.number().int(),exchange_rate_ppm:z.number().int().positive(),tags:z.string().refine(s=>{try{return Array.isArray(JSON.parse(s));}catch{return false;}}),attachment_url:z.string().refine(s=>!s||s.startsWith('data:image/')||s.startsWith('https://'))}),
 debts:recordSchema.extend({party_name:z.string().min(1),principal_amount:moneyField.positive(),direction:z.enum(['payable','receivable']),currency:z.string().length(3),start_date:z.number()}),
 goals:recordSchema.extend({name:z.string().min(1),target_amount:moneyField.positive(),currency:z.string().length(3)}),
 contributions:recordSchema.extend({goal_id:z.string(),amount:moneyField.positive()}),
 budgets:recordSchema.extend({name:z.string().min(1),amount:moneyField.positive(),currency:z.string().length(3),period:z.enum(['monthly','weekly','yearly']),warning_threshold:z.number().int().min(1).max(100)}),
 investments:recordSchema.extend({name:z.string().min(1),cost_basis:moneyField,current_value:moneyField,currency:z.string().length(3)}),
 valuations:recordSchema.extend({investment_id:z.string(),value:moneyField,date:z.number()}),
};
export async function parseBackup(file:File):Promise<Data>{
  if(file.size>35_000_000)throw new Error('Backup is too large (maximum 35 MB).');
  const input=JSON.parse(await file.text());
  if(input.app!=='TakaGeloKoi'||input.schemaVersion!==1)throw new Error('This is not a supported TakaGeloKoi backup.');
  const data:Record<string,unknown>={};
  for(const table of SYNC_TABLES){const rows=z.array(entitySchemas[table]).max(50000).parse(input.data?.[table]) as {id:string}[];data[table]=rows;if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Duplicate record IDs in backup.');}
  const d=data as unknown as Data;
  const owns=(rows:{id:string}[])=>new Set(rows.map(r=>r.id));
  const accounts=owns(d.accounts),categories=owns(d.categories),debts=owns(d.debts),goals=owns(d.goals),investments=owns(d.investments);
  for(const t of d.transactions){if(!accounts.has(t.account_id)||(t.destination_account_id&&!accounts.has(t.destination_account_id))||(t.category_id&&!categories.has(t.category_id))||(t.linked_debt_id&&!debts.has(t.linked_debt_id))||(t.linked_goal_id&&!goals.has(t.linked_goal_id)))throw new Error('Backup contains a broken record reference.');if(t.type==='transfer'&&(!t.destination_account_id||t.account_id===t.destination_account_id))throw new Error('Invalid transfer in backup.');}
  for(const c of d.contributions)if(!goals.has(c.goal_id))throw new Error('Invalid goal reference.');
  for(const v of d.valuations)if(!investments.has(v.investment_id))throw new Error('Invalid investment reference.');
  for(const g of d.goals)if(g.linked_account_id&&!accounts.has(g.linked_account_id))throw new Error('Invalid linked account.');
  for(const b of d.budgets)if(b.category_id&&!categories.has(b.category_id))throw new Error('Invalid budget category.');
  return d;
}

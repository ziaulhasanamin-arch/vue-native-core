import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../data/database';
import { useStore } from '../data/store';
interface LockRecord { hash:string; recoveryHash:string; biometric:boolean; failures:number; blockedUntil:number; }
const KEY='takagelokoi-lock-v1';
async function getRecord():Promise<LockRecord|null>{
  if(Capacitor.isNativePlatform())return await SecureStorage.get(KEY,false) as LockRecord|null;
  const db=await getDatabase();const rows=await db.query<{value:string}>("SELECT value FROM security WHERE key='lock'");return rows[0]?JSON.parse(rows[0].value):null;
}
async function setRecord(record:LockRecord|null){
  if(Capacitor.isNativePlatform()){if(record)await SecureStorage.set(KEY,{...record});else await SecureStorage.remove(KEY);return;}
  const db=await getDatabase();await db.transact([{statement:'CREATE TABLE IF NOT EXISTS security(key TEXT PRIMARY KEY,value TEXT NOT NULL)'},{statement:record?'INSERT INTO security(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value':'DELETE FROM security',values:record?['lock',JSON.stringify(record)]:[]}]);
}
export const hasPin=async()=>!!(await getRecord());
export async function enablePin(pin:string,current?:string){
  if(!/^\d{4,6}$/.test(pin))throw new Error('Use a PIN with 4 to 6 digits.');
  const old=await getRecord();if(old&&(!current||!await bcrypt.compare(current,old.hash)))throw new Error('Current PIN is incorrect.');
  const recovery=Array.from(crypto.getRandomValues(new Uint8Array(12))).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
  const record:LockRecord={hash:await bcrypt.hash(pin,12),recoveryHash:await bcrypt.hash(recovery,12),biometric:false,failures:0,blockedUntil:0};
  await setRecord(record);return recovery;
}
export async function verifyPin(pin:string){
  const record=await getRecord();if(!record)return true;
  if(record.blockedUntil>Date.now())throw new Error(`Too many attempts. Try again in ${Math.ceil((record.blockedUntil-Date.now())/1000)} seconds.`);
  if(!await bcrypt.compare(pin,record.hash)){
    record.failures++;if(record.failures>=5){record.blockedUntil=Date.now()+Math.min(300,30*2**(record.failures-5))*1000;}
    await setRecord(record);throw new Error('Incorrect PIN. Please try again.');
  }
  await setRecord({...record,failures:0,blockedUntil:0});useStore.getState().setLocked(false);return true;
}
export async function recoverPin(recovery:string,pin:string){const record=await getRecord();if(!record||!await bcrypt.compare(recovery.trim().toUpperCase(),record.recoveryHash))throw new Error('Recovery code is incorrect.');await enablePin(pin);useStore.getState().setLocked(false);}
export async function disablePin(pin:string){const record=await getRecord();if(!record||!await bcrypt.compare(pin,record.hash))throw new Error('Incorrect PIN.');await setRecord(null);}
export async function setBiometric(enabled:boolean,pin:string){const record=await getRecord();if(!record||!await bcrypt.compare(pin,record.hash))throw new Error('Verify your PIN first.');if(enabled){if(!Capacitor.isNativePlatform())throw new Error('Biometric unlock requires the Android app and an enrolled biometric.');const result=await BiometricAuth.checkBiometry();if(!result.isAvailable||result.biometryType===BiometryType.none)throw new Error('No biometric is available on this device.');await BiometricAuth.authenticate({reason:'Enable biometric unlock for TakaGeloKoi',androidTitle:'Your money is private'});}await setRecord({...record,biometric:enabled});}
export async function biometricEnabled(){return (await getRecord())?.biometric??false;}
export async function unlockBiometric(){const record=await getRecord();if(!record?.biometric)throw new Error('Biometric unlock is not enabled.');await BiometricAuth.authenticate({reason:'Unlock your private finance workspace',androidTitle:'Unlock TakaGeloKoi',allowDeviceCredential:false});useStore.getState().setLocked(false);}
export async function clearPin(){await setRecord(null);}

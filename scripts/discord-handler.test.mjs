import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {expandDiscordRead} from '../src/discord/server/presentation.ts';

const token='synthetic_discord_test_token_abcdefghijklmnopqrstuvwxyz';
const account={id:'100000000000000001',username:'fixture',global_name:'Fixture account',bot:false};
const channelId='100000000000000002';
const rawMessage=index=>({id:String(100000000000000100n+BigInt(index)),channel_id:channelId,type:0,author:account,
 content:'Olá 日本語 😀 '+index,timestamp:'2026-10-28T10:00:00.000Z',edited_timestamp:null,attachments:[],embeds:[],mentions:[]});

async function fixture(response=()=>({status:200,value:Array.from({length:100},(_,index)=>rawMessage(index))})){
 const module=(await import('../packages/discord/server.mjs?fixture='+randomUUID())).default;
 const retained=[],chunks=[],original={channel:{id:'123',name:'fixture'},guild:{id:'1'},exportedAt:'2026-10-28T10:00:00Z',messageCount:1,
  messages:[{id:'456',content:'Original export café 日本語 😀',timestamp:'2026-10-28T10:00:00Z',author:{id:'789',name:'Author'},attachments:[],futureField:{preserve:['unknown','fields']}}]};
 const exportBytes=Buffer.from(JSON.stringify(original)),originalHash=createHash('sha256').update(exportBytes).digest('hex');
 let calls=0;
 const context={taskId:randomUUID(),attemptId:randomUUID(),signal:new AbortController().signal,broker:async(method,input)=>{
  if(method==='credential.read')return{revision:1,value:{version:1,token,account:{id:account.id,username:account.username,displayName:account.global_name,bot:false}}};
  if(method==='network.fetch'){calls++;const value=response(input);return{status:value.status,headers:{'content-type':'application/json'},body:JSON.stringify(value.value),encoding:'utf8'};}
  if(method==='import.retain'){
   if(input.action==='source-identity')return null;
   if(input.action==='source-capture'){retained.push(input.value);return{recordId:randomUUID(),revisionId:randomUUID()};}
   if(input.action==='asset-retain')return{hash:originalHash,bytes:exportBytes.length};
   if(input.action==='asset-read')return{base64:exportBytes.subarray(input.offset,input.offset+input.length).toString('base64')};
   if(input.action==='file-begin')return{id:'fixture-file'};
   if(input.action==='file-write'){chunks.push(Buffer.from(input.base64,'base64'));return null;}
   if(input.action==='file-finish'){const bytes=Buffer.concat(chunks);return{path:'output.jsonl',hash:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};}
   if(input.action==='asset-close'||input.action==='file-abort')return null;
  }
  throw new Error('Unexpected synthetic broker operation.');
 }};
 return{module,context,retained,original,chunks,calls:()=>calls,run:(name,args,scope=context)=>module.handlers[name](args,scope)};
}

test('compiled read handler returns a compact lossless page with unchanged cursors, content and references',async()=>{
 const messages=Array.from({length:100},(_,index)=>rawMessage(index));
 messages[2].message_reference={message_id:messages[0].id,channel_id:channelId,type:0};
 messages[3].attachments=[{id:'100000000000000009',filename:'日本語.txt',size:42,url:'https://example.invalid/file'}];
 const f=await fixture(()=>({status:200,value:messages}));
 try{
  const result=await f.run('discord_read',{action:'messages',channelId,limit:100,before:'100000000000000999'});
  assert.equal(result.outcome,'succeeded');assert.equal(result.value.format,'discord-message-refs-v1');
  const restored=expandDiscordRead(result.value);
  assert.deepEqual(restored.messages.map(message=>message.content),messages.map(message=>message.content));
  assert.equal(restored.messages[2].reference.messageId,messages[0].id);assert.equal(restored.messages[3].attachments[0].filename,'日本語.txt');
  assert.equal(restored.nextBefore,messages[0].id);assert.equal(restored.nextAfter,messages.at(-1).id);
  assert.equal(restored.messages[0].author.id,account.id);assert.equal(restored.messages[0].channelId,channelId);
  assert.ok(!JSON.stringify(result).includes(token));
 }finally{await f.module.deactivate();}
});

test('compiled exact reads and retention still use complete original message objects',async()=>{
 const value=rawMessage(0),f=await fixture(()=>({status:200,value:[value]}));
 try{
  const read=await f.run('discord_read',{action:'message',channelId,messageId:value.id});
  assert.equal(read.outcome,'succeeded');assert.equal(read.value.format,undefined);assert.equal(read.value.message.author.id,account.id);
  const capture=await f.run('capture_discord_messages',{channelId,messageIds:[value.id]});
  assert.equal(capture.outcome,'succeeded');assert.equal(f.retained.length,1);
  const retained=JSON.parse(f.retained[0].source.text);
  assert.equal(retained.message.content,value.content);assert.equal(retained.message.channelId,channelId);assert.equal(retained.message.author.id,account.id);
  assert.equal(retained.message.authorRef,undefined);assert.equal(retained.format,undefined);
 }finally{await f.module.deactivate();}
});

test('compiled empty reads, indexing, invalid inputs, provider failures and cancellation retain their contracts',async()=>{
 for(const [response,args,expected] of [
  [()=>({status:200,value:[]}),{action:'messages',channelId},'succeeded'],
  [()=>({status:202,value:{retry_after:2}}),{action:'search',scope:'channel',scopeId:channelId,text:'note'},'succeeded'],
  [()=>({status:403,value:{}}),{action:'messages',channelId},'failed'],
  [()=>({status:200,value:{}}),{action:'messages',channelId},'failed'],
  [()=>({status:200,value:[]}),{action:'send',channelId},'failed'],
 ]){
  const f=await fixture(response);try{const result=await f.run('discord_read',args);assert.equal(result.outcome,expected);assert.equal(result.value.format,undefined);
   if(args.action==='search'){assert.equal(result.value.indexing,true);assert.equal(result.value.totalResults,null);assert.equal(result.value.retryAfterSeconds,2);}
  }finally{await f.module.deactivate();}
 }
 const f=await fixture();try{const result=await f.run('discord_read',{action:'messages',channelId},{...f.context,signal:AbortSignal.abort()});
  assert.equal(result.outcome,'cancelled');assert.equal(f.calls(),0);
 }finally{await f.module.deactivate();}
});

test('compiled export handler preserves original and unknown message fields without compact references',async()=>{
 const f=await fixture();try{
  const result=await f.run('prepare_discord_import',{path:'original.json',output:'output.jsonl'});
  assert.equal(result.outcome,'succeeded');assert.equal(result.value.messages,1);
  const rows=Buffer.concat(f.chunks).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
  const observation=rows.find(row=>row.id===f.original.messages[0].id);
  assert.ok(observation);assert.deepEqual(observation.text?JSON.parse(observation.text).message:observation,f.original.messages[0]);
  assert.ok(!Buffer.concat(f.chunks).toString('utf8').includes('discord-message-refs-v1'));
 }finally{await f.module.deactivate();}
});

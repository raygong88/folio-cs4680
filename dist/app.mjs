import {examples,sample,messages,execute} from './agent.mjs';
const $=id=>document.getElementById(id);
const empty=()=>({rows:[],audit:[]});
const ready=new Promise((resolve,reject)=>{
  const req=indexedDB.open('folio-planner',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('planner');
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
async function transact(update) {
  const db=await ready;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('planner',update?'readwrite':'readonly');
    const store=tx.objectStore('planner'), req=store.get('state');
    let state,result,reason;
    req.onsuccess=()=>{
      state=req.result||empty();
      try{if(update){result=update(state);store.put(state,'state');}}
      catch(err){reason=err;tx.abort();}
    };
    tx.oncomplete=()=>resolve({state,result});
    tx.onabort=()=>reject(reason||tx.error||Error('Storage update failed.'));
    tx.onerror=()=>reject(tx.error);
  });
}
let pending=null, fileURL=null, lastClarification=null, sdk;
function element(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
function render(state,matches){
  const list=matches??[...state.rows].sort((a,b)=>a.due.localeCompare(b.due));
  $('tasks').replaceChildren(...list.map(t=>{
    const row=element('div','');row.className='item';
    row.append(element('strong',t.title),element('span',t.course+'  ·  Due '+t.due));return row;
  }));
  if(!list.length) $('tasks').append(element('p',matches?'No matching assignments.':'Your list is empty. Add your first assignment above.'));
  $('log').replaceChildren(...state.audit.slice(-60).reverse().map(a=>{
    const li=element('li',a.message);li.append(element('time',new Date(a.time).toLocaleString()+' · '+a.source));return li;
  }));
  if(!state.audit.length) $('log').append(element('li','Your actions will appear here.'));
}
function record(state,message){state.audit.push({time:new Date().toISOString(),source:$('mode').selectedOptions[0].text,message});}
function clearOutput(){
  pending=null;$('review').hidden=true;$('trace').hidden=true;$('download').hidden=true;
  if(fileURL){URL.revokeObjectURL(fileURL);fileURL=null;}
}
async function apply(cmd,confirmedId=null){
  const {state,result}=await transact(s=>{
    const out=execute(s.rows,cmd,{confirmedId});s.rows=out.rows;record(s,out.message);return out;
  });
  render(state,result.matches);
  pending=result.pending??null;$('review').hidden=!pending;
  $('status').textContent=result.message;$('trace').hidden=false;$('json').textContent=JSON.stringify(cmd,null,2);
  if(result.file!==undefined){
    fileURL=URL.createObjectURL(new Blob([result.file],{type:'text/csv;charset=utf-8'}));
    $('download').href=fileURL;$('download').hidden=false;
  }
}
async function fail(err){
  let detail=String(err?.error?.message||err?.message||err?.error||'Request failed.');
  if(/429|rate.limit|too many requests/i.test(detail)) detail='Rate limit reached. Wait a minute and try again.';
  const msg='Request stopped. '+detail.slice(0,220);
  $('status').textContent=msg;
  try{const {state}=await transact(s=>record(s,msg));render(state);}catch{$('status').textContent=msg+' Browser storage is unavailable.';}
}
function loadSDK(){
  if(window.puter)return Promise.resolve(window.puter);
  if(!sdk)sdk=new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src='https://js.puter.com/v2/';
    el.onload=()=>resolve(window.puter);el.onerror=()=>{sdk=null;el.remove();reject(Error('Could not load Puter. Check your connection.'));};document.head.append(el);
  });
  return sdk;
}
function hint(){
  $('hint').textContent=$('mode').value==='live'?'Use your own words. Puter sign-in uses your account quota and sends your request and assignment list to the model.':'Try the four example requests below. Guided mode runs real actions using preset commands.';
}
$('mode').onchange=()=>{clearOutput();lastClarification=null;hint();$('status').textContent='Ready for a request.';if($('mode').value==='live')loadSDK().catch(fail);};
for(const [name,text] of examples){const b=element('button',name);b.type='button';b.onclick=()=>{$('request').value=text;$('request').focus();};$('chips').append(b);}
function busy(on){for(const id of ['run','mode','yes','no','reset','request'])$(id).disabled=on;for(const b of $('chips').children)b.disabled=on;}
document.querySelector('form').onsubmit=async event=>{
  event.preventDefault();if($('run').disabled)return;
  const request=$('request').value.trim();if(!request)return;
  busy(true);clearOutput();
  $('status').textContent='Interpreting request…';
  try{
    let provider;
    if($('mode').value==='live'){
      provider=window.puter||await loadSDK();
      if(!provider.auth.isSignedIn())await provider.auth.signIn();
    }
    const {state}=await transact();
    let cmd;
    if(provider){
      const context=lastClarification?JSON.stringify({previous:lastClarification,reply:request}):request;
      const response=await provider.ai.chat(messages(context,state.rows),{model:'gpt-4o-mini',temperature:0});
      if(response.error)throw Error(response.error.message||'Model request failed.');
      try{cmd=JSON.parse(response.message.content);}catch{throw Error('The model returned invalid JSON. Please rephrase.');}
    }else cmd=sample(request,state.rows);
    await apply(cmd);lastClarification=cmd.action==='clarify'?{request,question:cmd.question}:null;
  }catch(error){await fail(error);}finally{busy(false);}
};
$('yes').onclick=async()=>{if(!pending)return;const id=pending.id;clearOutput();busy(true);try{await apply({action:'delete',id},id);}catch(e){await fail(e);}finally{busy(false);}};
$('no').onclick=async()=>{clearOutput();try{const {state}=await transact(s=>record(s,'Deletion canceled.'));render(state);$('status').textContent='Kept the assignment.';}catch(e){await fail(e);}};
$('reset').onclick=async()=>{try{await apply({action:'list'});}catch(e){await fail(e);}};
$('today').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});hint();
try{render((await transact()).state);}catch(e){await fail(e);}

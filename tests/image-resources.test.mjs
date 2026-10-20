import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createImageResourcesPreview } from './image-resources-preview.mjs';

class ApiError extends Error { constructor(code,message){super(message);this.code=code;} }
const source=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value?.props?[value,...nodes(value.props.children)]:[];
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function load(name,modules={},globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(source(name),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,URLSearchParams,AbortController,Blob,console,...globals,require:id=>{if(id in modules)return modules[id];throw new Error(`Unexpected module ${id}`);}});
  return module.exports;
}
function library(globals={},apiClient={}) {
  return load('lib/image-resources.ts',{'./api-client':{ApiError,apiClient}},{localStorage:{getItem:()=>null},...globals});
}
test('image codes escape CQ delimiters and managed paths become authenticated same-origin URLs',()=>{
  const lib=library();
  assert.equal(lib.imageResourceCode('deck/塔罗.json/a,b[2]&.png'),'[img,file=data/images/deck/塔罗.json/a&#44;b&#91;2&#93;&amp;.png]');
  const url=new URL(lib.managedImageSource('data/images/deck/塔罗.json/a&#44;b.png'),'https://fixture.invalid');
  assert.equal(url.pathname,'/api/resources/images/content');assert.equal(url.searchParams.get('id'),'data/images/deck/塔罗.json/a,b.png');
  assert.equal(lib.managedImageSource('https://old.invalid/api/assets/old.png'),'/api/assets/old.png');
  assert.equal(lib.managedImageSource('https://remote.invalid/a.png'),'https://remote.invalid/a.png');
});
test('resource lists always request bounded pages, literal search, directory and sort',()=>{
  const url=new URL(library().resourceUrl('plugin/旅途助手',3,20,'a,%_', 'size',true),'https://fixture.invalid');
  assert.equal(url.searchParams.get('directory'),'plugin/旅途助手');assert.equal(url.searchParams.get('page'),'3');assert.equal(url.searchParams.get('size'),'20');assert.equal(url.searchParams.get('q'),'a,%_');assert.equal(url.searchParams.get('dir'),'desc');
});
test('uploads send raw File bytes, track progress and never silently overwrite on conflict',async()=>{
  const requests=[];let progress=0;
  class Request {upload={};status=409;responseText='{"code":409,"message":"already exists"}';open(method,url){this.method=method;this.url=url;}setRequestHeader(){}send(body){this.body=body;requests.push(this);this.upload.onprogress({lengthComputable:true,loaded:3,total:4});this.onload();}}
  const lib=library({XMLHttpRequest:Request}),file={name:'图.png',size:4};
  await assert.rejects(lib.uploadResource(file,'plugin/my-plugin',false,value=>progress=value),error=>error.code===409);
  assert.equal(requests.length,1);assert.equal(requests[0].body,file);assert.equal(progress,75);assert.equal(new URL(requests[0].url,'https://fixture.invalid').searchParams.get('overwrite'),'0');
});
test('image downloads preserve cancellation and reject login JSON instead of showing a broken image',async()=>{
  const calls=[],controller=new AbortController();
  const lib=library({fetch:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({code:401,message:'login required'})};}});
  await assert.rejects(lib.resourceBlob('resource-id',controller.signal),error=>error.code===401);assert.equal(calls.length,1);assert.equal(calls[0].options.signal,controller.signal);
});
test('reference warnings are normalized to readable text rather than React objects',async()=>{
  const lib=library({}, {get:async()=>({data:{items:[],warnings:[{document:'deck/a.json',error:'invalid JSON'}],dynamicReferencesUncertain:true}})});
  assert.deepEqual(plain((await lib.resourceUsages('deck/a.json/a.png')).warnings),['deck/a.json: invalid JSON']);
});

function browserHarness({ uploadError, operation }={}) {
  const contexts=new Map();let active,tree;const effects=[],blobs=[],revoked=[],selected=[],listUrls=[],toasts=[];
  const context=name=>{if(!contexts.has(name))contexts.set(name,{slots:[],cursor:0});active=contexts.get(name);active.cursor=0;};
  const same=(a,b)=>a?.length===b.length && b.every((value,i)=>Object.is(a[i],value));
  const react={
    useState(initial){const i=active.cursor++,slots=active.slots;if(!slots[i]){const slot={value:typeof initial==='function'?initial():initial};slot.set=value=>slot.value=typeof value==='function'?value(slot.value):value;slots[i]=slot;}return [slots[i].value,slots[i].set];},
    useRef(initial){const i=active.cursor++;return active.slots[i]??={current:initial};},
    useEffect(callback,deps){const i=active.cursor++,slots=active.slots;if(!same(slots[i]?.deps,deps)){const previous=slots[i],slot={deps};slots[i]=slot;effects.push(()=>{previous?.cleanup?.();slot.cleanup=callback();});}},
  };
  const entry={id:'1'.repeat(32),path:'reply/a.png',name:'a.png',isDirectory:false,size:100,modified:0,references:0,code:'[img,file=data/images/reply/a.png]'};
  const components=new Proxy({}, {get:(_target,key)=>String(key)});
  const lib=library();
  const modules={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'lucide-react':components,
    'react-i18next':{useTranslation:()=>({t:key=>key})},'@/hooks/use-toast':{useToast:()=>value=>toasts.push(value)},'@/hooks/use-dialogs':{useDialogs:()=>({node:null,confirm:async()=>false,prompt:async()=>null})},
    '@/hooks/use-server-list-page':{useServerListPage:url=>{listUrls.push(url);return {data:{items:[entry],total:47,page:1,size:20},loading:false,error:false,load:async()=>{}};}},
    '@/lib/api-client':{ApiError,apiClient:{}},'@/lib/image-resources':{...lib,resourceOperation:operation,uploadResource:async()=>{if(uploadError)throw uploadError;return entry;},resourceBlob:async(id,signal)=>{blobs.push({id,signal});return new Blob(['image'],{type:'image/png'});}},
  };
  for(const name of ['button','input','pagination-bar','select','dropdown-menu','dialog'])modules[`@/components/ui/${name}`]=components;
  const component=load('components/image-resource-browser.tsx',modules,{navigator:{clipboard:{writeText:async()=>{}}},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:value=>revoked.push(value)},window:{setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>2,clearInterval:()=>{}}});
  return {
    blobs,revoked,listUrls,selected,toasts,
    render(){context('browser');tree=nodes(component.ImageResourceBrowser({initialDirectory:'reply',onSelect:value=>selected.push(value)}));effects.splice(0).forEach(run=>run());return tree;},
    button(label){return tree.find(node=>node.type==='Button' && node.props['aria-label']===label);},
    textButton(label){return tree.find(node=>node.type==='Button' && [node.props.children].flat().includes(label));},
    selectFirst(){tree.find(node=>node.type==='input' && node.props['aria-label']===entry.path).props.onChange();},
    async upload(){const input=tree.find(node=>node.type==='input' && node.props.accept===lib.IMAGE_ACCEPT);input.props.onChange({target:{files:[{name:'a.png',size:10}]}});await flush();},
    preview(){const preview=tree.find(node=>typeof node.type==='function' && node.type.name==='ImagePreview');assert.ok(preview);context('preview');const result=nodes(preview.type(preview.props));effects.splice(0).forEach(run=>run());return result;},
    unmount(){for(const {slots} of contexts.values())for(const slot of slots)slot?.cleanup?.();},
  };
}
test('real browser component does not mount or fetch image content until explicit Preview',async()=>{
  const h=browserHarness();const initial=h.render();assert.equal(initial.filter(node=>node.type==='img').length,0);assert.equal(h.blobs.length,0);
  h.button('image_resources.preview').props.onClick();h.render();h.preview();await flush();assert.equal(h.blobs.length,1);assert.equal(h.blobs[0].id,'1'.repeat(32));
  assert.equal(h.preview().filter(node=>node.type==='img').length,1);h.unmount();assert.equal(h.blobs[0].signal.aborted,true);assert.deepEqual(h.revoked,['blob:fixture']);
});
test('picker selects the same canonical resource and never fetches it just for inserting a code',()=>{
  const h=browserHarness();h.render();h.button('image_resources.select').props.onClick();assert.equal(h.selected[0].code,'[img,file=data/images/reply/a.png]');assert.equal(h.blobs.length,0);h.unmount();
});
test('failed shared uploads report the error, release busy state and never insert into parent reply drafts',async()=>{
  const h=browserHarness({uploadError:new ApiError(500,'upload refused')});h.render();await h.upload();
  assert.equal(h.selected.length,0);assert.equal(h.toasts.at(-1).variant,'destructive');assert.match(h.toasts.at(-1).description,/upload refused/);
  h.render();assert.equal(h.button('image_resources.select').props.disabled,false);h.unmount();
});
test('paste retains resource-operation warnings and clears the clipboard only after success',async()=>{
  const calls=[],h=browserHarness({operation:async(...args)=>{calls.push(args);return {completed:1,warnings:['dynamic plugin references require checking']};}});
  h.render();h.selectFirst();h.render();h.textButton('image_resources.copy').props.onClick();h.render();
  h.textButton('image_resources.paste').props.onClick();await flush();h.render();
  assert.equal(calls.length,1);assert.equal(calls[0][0],'copy');
  assert.equal(h.toasts.find(value=>value.title==='resource_transfer.warnings')?.description,'dynamic plugin references require checking');
  assert.equal(h.textButton('image_resources.paste'),undefined);h.unmount();
});
test('reply, text, deck and chat editors all use the common resource picker rather than legacy upload',()=>{
  for(const file of ['components/reply/reply-form.tsx','pages/commands-page.tsx','components/deck-editor.tsx','pages/groups-page.tsx']){assert.ok(source(file).includes('ImageResourcePicker'),file);assert.ok(!source(file).includes('/api/assets/upload'),file);}
  assert.ok(source('components/deck-editor.tsx').includes('directory={`deck/${filename}`}'));
});
test('isolated preview lists 47 metadata rows by server page and generates images only on content requests',()=>{
  const preview=createImageResourcesPreview();const url=new URL('http://preview.invalid/api/resources/images?directory=reply&page=3&size=20');
  const result=preview('GET','/resources/images',url).data;assert.equal(result.total,47);assert.equal(result.items.length,7);assert.ok(!result.items.some(item=>'url' in item || 'thumbnail' in item));
});
test('all resource-manager and transfer messages are translated in four locales',()=>{
  for(const [file,key] of [['i18n/image-resources.ts','imageResourcesCopy'],['i18n/resource-transfer.ts','resourceTransferCopy']]){
    const copy=load(file)[key],keys=Object.keys(copy.en).sort();for(const lang of ['zh-Hans','zh-Hant','ja']){assert.deepEqual(Object.keys(copy[lang]).sort(),keys);assert.ok(Object.values(copy[lang]).every(value=>typeof value==='string' && value.length));}
  }
});

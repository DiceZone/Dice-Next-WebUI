// Ephemeral image-manager fixture. Only generated SVG bytes are returned after
// an explicit content request. No user file, adapter or external host is opened.
export function createImageResourcesPreview() {
  let counter=0;
  const entries=new Map();
  const put=(path,folder=false) => {const id=(++counter).toString(16).padStart(32,'0');entries.set(path,{id,path,name:path.split('/').at(-1),isDirectory:folder,size:folder?0:734+counter,modified:1792400400,references:folder?0:counter%3,code:folder?'':`[img,file=data/images/${path}]`,protected:!path.includes('/')});};
  for(const name of ['reply','deck','text','plugin','mod','shared','chat','cache'])put(name,true);
  put('deck/星灯塔罗.json',true);put('deck/星灯塔罗.json/cards',true);put('deck/星灯塔罗.json/cards/星星.svg');
  put('plugin/旅途助手',true);put('plugin/旅途助手/weather',true);put('plugin/旅途助手/weather/晴天.svg');
  for(let i=1;i<=47;i++)put(`reply/回复插图-${String(i).padStart(2,'0')}.svg`);
  const result=data=>({data});
  return (method,path,url,raw=Buffer.alloc(0)) => {
    if(!path.startsWith('/resources/images'))return null;
    if(path==='/resources/images' && method==='GET') {
      const directory=url.searchParams.get('directory')||'',query=(url.searchParams.get('q')||'').toLowerCase(),size=Math.max(1,Math.min(100,Number(url.searchParams.get('size'))||20));
      let items=[...entries.values()].filter(entry=>entry.path.slice(0,Math.max(0,entry.path.lastIndexOf('/')))===directory && entry.name.toLowerCase().includes(query));
      if(url.searchParams.get('trash')==='1')items=[];
      const sort=url.searchParams.get('sort')||'name',direction=url.searchParams.get('dir')==='desc'?-1:1;
      items.sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||direction*(typeof a[sort]==='number'?a[sort]-b[sort]:String(a[sort]).localeCompare(String(b[sort]))));
      const page=Math.max(1,Math.min(Number(url.searchParams.get('page'))||1,Math.max(1,Math.ceil(items.length/size))));
      return result({items:items.slice((page-1)*size,page*size),total:items.length,page,size,directory,root:'data/images',migration:{status:'complete',copied:0,warnings:[]}});
    }
    if(path==='/resources/images/content') {
      const entry=[...entries.values()].find(item=>item.id===url.searchParams.get('id'));if(!entry || entry.isDirectory)throw new Error('Image not found');
      return {bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" rx="24" fill="#17243f"/><circle cx="240" cy="130" r="65" fill="#a5b4fc"/><path d="m240 72 14 41 43 1-34 26 12 42-35-25-35 25 12-42-34-26 43-1z" fill="#fef3c7"/><text x="240" y="256" fill="#e0e7ff" font-family="sans-serif" font-size="23" text-anchor="middle">Dice!Next · 图片资源预览</text></svg>'),type:'image/svg+xml'};
    }
    if(path==='/resources/images/usages')return result({items:[{id:'preview-reply',label:'自定义回复「旅途问候」',type:'reply',path:url.searchParams.get('path')}],warnings:[],dynamicReferencesUncertain:true});
    if(path==='/resources/images/scan')return result({documents:27,references:12,warnings:[]});
    if(path==='/resources/images/migration')return result({status:'complete',copied:0,warnings:[]});
    const body=raw.length?JSON.parse(raw.toString()):{};
    if(path==='/resources/images/folder') {put(body.path,true);return result({});}
    if(path==='/resources/images/operation')return result({completed:body.paths?.length||0,warnings:[]});
    throw new Error('This resource action is not available in the isolated preview');
  };
}

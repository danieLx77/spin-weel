export function serviceWorkerSource({ base, cache, prefix, core, optional }) {
  return `const CACHE=${JSON.stringify(cache)},PREFIX=${JSON.stringify(prefix)},SHELL=${JSON.stringify(base)},CORE=${JSON.stringify(core)},OPTIONAL=${JSON.stringify(optional)};
const KNOWN=new Set([...CORE,...OPTIONAL]);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const current=await caches.open(CACHE),keys=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
 // Only unchanged, content-hashed optional modules can survive a release.
 for(const key of keys){const old=await caches.open(key);for(const path of OPTIONAL.filter(path=>path.startsWith(SHELL+'assets/'))){if(await current.match(path))continue;const saved=await old.match(path);if(saved)await current.put(path,saved);}}
 await Promise.all(keys.map(key=>caches.delete(key)));await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data==='SKIP_WAITING'){self.skipWaiting();return;}
 if(event.data?.type==='CACHE_FEATURES'&&Array.isArray(event.data.urls))event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const path of [...new Set(event.data.urls.slice(0,20))]){
   if(typeof path!=='string'||!OPTIONAL.includes(path)||await cache.match(path))continue;
   try{const response=await fetch(path);if(response.ok)await cache.put(path,response);}catch{}
  }
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(SHELL))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(SHELL))));return;
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),saved=await cache.match(event.request,{ignoreVary:true});if(saved)return saved;
  const response=await fetch(event.request);
  if(response.ok&&!url.search&&KNOWN.has(url.pathname))event.waitUntil(cache.put(event.request,response.clone()).catch(()=>{}));
  return response;
 })());
});`;
}

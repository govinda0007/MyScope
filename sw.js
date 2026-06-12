const CACHE_NAME = 'lumacam-v1';
const ASSETS = [
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache=> cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=> k !== CACHE_NAME).map(k=> caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e)=>{
  // network-first for navigation, cache-first for assets
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(resp=>{
        if(resp.ok && e.request.method === 'GET'){
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache=> cache.put(e.request, clone));
        }
        return resp;
      }).catch(()=> cached);
    })
  );
});

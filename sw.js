// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.2 (CORREGIDA - NO CONGELA)
// ==========================================

const CACHE_NAME = 'campanas-v2';
const OFFLINE_URL = 'index.html';

// Archivos CRÍTICOS que deben cachearse SIEMPRE
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  
  // Iconos
  './icon-192.png',
  './icon-512.png',
  './icono.png',
  './icon-96.png',
  './qr_descarga.png',
  
  // Audios
  './campana1.mp3',
  './campana2.mp3',
  './campana3.mp3',
  './emergencia.mp3'
];

// ==========================================
// INSTALACIÓN SEGURA Y SIMPLE
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión 1.0.2...');
  
  // Instalación SIMPLE - solo cachear lo esencial
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos esenciales...');
        // Solo cachear HTML, CSS, JS y manifest
        const esenciales = PRECACHE_URLS.filter(url => 
          url.endsWith('.html') || 
          url.endsWith('.css') || 
          url.endsWith('.js') ||
          url.endsWith('.json')
        );
        
        return cache.addAll(esenciales)
          .then(() => {
            console.log('[SW] Archivos esenciales cacheados');
            return self.skipWaiting();
          })
          .catch(error => {
            console.warn('[SW] Algunos archivos no se cachearon:', error);
            return self.skipWaiting(); // Continuar aunque falle
          });
      })
  );
});

// ==========================================
// ACTIVACIÓN SEGURA
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar caches viejas
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Eliminando cache vieja:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar control inmediato
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activación completada');
      
      // Enviar mensaje a todas las pestañas
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_READY',
            version: '1.0.2'
          });
        });
      });
    })
  );
});

// ==========================================
// ESTRATEGIA DE FETCH CORREGIDA
// ==========================================
self.addEventListener('fetch', event => {
  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // 1. Si es la página principal (navegación)
  if (event.request.mode === 'navigate' && url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(OFFLINE_URL)
        .then(cachedResponse => {
          // Intentar red primero para la página principal
          return fetch(event.request)
            .then(networkResponse => {
              // Si hay red, actualizar cache y devolver
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(OFFLINE_URL, responseClone);
              });
              return networkResponse;
            })
            .catch(() => {
              // Si no hay red, usar cache
              return cachedResponse || new Response('Página no disponible offline', {
                status: 503,
                headers: { 'Content-Type': 'text/html' }
              });
            });
        })
    );
    return;
  }
  
  // 2. Para recursos locales (CSS, JS, imágenes, audios)
  if (url.origin === location.origin) {
    // Estrategia: Cache First para recursos estáticos
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Sirviendo desde cache:', url.pathname);
            return cachedResponse;
          }
          
          // Si no está en cache, ir a red
          return fetch(event.request)
            .then(networkResponse => {
              // Solo cachear si la respuesta es buena
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(error => {
              console.warn('[SW] Error de red para:', url.pathname, error);
              
              // Para audios, devolver respuesta vacía en lugar de error
              if (url.pathname.endsWith('.mp3')) {
                return new Response(null, {
                  status: 404,
                  statusText: 'Audio no encontrado'
                });
              }
              
              return new Response('Recurso no disponible', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
    return;
  }
  
  // 3. Para recursos externos, red primero
  event.respondWith(fetch(event.request));
});

// ==========================================
// MANEJO DE MENSAJES MEJORADO
// ==========================================
self.addEventListener('message', event => {
  console.log('[SW] Mensaje:', event.data);
  
  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => console.log('[SW] Cache limpiada'));
      break;
      
    case 'GET_STATUS':
      event.ports[0].postMessage({
        type: 'SW_STATUS',
        version: '1.0.2',
        cacheName: CACHE_NAME,
        controlling: !!self.clients
      });
      break;
  }
});

console.log('[SW] v1.0.2 cargado - Modo seguro activado');
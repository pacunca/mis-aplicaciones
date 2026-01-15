// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.1 (ESTABLE)
// ==========================================

const CACHE_NAME = 'campanas-v1';
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
  
  // Audios (ASEGURARSE que existen)
  './campana1.mp3',
  './campana2.mp3',
  './campana3.mp3',
  './emergencia.mp3'
];

// ==========================================
// INSTALACIÓN SEGURA
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  
  // NO usar skipWaiting() aquí - causa problemas
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos críticos');
        
        // Cachear solo los archivos que EXISTEN
        return Promise.all(
          PRECACHE_URLS.map(url => {
            return fetch(url, { cache: 'reload' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.warn('[SW] No se pudo cachear:', url);
                return Promise.resolve();
              })
              .catch(error => {
                console.warn('[SW] Error cacheando:', url, error);
                return Promise.resolve(); // Continuar aunque falle uno
              });
          })
        );
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting(); // SOLO aquí, después de cachear
      })
  );
});

// ==========================================
// ACTIVACIÓN SEGURA
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  
  event.waitUntil(
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
    })
    .then(() => {
      console.log('[SW] Activación completada');
      return self.clients.claim(); // Tomar control de las pestañas
    })
  );
});

// ==========================================
// ESTRATEGIA DE FETCH SEGURA
// ==========================================
self.addEventListener('fetch', event => {
  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;
  
  // Evitar solicitudes a extensiones del navegador
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('extension')) return;
  
  const requestUrl = new URL(event.request.url);
  
  // Para archivos locales, usar Cache First
  if (requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Si está en cache, devolverlo
          if (cachedResponse) {
            console.log('[SW] Sirviendo desde cache:', event.request.url);
            return cachedResponse;
          }
          
          // Si no está en cache, buscar en red
          return fetch(event.request)
            .then(networkResponse => {
              // Verificar respuesta válida
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              
              // Clonar respuesta para cache
              const responseToCache = networkResponse.clone();
              
              // Guardar en cache para futuro
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                  console.log('[SW] Guardado en cache:', event.request.url);
                });
              
              return networkResponse;
            })
            .catch(error => {
              console.error('[SW] Error de red:', error);
              
              // Si es la página principal, servir OFFLINE_URL
              if (event.request.mode === 'navigate') {
                return caches.match(OFFLINE_URL);
              }
              
              // Para otros recursos, devolver error controlado
              return new Response('Recurso no disponible offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        })
    );
  } else {
    // Para recursos externos, Network First
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Si falla la red, NO intentar cache
          return new Response('Se requiere conexión para este recurso', {
            status: 408,
            statusText: 'Network Required'
          });
        })
    );
  }
});

// ==========================================
// MANEJO DE MENSAJES
// ==========================================
self.addEventListener('message', event => {
  console.log('[SW] Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        console.log('[SW] Cache limpiada');
      });
  }
});

console.log('[SW] Cargado y listo');
// ==========================================
// SERVICE WORKER SIMPLIFICADO - Campanas Parroquiales
// ==========================================

const CACHE_NAME = 'campanas-simple-v1';
const ARCHIVOS_ESENCIALES = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icono.png',
  './icon-192.png',
  './icon-512.png',
  './campana1.mp3',
  './campana2.mp3',
  './campana3.mp3',
  './emergencia.mp3'
  // NOTA: qr_descarga.png es opcional - si no existe, no causará error
];

// ==========================================
// INSTALACIÓN SIMPLIFICADA
// ==========================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // Intentar cachear archivos esenciales, ignorar errores de archivos faltantes
        return Promise.all(
          ARCHIVOS_ESENCIALES.map(function(archivo) {
            return cache.add(archivo).catch(function(error) {
              console.log('No se pudo cachear:', archivo, error);
              // Continuar aunque falle un archivo
              return Promise.resolve();
            });
          })
        );
      })
      .then(function() {
        // Activar inmediatamente
        return self.skipWaiting();
      })
  );
});

// ==========================================
// ACTIVACIÓN Y LIMPIEZA
// ==========================================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Eliminar cachés viejas que no sean la actual
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Tomar control de todas las pestañas
      return self.clients.claim();
    })
  );
});

// ==========================================
// MANEJO DE PETICIONES (CACHE FIRST SIMPLE)
// ==========================================
self.addEventListener('fetch', function(event) {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Para archivos de audio, usar estrategia diferente
  if (event.request.url.includes('.mp3')) {
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        // Si está en cache, usarlo (para offline)
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Si no está en cache, buscar en red
        return fetch(event.request).then(function(networkResponse) {
          // No guardar en cache (los audios son grandes)
          return networkResponse;
        }).catch(function() {
          // Si falla la red y no está en cache, no hay nada que hacer
          return new Response('', { status: 404 });
        });
      })
    );
    return;
  }
  
  // Para otros archivos (HTML, CSS, JS, imágenes)
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      // Primero intentar desde cache
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Si no está en cache, buscar en red
      return fetch(event.request).then(function(networkResponse) {
        // Verificar si la respuesta es válida para cachear
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Clonar respuesta para cache
        var responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(function() {
        // Si es una petición de página y no hay conexión
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
        // Para otros tipos, devolver error
        return new Response('Sin conexión', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});

// ==========================================
// MANEJO DE MENSAJES SIMPLE
// ==========================================
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
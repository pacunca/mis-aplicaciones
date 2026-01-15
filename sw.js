// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.0
// Diseñado para funcionar por 20+ años
// ==========================================

const CACHE_NAME = 'campanas-pwav1';
const APP_VERSION = '1.0.0';
const OFFLINE_FALLBACK = '/index.html';

// ==========================================
// LISTA COMPLETA DE RECURSOS A CACHEAR
// ==========================================
const ARCHIVOS_CRITICOS = [
  // Archivos principales
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  
  // Iconos e imágenes
  './icon-192.png',
  './icon-512.png',
  './icono.png',
  './icon-96.png',
  './qr_descarga.png',
  
  // Archivos de audio
  './campana1.mp3',
  './campana2.mp3',
  './campana3.mp3',
  './emergencia.mp3',
  
  // Fallbacks
  OFFLINE_FALLBACK
];

// ==========================================
// INSTALACIÓN: DESCARGAR TODO INMEDIATAMENTE
// ==========================================
self.addEventListener('install', function(event) {
  console.log('🔔 Service Worker: Instalando v' + APP_VERSION);
  
  // Forzar activación inmediata
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Cache abierto:', CACHE_NAME);
        
        // Intentar cachear todos los recursos
        return cache.addAll(ARCHIVOS_CRITICOS.map(url => {
          // Añadir timestamp para evitar cache del navegador
          return new Request(url, {
            cache: 'reload',
            headers: new Headers({
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache'
            })
          });
        }))
        .then(function() {
          console.log('✅ Todos los recursos cacheados:', ARCHIVOS_CRITICOS.length, 'archivos');
          
          // Verificar qué se cacheó realmente
          return cache.keys().then(keys => {
            console.log('📋 Archivos en cache:', keys.map(k => k.url));
            
            // Verificar archivos críticos
            const cacheados = keys.map(k => new URL(k.url).pathname);
            const faltantes = ARCHIVOS_CRITICOS.filter(url => 
              !cacheados.includes(new URL(url, self.location.origin).pathname)
            );
            
            if (faltantes.length > 0) {
              console.warn('⚠️ Algunos archivos no se cachearon:', faltantes);
              
              // Intentar cachearlos individualmente (más robusto)
              const promesasIndividuales = faltantes.map(url => 
                cache.add(url).catch(e => {
                  console.warn('❌ No se pudo cachear:', url, e.message);
                  return null;
                })
              );
              
              return Promise.all(promesasIndividuales);
            }
            
            return Promise.resolve();
          });
        })
        .catch(function(error) {
          console.error('❌ Error durante instalación:', error);
          
          // Cachear aunque falle alguno - resiliencia
          return cache.addAll(ARCHIVOS_CRITICOS.filter((_, i) => i < 5))
            .then(() => console.log('📱 Recursos críticos cacheados (modo resiliente)'));
        });
      })
  );
});

// ==========================================
// ACTIVACIÓN: LIMPIAR CACHÉS ANTIGUOS
// ==========================================
self.addEventListener('activate', function(event) {
  console.log('🔔 Service Worker: Activando v' + APP_VERSION);
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Eliminar cachés antiguas que no sean la actual
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(function() {
      // Tomar control inmediato de todas las pestañas
      return self.clients.claim();
    })
    .then(function() {
      console.log('✅ Service Worker activado y listo');
      
      // Notificar a todas las pestañas
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
            cache: CACHE_NAME
          });
        });
      });
    })
  );
});

// ==========================================
// ESTRATEGIA DE CACHE: CACHE FIRST + NETWORK FALLBACK
// ==========================================
self.addEventListener('fetch', function(event) {
  // Ignorar solicitudes no GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignorar solicitudes a servidores externos (excepto recursos críticos)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // Permitir recursos críticos externos (PIN remoto, PDF)
    if (url.href.includes('pin-actual.txt') || url.href.includes('instrucciones.pdf')) {
      // Estrategia: Network First con cache fallback para externos
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Cachear respuesta exitosa
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(() => {
            // Si falla la red, intentar desde cache
            return caches.match(event.request);
          })
      );
    }
    return; // Ignorar otros externos
  }
  
  // ESTRATEGIA PRINCIPAL: CACHE FIRST para recursos locales
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Si está en cache, devolverlo (INCLUSO SI HAY INTERNET)
        if (response) {
          // Actualizar cache en background si hay conexión
          if (navigator.onLine) {
            fetchAndCache(event.request);
          }
          return response;
        }
        
        // Si no está en cache, buscar en red
        return fetchAndCache(event.request)
          .catch(function(error) {
            console.log('🌐 Offline - recurso no en cache:', event.request.url);
            
            // Fallbacks específicos
            if (event.request.url.includes('.mp3')) {
              return new Response(
                JSON.stringify({ error: 'Audio no disponible offline' }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            }
            
            // Fallback genérico
            return caches.match(OFFLINE_FALLBACK);
          });
      })
  );
});

// ==========================================
// FUNCIÓN AUXILIAR: FETCH Y CACHE
// ==========================================
function fetchAndCache(request) {
  return fetch(request)
    .then(function(response) {
      // Verificar respuesta válida
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      // Cachear respuesta
      const responseToCache = response.clone();
      caches.open(CACHE_NAME)
        .then(function(cache) {
          cache.put(request, responseToCache);
        });
      
      return response;
    });
}

// ==========================================
// MANEJO DE MENSAJES (ACTUALIZACIONES, VERIFICACIÓN)
// ==========================================
self.addEventListener('message', function(event) {
  console.log('📨 Service Worker recibió mensaje:', event.data);
  
  if (event.data.type === 'VERIFICAR_CACHE') {
    // Verificar estado del cache
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        event.ports[0].postMessage({
          type: 'ESTADO_CACHE',
          total: keys.length,
          archivos: keys.map(k => k.url),
          version: APP_VERSION
        });
      });
  }
  
  if (event.data.type === 'FORZAR_ACTUALIZACION') {
    // Forzar actualización del Service Worker
    self.skipWaiting();
    self.clients.claim().then(() => {
      console.log('🔄 Actualización forzada completada');
    });
  }
  
  if (event.data.type === 'LIMPIAR_CACHE') {
    // Limpiar cache específico
    caches.delete(CACHE_NAME).then(() => {
      console.log('🧹 Cache limpiado:', CACHE_NAME);
    });
  }
});

// ==========================================
// MANEJO DE SINCRONIZACIÓN EN BACKGROUND
// ==========================================
self.addEventListener('sync', function(event) {
  if (event.tag === 'sincronizar-pin') {
    console.log('🔄 Intentando sincronización en background');
    event.waitUntil(sincronizarPINBackground());
  }
});

async function sincronizarPINBackground() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt');
    const nuevoPIN = (await response.text()).trim();
    
    if (/^\d{4}$/.test(nuevoPIN)) {
      // Almacenar en IndexedDB o cache
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        new Request('/pin-remoto-cache'),
        new Response(JSON.stringify({
          pin: nuevoPIN,
          fecha: new Date().toISOString()
        }))
      );
      
      console.log('✅ PIN sincronizado en background:', nuevoPIN);
      
      // Notificar a las pestañas
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'PIN_ACTUALIZADO',
          pin: nuevoPIN,
          fecha: new Date().toLocaleString()
        });
      });
    }
  } catch (error) {
    console.log('❌ Error sincronizando en background:', error);
  }
}

// ==========================================
// MANEJO DE PUSH NOTIFICATIONS (FUTURO)
// ==========================================
self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Notificación del sistema de campanas',
    icon: './icon-192.png',
    badge: './icon-96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Campanas Parroquiales', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === './' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// ==========================================
// POLYFILLS PARA COMPATIBILIDAD A LARGO PLAZO
// ==========================================
if (typeof caches === 'undefined') {
  console.warn('⚠️ Cache API no disponible - usando polyfill');
  // Polyfill básico (simplificado para ejemplo)
  self.caches = {
    open: () => Promise.resolve({
      match: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true)
    }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true)
  };
}

// ==========================================
// LOGGING MEJORADO PARA DEPURACIÓN
// ==========================================
const logger = {
  info: (msg, data) => console.log(`🔔 SW [${APP_VERSION}]: ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`⚠️ SW [${APP_VERSION}]: ${msg}`, data || ''),
  error: (msg, data) => console.error(`❌ SW [${APP_VERSION}]: ${msg}`, data || '')
};

logger.info('Service Worker cargado y listo');

// ==========================================
// AUTO-VERIFICACIÓN PERIÓDICA
// ==========================================
setInterval(() => {
  caches.open(CACHE_NAME)
    .then(cache => cache.keys())
    .then(keys => {
      if (keys.length < ARCHIVOS_CRITICOS.length * 0.8) {
        logger.warn('Cache por debajo del 80% - considerando recachear');
      }
    });
}, 1000 * 60 * 60 * 24); // Una vez al día
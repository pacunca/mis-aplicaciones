// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.0
// Diseñado para funcionar por 20+ años
// ==========================================

const APP_VERSION = '1.0.0';
const CACHE_NAME = `campanas-pwa-v${APP_VERSION}`;
const CACHE_LIMIT_MB = 100; // Máximo 100MB de cache
const ES_DESARROLLO = false; // Cambiar a true solo en desarrollo

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
  
  // PDF de instrucciones
  './instrucciones.pdf'
];

// ==========================================
// LOGGING - SOLO EN DESARROLLO
// ==========================================
const logger = ES_DESARROLLO ? {
  info: (msg, data) => console.log(`🔔 SW [${APP_VERSION}]: ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`⚠️ SW [${APP_VERSION}]: ${msg}`, data || ''),
  error: (msg, data) => console.error(`❌ SW [${APP_VERSION}]: ${msg}`, data || '')
} : {
  info: () => {},
  warn: () => {},
  error: () => {}
};

// ==========================================
// INSTALACIÓN: DESCARGAR TODO INMEDIATAMENTE
// ==========================================
self.addEventListener('install', function(event) {
  logger.info('Instalando');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        logger.info('Cache abierto:', CACHE_NAME);
        
        // SIMPLIFICADO: Usar cache.addAll() sin Request personalizados
        return cache.addAll(ARCHIVOS_CRITICOS)
          .then(function() {
            logger.info('Recursos cacheados:', ARCHIVOS_CRITICOS.length, 'archivos');
            
            // Verificar qué se cacheó realmente
            return cache.keys().then(keys => {
              if (ES_DESARROLLO) {
                logger.info('Archivos en cache:', keys.map(k => k.url));
              }
              
              // Verificar archivos críticos
              const cacheados = keys.map(k => new URL(k.url).pathname);
              const faltantes = ARCHIVOS_CRITICOS.filter(url => 
                !cacheados.includes(new URL(url, self.location.origin).pathname)
              );
              
              if (faltantes.length > 0) {
                logger.warn('Archivos no cacheados:', faltantes);
                
                // Intentar cachearlos individualmente (más robusto)
                const promesasIndividuales = faltantes.map(url => 
                  cache.add(url).catch(e => {
                    logger.warn('No se pudo cachear:', url, e.message);
                    return null;
                  })
                );
                
                return Promise.all(promesasIndividuales);
              }
              
              return Promise.resolve();
            });
          })
          .catch(function(error) {
            logger.error('Error durante instalación:', error);
            
            // Cachear aunque falle alguno - resiliencia
            return cache.addAll(ARCHIVOS_CRITICOS.filter((_, i) => i < 5))
              .then(() => logger.info('Recursos críticos cacheados (modo resiliente)'));
          });
      })
      .then(() => {
        // Limpiar cache si excede límite después de instalar
        return limpiarCacheSiExcedeLimite();
      })
  );
});

// ==========================================
// ACTIVACIÓN: LIMPIAR CACHÉS ANTIGUOS
// ==========================================
self.addEventListener('activate', function(event) {
  logger.info('Activando');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Eliminar cachés antiguas que no sean la actual
          if (cacheName !== CACHE_NAME && cacheName.startsWith('campanas-pwa')) {
            logger.info('Eliminando cache antigua:', cacheName);
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
      logger.info('Service Worker activado y listo');
      
      // Notificar a todas las pestañas
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVADO',
            version: APP_VERSION,
            cache: CACHE_NAME,
            timestamp: new Date().toISOString()
          });
        });
      });
    })
    .then(() => {
      // Verificar tamaño de cache después de activar
      return limpiarCacheSiExcedeLimite();
    })
  );
});

// ==========================================
// FUNCIÓN: LIMPIAR CACHE SI EXCEDE LÍMITE (100MB)
// ==========================================
async function limpiarCacheSiExcedeLimite() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    if (keys.length === 0) return;
    
    let tamañoTotal = 0;
    const tamaños = await Promise.all(
      keys.map(async key => {
        try {
          const response = await cache.match(key);
          if (response) {
            const blob = await response.blob();
            return blob.size;
          }
          return 0;
        } catch (e) {
          logger.warn('Error calculando tamaño para:', key.url);
          return 0;
        }
      })
    );
    
    tamañoTotal = tamaños.reduce((a, b) => a + b, 0);
    const limiteBytes = CACHE_LIMIT_MB * 1024 * 1024;
    
    if (ES_DESARROLLO) {
      logger.info(`Tamaño cache: ${(tamañoTotal / (1024 * 1024)).toFixed(2)}MB / ${CACHE_LIMIT_MB}MB`);
    }
    
    if (tamañoTotal > limiteBytes) {
      logger.info('Cache excede límite, limpiando...');
      
      // Eliminar el 20% más antiguo (ordenados por fecha)
      const eliminarCount = Math.ceil(keys.length * 0.2);
      logger.info(`Eliminando ${eliminarCount} archivos más antiguos`);
      
      for (let i = 0; i < eliminarCount; i++) {
        await cache.delete(keys[i]);
      }
      
      if (ES_DESARROLLO) {
        const nuevasKeys = await cache.keys();
        logger.info(`Cache limpiado: ${nuevasKeys.length} archivos restantes`);
      }
    }
  } catch (error) {
    logger.error('Error limpiando cache:', error);
  }
}

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
    // Permitir recursos críticos externos (PIN remoto)
    if (url.href.includes('pin-actual.txt')) {
      // Estrategia: Network First con cache fallback para externos
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Cachear respuesta exitosa
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
              // Verificar límite después de agregar
              limpiarCacheSiExcedeLimite();
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
        // Si está en cache, devolverlo
        if (response) {
          // Intentar actualizar cache en background (sin bloquear respuesta)
          if (event.request.cache !== 'only-if-cached') {
            fetchAndCache(event.request).catch(() => {
              // Silenciar error - ya tenemos respuesta del cache
            });
          }
          return response;
        }
        
        // Si no está en cache, buscar en red
        return fetchAndCache(event.request)
          .catch(function(error) {
            logger.info('Offline - recurso no en cache:', event.request.url);
            
            // Fallbacks específicos
            if (event.request.url.includes('.mp3')) {
              return new Response(
                JSON.stringify({ error: 'Audio no disponible offline' }),
                { 
                  headers: { 
                    'Content-Type': 'application/json'
                  } 
                }
              );
            }
            
            // Fallback a página principal
            return caches.match('./');
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
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }
      
      // Cachear respuesta
      const responseToCache = response.clone();
      caches.open(CACHE_NAME)
        .then(function(cache) {
          cache.put(request, responseToCache);
          // Verificar límite después de agregar
          limpiarCacheSiExcedeLimite();
        });
      
      return response;
    });
}

// ==========================================
// MANEJO DE MENSAJES (ACTUALIZACIONES, VERIFICACIÓN)
// ==========================================
self.addEventListener('message', function(event) {
  if (!event.data || !event.data.type) return;
  
  const tipo = event.data.type;
  logger.info('Mensaje recibido:', tipo);
  
  if (tipo === 'VERIFICAR_CACHE') {
    // Verificar estado del cache
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'ESTADO_CACHE',
            total: keys.length,
            archivos: ES_DESARROLLO ? keys.map(k => k.url) : [],
            version: APP_VERSION,
            timestamp: new Date().toISOString()
          });
        }
      })
      .catch(error => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'ERROR_CACHE',
            error: error.message,
            version: APP_VERSION
          });
        }
      });
  }
  
  if (tipo === 'FORZAR_ACTUALIZACION') {
    // Forzar actualización del Service Worker
    logger.info('Actualización forzada solicitada');
    self.skipWaiting();
    self.clients.claim().then(() => {
      logger.info('Actualización forzada completada');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: 'ACTUALIZACION_COMPLETADA',
          version: APP_VERSION
        });
      }
    });
  }
  
  if (tipo === 'LIMPIAR_CACHE') {
    // Limpiar cache específico
    caches.delete(CACHE_NAME).then(() => {
      logger.info('Cache limpiado:', CACHE_NAME);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: 'CACHE_LIMPIADO',
          nombre: CACHE_NAME
        });
      }
    });
  }
  
  if (tipo === 'ACTUALIZAR_CACHE') {
    // Actualizar recursos específicos
    if (event.data.urls && Array.isArray(event.data.urls)) {
      caches.open(CACHE_NAME).then(cache => {
        const promesas = event.data.urls.map(url => 
          fetch(url).then(response => cache.put(url, response))
        );
        Promise.all(promesas).then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              type: 'CACHE_ACTUALIZADO',
              actualizados: event.data.urls.length
            });
          }
        });
      });
    }
  }
});

// ==========================================
// MANEJO DE SINCRONIZACIÓN EN BACKGROUND
// ==========================================
self.addEventListener('sync', function(event) {
  if (event.tag === 'sincronizar-pin') {
    logger.info('Intentando sincronización en background');
    event.waitUntil(sincronizarPINBackground());
  }
});

async function sincronizarPINBackground() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt', {
      cache: 'no-store'
    });
    const nuevoPIN = (await response.text()).trim();
    
    if (/^\d{4}$/.test(nuevoPIN)) {
      // Almacenar en cache
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        new Request('/pin-remoto-cache'),
        new Response(JSON.stringify({
          pin: nuevoPIN,
          fecha: new Date().toISOString(),
          fuente: 'github'
        }), {
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
      
      logger.info('PIN sincronizado en background:', nuevoPIN);
      
      // Notificar a las pestañas
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'PIN_ACTUALIZADO',
          pin: nuevoPIN,
          fecha: new Date().toLocaleString(),
          modo: 'background-sync'
        });
      });
    }
  } catch (error) {
    logger.info('Error sincronizando en background:', error);
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
      url: data.url || './',
      timestamp: new Date().toISOString()
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
// POLYFILL PARA CACHE API CON addAll()
// ==========================================
if (typeof caches === 'undefined') {
  logger.warn('Cache API no disponible - usando polyfill IndexedDB');
  
  // Polyfill básico con IndexedDB
  const dbName = 'sw-cache-polyfill';
  let db;
  
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'url' });
        }
      };
    });
  };
  
  self.caches = {
    open: (cacheName) => {
      return initDB().then(() => ({
        match: (request) => {
          return new Promise((resolve) => {
            const transaction = db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const req = store.get(request.url || request);
            req.onsuccess = () => resolve(req.result ? new Response(req.result.data) : null);
            req.onerror = () => resolve(null);
          });
        },
        
        put: (request, response) => {
          return response.clone().arrayBuffer().then(data => {
            return new Promise((resolve, reject) => {
              const transaction = db.transaction(['cache'], 'readwrite');
              const store = transaction.objectStore('cache');
              const entry = {
                url: request.url || request,
                data: data,
                timestamp: Date.now()
              };
              const req = store.put(entry);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
            });
          });
        },
        
        addAll: (urls) => {
          return Promise.all(urls.map(url => {
            return fetch(url).then(response => {
              return response.arrayBuffer().then(data => {
                return new Promise((resolve, reject) => {
                  const transaction = db.transaction(['cache'], 'readwrite');
                  const store = transaction.objectStore('cache');
                  const entry = {
                    url: url,
                    data: data,
                    timestamp: Date.now()
                  };
                  const req = store.put(entry);
                  req.onsuccess = () => resolve();
                  req.onerror = () => reject(req.error);
                });
              });
            });
          }));
        },
        
        keys: () => {
          return new Promise((resolve) => {
            const transaction = db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const req = store.getAllKeys();
            req.onsuccess = () => resolve(req.result.map(key => ({ url: key })));
            req.onerror = () => resolve([]);
          });
        },
        
        delete: (request) => {
          return new Promise((resolve) => {
            const transaction = db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const req = store.delete(request.url || request);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
          });
        }
      }));
    },
    
    keys: () => Promise.resolve([cacheName]),
    delete: (name) => Promise.resolve(true)
  };
}

logger.info('Service Worker cargado', {
  version: APP_VERSION,
  cache: CACHE_NAME,
  modo: ES_DESARROLLO ? 'desarrollo' : 'producción'
});
// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.0
// Diseñado para durar 20+ años
// Estrategia: Cache First con Network Fallback
// ==========================================

const APP_VERSION = '1.0.0';
const CACHE_NAME = `campanas-pwa-v${APP_VERSION}`;
const CACHE_LIMIT_MB = 100;
const ES_DESARROLLO = false; // Cambiar a true solo en desarrollo local

// ==========================================
// ARCHIVOS CRÍTICOS PARA CACHEAR
// ==========================================
const ARCHIVOS_CRITICOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-96.png',
  './icon-144.png',
  './icon-180.png',
  './icon-256.png',
  './icon-384.png',
  './icon-1024.png',
  './icono.png',
  './qr_descarga.png',
  './campana1.mp3',
  './campana2.mp3',
  './campana3.mp3',
  './emergencia.mp3',
  './instrucciones.pdf'
];

// ==========================================
// SISTEMA DE LOGGING CONDICIONAL
// ==========================================
const log = ES_DESARROLLO ? 
  (msg, ...args) => console.log(`🔔 SW [${APP_VERSION}]:`, msg, ...args) : 
  () => {};

const warn = ES_DESARROLLO ? 
  (msg, ...args) => console.warn(`⚠️ SW [${APP_VERSION}]:`, msg, ...args) : 
  () => {};

const error = (msg, ...args) => console.error(`❌ SW [${APP_VERSION}]:`, msg, ...args);

// ==========================================
// INSTALACIÓN: CACHEAR TODO INMEDIATAMENTE
// ==========================================
self.addEventListener('install', function(event) {
  log('Instalando Service Worker');
  
  // Forzar activación inmediata
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        log('Cache abierto:', CACHE_NAME);
        
        // Estrategia robusta: cachear uno por uno
        return cachearArchivosIndividualmente(cache, ARCHIVOS_CRITICOS)
          .then(function(resultados) {
            const exitosos = resultados.filter(r => r.exito).length;
            const fallidos = resultados.filter(r => !r.exito);
            
            log(`Cacheados: ${exitosos}/${ARCHIVOS_CRITICOS.length} archivos`);
            
            if (fallidos.length > 0) {
              warn('Archivos no cacheados:', fallidos.map(f => f.url));
            }
            
            // Continuar aunque algunos fallen (resiliencia)
            return Promise.resolve();
          });
      })
      .then(function() {
        log('Instalación completada');
        return limpiarCacheSiExcedeLimite();
      })
      .catch(function(err) {
        error('Error durante instalación:', err);
        // No fallar la instalación por errores de cache
        return Promise.resolve();
      })
  );
});

// ==========================================
// FUNCIÓN: CACHEAR ARCHIVOS UNO POR UNO
// ==========================================
function cachearArchivosIndividualmente(cache, archivos) {
  const promesas = archivos.map(function(url) {
    return fetch(url, {
      cache: 'reload',
      credentials: 'same-origin'
    })
      .then(function(response) {
        if (!response || response.status !== 200) {
          warn(`Respuesta no válida para ${url}: ${response.status}`);
          return { url: url, exito: false, error: `HTTP ${response.status}` };
        }
        
        // Cachear la respuesta
        return cache.put(url, response.clone())
          .then(function() {
            log(`✓ Cacheado: ${url}`);
            return { url: url, exito: true };
          })
          .catch(function(err) {
            warn(`Error cacheando ${url}:`, err.message);
            return { url: url, exito: false, error: err.message };
          });
      })
      .catch(function(err) {
        warn(`Error fetch ${url}:`, err.message);
        return { url: url, exito: false, error: err.message };
      });
  });
  
  return Promise.all(promesas);
}

// ==========================================
// ACTIVACIÓN: LIMPIAR CACHÉS ANTIGUOS
// ==========================================
self.addEventListener('activate', function(event) {
  log('Activando Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('campanas-pwa')) {
              log('Eliminando cache antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        // Tomar control inmediato de todas las páginas
        return self.clients.claim();
      })
      .then(function() {
        log('Service Worker activado y controlando páginas');
        
        // Notificar a todas las páginas activas
        return self.clients.matchAll().then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({
              type: 'SW_ACTIVADO',
              version: APP_VERSION,
              cache: CACHE_NAME,
              timestamp: new Date().toISOString()
            });
          });
        });
      })
      .then(function() {
        return limpiarCacheSiExcedeLimite();
      })
  );
});

// ==========================================
// LIMPIEZA DE CACHE SI EXCEDE LÍMITE
// ==========================================
function limpiarCacheSiExcedeLimite() {
  return caches.open(CACHE_NAME)
    .then(function(cache) {
      return cache.keys()
        .then(function(keys) {
          if (keys.length === 0) {
            return Promise.resolve();
          }
          
          // Calcular tamaño aproximado
          const promesas = keys.map(function(key) {
            return cache.match(key)
              .then(function(response) {
                if (response) {
                  return response.blob().then(function(blob) {
                    return blob.size;
                  });
                }
                return 0;
              })
              .catch(function() {
                return 0;
              });
          });
          
          return Promise.all(promesas)
            .then(function(tamanos) {
              const tamanoTotal = tamanos.reduce(function(a, b) {
                return a + b;
              }, 0);
              
              const limiteBytes = CACHE_LIMIT_MB * 1024 * 1024;
              
              if (ES_DESARROLLO) {
                log(`Tamaño cache: ${(tamanoTotal / (1024 * 1024)).toFixed(2)}MB / ${CACHE_LIMIT_MB}MB`);
              }
              
              if (tamanoTotal > limiteBytes) {
                log('Cache excede límite, limpiando archivos antiguos...');
                
                // Eliminar 20% más antiguos
                const eliminarCount = Math.ceil(keys.length * 0.2);
                const promesasEliminacion = [];
                
                for (let i = 0; i < eliminarCount; i++) {
                  promesasEliminacion.push(cache.delete(keys[i]));
                }
                
                return Promise.all(promesasEliminacion)
                  .then(function() {
                    log(`${eliminarCount} archivos eliminados del cache`);
                  });
              }
              
              return Promise.resolve();
            });
        });
    })
    .catch(function(err) {
      warn('Error limpiando cache:', err);
      return Promise.resolve();
    });
}

// ==========================================
// FETCH: ESTRATEGIA CACHE FIRST
// ==========================================
self.addEventListener('fetch', function(event) {
  // Solo manejar GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Ignorar solicitudes externas (excepto PIN remoto)
  if (url.origin !== self.location.origin) {
    if (url.href.includes('pin-actual.txt') || url.href.includes('instrucciones.pdf')) {
      // Network First para recursos remotos actualizables
      event.respondWith(
        fetch(event.request)
          .then(function(response) {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(function(cache) {
                  cache.put(event.request, responseClone);
                })
                .catch(function(err) {
                  warn('Error cacheando recurso remoto:', err);
                });
            }
            return response;
          })
          .catch(function() {
            // Si falla red, intentar desde cache
            return caches.match(event.request)
              .then(function(cachedResponse) {
                if (cachedResponse) {
                  log('Usando versión cacheada de recurso remoto');
                  return cachedResponse;
                }
                // Si no hay cache, devolver error genérico
                return new Response(
                  JSON.stringify({ error: 'Recurso no disponible offline' }),
                  { 
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' }
                  }
                );
              });
          })
      );
    }
    return; // Ignorar otros externos
  }
  
  // ESTRATEGIA PRINCIPAL: CACHE FIRST para recursos locales
  event.respondWith(
    caches.match(event.request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          // Devolver desde cache inmediatamente
          
          // Actualizar cache en background (sin bloquear respuesta)
          if (navigator.onLine) {
            actualizarCacheEnBackground(event.request)
              .catch(function() {
                // Silenciar errores de actualización background
              });
          }
          
          return cachedResponse;
        }
        
        // Si no está en cache, buscar en red
        return fetch(event.request)
          .then(function(networkResponse) {
            // Validar respuesta
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            
            // Cachear para futuro uso
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache)
                  .then(function() {
                    limpiarCacheSiExcedeLimite();
                  });
              })
              .catch(function(err) {
                warn('Error cacheando recurso nuevo:', err);
              });
            
            return networkResponse;
          })
          .catch(function(err) {
            log('Offline - recurso no en cache:', event.request.url);
            
            // Fallbacks según tipo de recurso
            if (event.request.url.includes('.mp3')) {
              return new Response(
                JSON.stringify({ error: 'Audio no disponible offline' }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            }
            
            if (event.request.url.includes('.pdf')) {
              return new Response(
                JSON.stringify({ error: 'PDF no disponible offline' }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            }
            
            // Fallback a página principal para navegación
            return caches.match('./index.html')
              .then(function(indexResponse) {
                return indexResponse || new Response(
                  'Offline - Recurso no disponible',
                  { status: 503 }
                );
              });
          });
      })
  );
});

// ==========================================
// ACTUALIZAR CACHE EN BACKGROUND
// ==========================================
function actualizarCacheEnBackground(request) {
  return fetch(request)
    .then(function(response) {
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return Promise.resolve();
      }
      
      return caches.open(CACHE_NAME)
        .then(function(cache) {
          return cache.put(request, response.clone());
        });
    });
}

// ==========================================
// MANEJO DE MENSAJES
// ==========================================
self.addEventListener('message', function(event) {
  if (!event.data || !event.data.type) {
    return;
  }
  
  const tipo = event.data.type;
  log('Mensaje recibido:', tipo);
  
  // VERIFICAR CACHE
  if (tipo === 'VERIFICAR_CACHE') {
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.keys();
      })
      .then(function(keys) {
        const respuesta = {
          type: 'ESTADO_CACHE',
          total: keys.length,
          archivos: ES_DESARROLLO ? keys.map(function(k) { return k.url; }) : [],
          version: APP_VERSION,
          timestamp: new Date().toISOString()
        };
        
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(respuesta);
        }
      })
      .catch(function(err) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'ERROR_CACHE',
            error: err.message,
            version: APP_VERSION
          });
        }
      });
  }
  
  // FORZAR ACTUALIZACIÓN
  if (tipo === 'FORZAR_ACTUALIZACION') {
    log('Forzando actualización del Service Worker');
    self.skipWaiting();
    
    self.clients.claim()
      .then(function() {
        log('Actualización forzada completada');
        
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'ACTUALIZACION_COMPLETADA',
            version: APP_VERSION
          });
        }
        
        // Recachear archivos críticos
        return caches.open(CACHE_NAME)
          .then(function(cache) {
            return cachearArchivosIndividualmente(cache, ARCHIVOS_CRITICOS);
          });
      });
  }
  
  // LIMPIAR CACHE
  if (tipo === 'LIMPIAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(function() {
        log('Cache limpiado:', CACHE_NAME);
        
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'CACHE_LIMPIADO',
            nombre: CACHE_NAME
          });
        }
      });
  }
  
  // ACTUALIZAR RECURSOS ESPECÍFICOS
  if (tipo === 'ACTUALIZAR_CACHE' && event.data.urls && Array.isArray(event.data.urls)) {
    caches.open(CACHE_NAME)
      .then(function(cache) {
        const promesas = event.data.urls.map(function(url) {
          return fetch(url)
            .then(function(response) {
              return cache.put(url, response);
            })
            .catch(function(err) {
              warn('Error actualizando', url, ':', err);
            });
        });
        
        return Promise.all(promesas);
      })
      .then(function() {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            type: 'CACHE_ACTUALIZADO',
            actualizados: event.data.urls.length
          });
        }
      });
  }
});

// ==========================================
// BACKGROUND SYNC (si está disponible)
// ==========================================
self.addEventListener('sync', function(event) {
  if (event.tag === 'sincronizar-pin') {
    log('Sincronización background: PIN');
    event.waitUntil(sincronizarPINBackground());
  }
});

function sincronizarPINBackground() {
  const urlPIN = 'https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt';
  
  return fetch(urlPIN, { cache: 'no-store' })
    .then(function(response) {
      return response.text();
    })
    .then(function(nuevoPIN) {
      nuevoPIN = nuevoPIN.trim();
      
      if (/^\d{4}$/.test(nuevoPIN)) {
        // Cachear PIN actualizado
        return caches.open(CACHE_NAME)
          .then(function(cache) {
            return cache.put(
              new Request('/pin-remoto-cache'),
              new Response(JSON.stringify({
                pin: nuevoPIN,
                fecha: new Date().toISOString(),
                fuente: 'github'
              }), {
                headers: { 'Content-Type': 'application/json' }
              })
            );
          })
          .then(function() {
            log('PIN sincronizado en background:', nuevoPIN);
            
            // Notificar a las páginas
            return self.clients.matchAll()
              .then(function(clients) {
                clients.forEach(function(client) {
                  client.postMessage({
                    type: 'PIN_ACTUALIZADO',
                    pin: nuevoPIN,
                    fecha: new Date().toLocaleString(),
                    modo: 'background-sync'
                  });
                });
              });
          });
      }
      
      return Promise.resolve();
    })
    .catch(function(err) {
      warn('Error sincronizando PIN en background:', err);
      return Promise.resolve();
    });
}

// ==========================================
// PUSH NOTIFICATIONS (futuro)
// ==========================================
self.addEventListener('push', function(event) {
  if (!event.data) {
    return;
  }
  
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
    self.registration.showNotification(
      data.title || 'Campanas Parroquiales', 
      options
    )
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
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
// POLYFILL PARA NAVEGADORES ANTIGUOS
// ==========================================
if (typeof Promise === 'undefined') {
  error('Promise no disponible - Service Worker no funcionará');
}

if (typeof caches === 'undefined') {
  warn('Cache API no disponible - usando polyfill básico');
  
  // Polyfill básico con IndexedDB
  self.caches = {
    _db: null,
    _dbName: 'sw-cache-fallback',
    
    _initDB: function() {
      if (this._db) {
        return Promise.resolve(this._db);
      }
      
      return new Promise(function(resolve, reject) {
        const request = indexedDB.open(self.caches._dbName, 1);
        
        request.onerror = function() {
          reject(request.error);
        };
        
        request.onsuccess = function() {
          self.caches._db = request.result;
          resolve(request.result);
        };
        
        request.onupgradeneeded = function(event) {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'url' });
          }
        };
      });
    },
    
    open: function(cacheName) {
      return this._initDB().then(function(db) {
        return {
          match: function(request) {
            return new Promise(function(resolve) {
              const transaction = db.transaction(['cache'], 'readonly');
              const store = transaction.objectStore('cache');
              const url = typeof request === 'string' ? request : request.url;
              const req = store.get(url);
              
              req.onsuccess = function() {
                if (req.result) {
                  resolve(new Response(req.result.data));
                } else {
                  resolve(null);
                }
              };
              
              req.onerror = function() {
                resolve(null);
              };
            });
          },
          
          put: function(request, response) {
            return response.clone().arrayBuffer().then(function(data) {
              return new Promise(function(resolve, reject) {
                const transaction = db.transaction(['cache'], 'readwrite');
                const store = transaction.objectStore('cache');
                const url = typeof request === 'string' ? request : request.url;
                
                const entry = {
                  url: url,
                  data: data,
                  timestamp: Date.now()
                };
                
                const req = store.put(entry);
                
                req.onsuccess = function() {
                  resolve();
                };
                
                req.onerror = function() {
                  reject(req.error);
                };
              });
            });
          },
          
          keys: function() {
            return new Promise(function(resolve) {
              const transaction = db.transaction(['cache'], 'readonly');
              const store = transaction.objectStore('cache');
              const req = store.getAllKeys();
              
              req.onsuccess = function() {
                resolve(req.result.map(function(key) {
                  return { url: key };
                }));
              };
              
              req.onerror = function() {
                resolve([]);
              };
            });
          },
          
          delete: function(request) {
            return new Promise(function(resolve) {
              const transaction = db.transaction(['cache'], 'readwrite');
              const store = transaction.objectStore('cache');
              const url = typeof request === 'string' ? request : request.url;
              const req = store.delete(url);
              
              req.onsuccess = function() {
                resolve(true);
              };
              
              req.onerror = function() {
                resolve(false);
              };
            });
          }
        };
      });
    },
    
    keys: function() {
      return Promise.resolve([CACHE_NAME]);
    },
    
    delete: function() {
      return Promise.resolve(true);
    }
  };
}

// ==========================================
// LOG INICIAL
// ==========================================
log('Service Worker cargado', {
  version: APP_VERSION,
  cache: CACHE_NAME,
  modo: ES_DESARROLLO ? 'desarrollo' : 'producción',
  archivos: ARCHIVOS_CRITICOS.length
});
// ==========================================
// SERVICE WORKER - CAMPANAS PARROQUIALES
// Versión: 1.0.1 - CORREGIDO PARA CACHEAR AUDIOS
// Diseñado para durar 20+ años
// Estrategia: Cache First con Network Fallback
// ==========================================

const APP_VERSION = '1.0.1';
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
  console.log('🔔 SW: Instalando Service Worker v' + APP_VERSION);
  
  // Forzar activación inmediata
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('🔔 SW: Cache abierto:', CACHE_NAME);
        
        // Estrategia robusta: cachear uno por uno
        return cachearArchivosIndividualmente(cache, ARCHIVOS_CRITICOS)
          .then(function(resultados) {
            const exitosos = resultados.filter(r => r.exito).length;
            const fallidos = resultados.filter(r => !r.exito);
            
            console.log(`🔔 SW: Cacheados ${exitosos}/${ARCHIVOS_CRITICOS.length} archivos`);
            
            if (fallidos.length > 0) {
              console.warn('⚠️ SW: Archivos NO cacheados:', fallidos.map(f => f.url));
            } else {
              console.log('✅ SW: TODOS los archivos cacheados correctamente (incluyendo MP3)');
            }
            
            // Continuar aunque algunos fallen (resiliencia)
            return Promise.resolve();
          });
      })
      .then(function() {
        console.log('🔔 SW: Instalación completada');
        return limpiarCacheSiExcedeLimite();
      })
      .catch(function(err) {
        console.error('❌ SW: Error durante instalación:', err);
        // No fallar la instalación por errores de cache
        return Promise.resolve();
      })
  );
});

// ==========================================
// FUNCIÓN: CACHEAR ARCHIVOS UNO POR UNO
// CORREGIDA PARA MP3 Y ARCHIVOS LOCALES
// ==========================================
function cachearArchivosIndividualmente(cache, archivos) {
  const promesas = archivos.map(function(url) {
    const esAudio = url.indexOf('.mp3') > -1;
    const esPDF = url.indexOf('.pdf') > -1;
    
    // INTENTO 1: Fetch con configuración permisiva (funciona para archivos locales)
    return fetch(url, {
      mode: 'same-origin',  // Permite archivos del mismo origen
      cache: 'no-cache',    // Fuerza descarga fresh
      credentials: 'omit'   // No envía credenciales (más compatible)
    })
      .then(function(response) {
        // Validar respuesta - Aceptar status 200 O tipo opaque
        const esValida = response && (
          response.status === 200 || 
          response.status === 0 || 
          response.type === 'opaque' ||
          response.type === 'basic'
        );
        
        if (esValida) {
          // Cachear la respuesta
          return cache.put(url, response.clone())
            .then(function() {
              console.log('✅ SW: Cacheado:', url, esAudio ? '(AUDIO)' : '');
              return { url: url, exito: true };
            })
            .catch(function(err) {
              console.warn('⚠️ SW: Error al guardar en cache', url, ':', err.message);
              return { url: url, exito: false, error: err.message };
            });
        } else {
          console.warn('⚠️ SW: Respuesta no válida para', url, 'status:', response.status, 'type:', response.type);
          
          // INTENTO 2: Retry con configuración alternativa
          return intentarCachearConFallback(cache, url, esAudio);
        }
      })
      .catch(function(err) {
        console.warn('⚠️ SW: Error fetch inicial', url, ':', err.message);
        
        // INTENTO 2: Retry con configuración alternativa
        return intentarCachearConFallback(cache, url, esAudio);
      });
  });
  
  return Promise.all(promesas);
}

// ==========================================
// FUNCIÓN AUXILIAR: FALLBACK DE CACHÉ
// ==========================================
function intentarCachearConFallback(cache, url, esAudio) {
  console.log('🔄 SW: Reintentando cachear:', url);
  
  // Segundo intento con configuración más permisiva
  return fetch(url, {
    mode: 'no-cors',      // Permite CORS permisivo
    cache: 'force-cache'  // Intenta desde cache del navegador primero
  })
    .then(function(response) {
      // Con no-cors, response será 'opaque' - cachear de todos modos
      return cache.put(url, response.clone())
        .then(function() {
          console.log('✅ SW: Cacheado (fallback):', url, esAudio ? '(AUDIO)' : '');
          return { url: url, exito: true };
        })
        .catch(function(err) {
          console.error('❌ SW: Falló fallback para', url, ':', err.message);
          return { url: url, exito: false, error: err.message };
        });
    })
    .catch(function(err) {
      console.error('❌ SW: Falló completamente', url, ':', err.message);
      return { url: url, exito: false, error: err.message };
    });
}

// ==========================================
// ACTIVACIÓN: LIMPIAR CACHÉS ANTIGUOS
// ==========================================
self.addEventListener('activate', function(event) {
  console.log('🔔 SW: Activando Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('campanas-pwa')) {
              console.log('🗑️ SW: Eliminando cache antigua:', cacheName);
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
        console.log('✅ SW: Activado y controlando páginas');
        
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
                console.log(`📊 SW: Tamaño cache: ${(tamanoTotal / (1024 * 1024)).toFixed(2)}MB / ${CACHE_LIMIT_MB}MB`);
              }
              
              if (tamanoTotal > limiteBytes) {
                console.log('🧹 SW: Cache excede límite, limpiando...');
                
                // NO eliminar archivos críticos (MP3, HTML, CSS, JS)
                const keysNoEsenciales = keys.filter(function(key) {
                  const url = key.url || key;
                  return !ARCHIVOS_CRITICOS.some(function(critico) {
                    return url.includes(critico);
                  });
                });
                
                // Eliminar 20% de archivos NO esenciales
                const eliminarCount = Math.ceil(keysNoEsenciales.length * 0.2);
                const promesasEliminacion = [];
                
                for (let i = 0; i < eliminarCount; i++) {
                  promesasEliminacion.push(cache.delete(keysNoEsenciales[i]));
                }
                
                return Promise.all(promesasEliminacion)
                  .then(function() {
                    console.log(`🗑️ SW: ${eliminarCount} archivos no esenciales eliminados`);
                  });
              }
              
              return Promise.resolve();
            });
        });
    })
    .catch(function(err) {
      console.warn('⚠️ SW: Error limpiando cache:', err);
      return Promise.resolve();
    });
}

// ==========================================
// FETCH: ESTRATEGIA CACHE FIRST
// CORREGIDA PARA AUDIOS OFFLINE
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
                  console.warn('⚠️ SW: Error cacheando recurso remoto:', err);
                });
            }
            return response;
          })
          .catch(function() {
            // Si falla red, intentar desde cache
            return caches.match(event.request)
              .then(function(cachedResponse) {
                if (cachedResponse) {
                  console.log('📦 SW: Usando cache para recurso remoto');
                  return cachedResponse;
                }
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
          // ✅ ENCONTRADO EN CACHE - Devolver inmediatamente
          const esAudio = event.request.url.indexOf('.mp3') > -1;
          
          if (esAudio) {
            console.log('🔊 SW: Audio desde cache:', event.request.url);
          }
          
          // NO actualizar audios en background (pueden causar problemas)
          if (!esAudio && navigator.onLine) {
            actualizarCacheEnBackground(event.request)
              .catch(function() {
                // Silenciar errores de actualización background
              });
          }
          
          return cachedResponse;
        }
        
        // ❌ NO está en cache - Buscar en red
        console.log('🌐 SW: Cache miss, buscando en red:', event.request.url);
        
        return fetch(event.request)
          .then(function(networkResponse) {
            // Validar respuesta - Aceptar más tipos de respuesta
            const esValida = networkResponse && (
              networkResponse.status === 200 ||
              networkResponse.status === 0 ||
              networkResponse.type === 'opaque' ||
              networkResponse.type === 'basic'
            );
            
            if (esValida) {
              // Cachear para futuro uso
              const responseToCache = networkResponse.clone();
              
              caches.open(CACHE_NAME)
                .then(function(cache) {
                  cache.put(event.request, responseToCache)
                    .then(function() {
                      console.log('💾 SW: Guardado en cache desde red:', event.request.url);
                      limpiarCacheSiExcedeLimite();
                    });
                })
                .catch(function(err) {
                  console.warn('⚠️ SW: Error cacheando desde red:', err);
                });
            }
            
            return networkResponse;
          })
          .catch(function(err) {
            console.error('❌ SW: Offline y recurso no en cache:', event.request.url);
            
            // Fallbacks según tipo de recurso
            if (event.request.url.indexOf('.mp3') > -1) {
              return new Response(
                'Audio no disponible offline',
                { 
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                }
              );
            }
            
            if (event.request.url.indexOf('.pdf') > -1) {
              return new Response(
                'PDF no disponible offline',
                { 
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'text/plain' }
                }
              );
            }
            
            // Fallback a página principal
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
      const esValida = response && (
        response.status === 200 ||
        response.status === 0 ||
        response.type === 'opaque' ||
        response.type === 'basic'
      );
      
      if (!esValida) {
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
  console.log('📨 SW: Mensaje recibido:', tipo);
  
  // VERIFICAR CACHE
  if (tipo === 'VERIFICAR_CACHE') {
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.keys();
      })
      .then(function(keys) {
        // Verificar específicamente los MP3
        const audiosCacheados = keys.filter(function(key) {
          const url = key.url || key;
          return url.indexOf('.mp3') > -1;
        });
        
        const respuesta = {
          type: 'ESTADO_CACHE',
          total: keys.length,
          audios: audiosCacheados.length,
          archivos: ES_DESARROLLO ? keys.map(function(k) { return k.url; }) : [],
          version: APP_VERSION,
          timestamp: new Date().toISOString()
        };
        
        console.log('📊 SW: Estado cache - Total:', keys.length, 'Audios:', audiosCacheados.length);
        
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
    console.log('🔄 SW: Forzando actualización');
    self.skipWaiting();
    
    self.clients.claim()
      .then(function() {
        console.log('✅ SW: Actualización forzada completada');
        
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
        console.log('🗑️ SW: Cache limpiado:', CACHE_NAME);
        
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
              console.warn('⚠️ SW: Error actualizando', url, ':', err);
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
// BACKGROUND SYNC
// ==========================================
self.addEventListener('sync', function(event) {
  if (event.tag === 'sincronizar-pin') {
    console.log('🔄 SW: Sincronización background PIN');
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
            console.log('✅ SW: PIN sincronizado:', nuevoPIN);
            
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
      console.warn('⚠️ SW: Error sincronizando PIN:', err);
      return Promise.resolve();
    });
}

// ==========================================
// PUSH NOTIFICATIONS
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
// LOG INICIAL
// ==========================================
console.log('🔔 SW v' + APP_VERSION + ' cargado - ' + ARCHIVOS_CRITICOS.length + ' archivos a cachear');
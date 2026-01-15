// ==========================================
// SOLUCIÓN PARA REINICIOS INFINITOS
// ==========================================
function solucionarReiniciosInfinitos() {
  // 1. Verificar si hay un SW atascado
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      if (registrations.length > 0) {
        console.log('🔧 Registros SW encontrados:', registrations.length);
        
        // 2. Forzar actualización del SW
        registrations.forEach(registration => {
          registration.update();
          console.log('🔄 SW forzado a actualizar');
        });
        
        // 3. Si persiste el problema, desregistrar y recargar
        setTimeout(() => {
          if (performance.navigation.type === performance.navigation.TYPE_RELOAD) {
            console.log('⚠️ Posible bucle detectado - Limpiando SW');
            registrations.forEach(registration => {
              registration.unregister();
            });
            
            // Limpiar cache manualmente
            if ('caches' in window) {
              caches.keys().then(cacheNames => {
                cacheNames.forEach(cacheName => {
                  caches.delete(cacheName);
                });
              });
            }
            
            // Recargar después de limpiar
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }, 2000);
      }
    });
  }
}

// Llamar esta función al inicio
document.addEventListener('DOMContentLoaded', function() {
  // ... tu código existente ...
  
  // Agregar esto:
  setTimeout(solucionarReiniciosInfinitos, 1000);
});

// ==========================================
// CONFIGURACIÓN DE SEGURIDAD Y ESTADO
// ==========================================
let PIN_APP = "1234";               // PIN inicial por defecto
const CLAVE_MAESTRA = "santamaria"; // Clave solo para ADMIN
const URL_PIN_REMOTO = "https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt";
const URL_PDF_INSTRUCCIONES = "https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf";

let audioActual = null;             // Controla el sonido que suena
let esDispositivoApple = false;     // Detectar iPhone/iPad/Mac
let ultimaActualizacionPIN = null;  // Para sincronización remota
let esModoOffline = false;          // Controlar estado de conexión
let sesionAdminActiva = false;      // Controlar sesión admin activa
let servicioWorkerActivo = false;   // Estado del Service Worker
let recursosOfflineVerificados = false; // Si se verificaron los recursos

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔔 Campanas Parroquiales - Inicializando v2.0');
    
    // 1. Detectar dispositivo Apple
    esDispositivoApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
    console.log('Dispositivo Apple:', esDispositivoApple);
    
    // 2. Verificar y configurar Service Worker (PRIMERO)
    inicializarServiceWorker();
    
    // 3. Cargar PIN guardado localmente (si existe)
    cargarPINLocal();
    
    // 4. Sincronizar PIN remoto si hay internet (sin bloquear inicio)
    if (navigator.onLine) {
        setTimeout(sincronizarPIN, 500);
    }
    
    // 5. Configurar instalación PWA (sistema universal)
    configurarInstalacionPWAUniversal();
    
    // 6. Configurar eventos globales
    configurarEventosGlobales();
    
    // 7. Enfocar input automáticamente y ocultar asteriscos si existe
    setTimeout(() => {
        const pinInput = document.getElementById('pin-input');
        if (pinInput) {
            pinInput.focus();
            
            // Asegurar que el input sea visible (no password)
            if (pinInput.type === 'password') {
                pinInput.type = 'text';
            }
        }
    }, 300);
    
    // 8. Verificar recursos offline después de que cargue el SW
    setTimeout(verificarRecursosOffline, 2000);
    
    // 9. Verificar archivos de audio (solo en desarrollo)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(verificarArchivosAudio, 1000);
    }
});

// ==========================================
// SISTEMA DE SERVICE WORKER - OFFLINE COMPLETO
// ==========================================
function inicializarServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Intentar registrar el Service Worker
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker registrado con éxito:', registration.scope);
                servicioWorkerActivo = true;
                
                // Verificar si ya está controlando la página
                if (navigator.serviceWorker.controller) {
                    console.log('🎮 Service Worker está controlando la página');
                    servicioWorkerActivo = true;
                }
                
                // Escuchar mensajes del Service Worker
                navigator.serviceWorker.addEventListener('message', function(event) {
                    console.log('📨 Mensaje del Service Worker:', event.data);
                    
                    if (event.data.type === 'SW_ACTIVATED') {
                        console.log('🔄 Service Worker activado, versión:', event.data.version);
                        servicioWorkerActivo = true;
                        mostrarNotificacion('Aplicación lista para funcionar offline');
                    }
                    
                    if (event.data.type === 'PIN_ACTUALIZADO') {
                        console.log('📌 PIN actualizado en background:', event.data.pin);
                        PIN_APP = event.data.pin;
                        ultimaActualizacionPIN = event.data.fecha;
                        
                        // Guardar en localStorage
                        try {
                            localStorage.setItem('pinRemoto', event.data.pin);
                            localStorage.setItem('pinActualizado', event.data.fecha);
                        } catch (error) {
                            console.warn('Error guardando PIN actualizado:', error);
                        }
                        
                        mostrarNotificacion(`PIN actualizado a: ${event.data.pin}`);
                    }
                });
                
                // Monitorear estado del Service Worker
                registration.addEventListener('updatefound', function() {
                    const nuevoWorker = registration.installing;
                    console.log('🔄 Nuevo Service Worker encontrado:', nuevoWorker.state);
                    
                    nuevoWorker.addEventListener('statechange', function() {
                        console.log('📊 Estado del nuevo Service Worker:', this.state);
                        
                        if (this.state === 'activated') {
                            console.log('✨ Nuevo Service Worker activado');
                            mostrarNotificacion('Aplicación actualizada. Recargue para usar nuevas funciones.');
                        }
                    });
                });
            })
            .catch(function(error) {
                console.error('❌ Error registrando Service Worker:', error);
                servicioWorkerActivo = false;
                
                // Si falla el SW, activar modo offline básico
                activarModoOfflineBasico();
            });
    } else {
        console.warn('⚠️ Service Worker no soportado en este navegador');
        servicioWorkerActivo = false;
        activarModoOfflineBasico();
    }
}

function activarModoOfflineBasico() {
    console.log('📴 Activando modo offline básico');
    
    // Intentar cachear recursos manualmente
    const recursos = [
        'campana1.mp3',
        'campana2.mp3', 
        'campana3.mp3',
        'emergencia.mp3',
        'icon-192.png'
    ];
    
    recursos.forEach(recurso => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = recurso.endsWith('.mp3') ? 'audio' : 'image';
        link.href = recurso;
        document.head.appendChild(link);
    });
}

function verificarRecursosOffline() {
    if (!servicioWorkerActivo) {
        console.warn('⚠️ No se puede verificar recursos offline - Service Worker inactivo');
        return;
    }
    
    console.log('🔍 Verificando recursos cacheados...');
    
    // Crear un canal de mensajes
    const channel = new MessageChannel();
    
    // Configurar respuesta
    channel.port1.onmessage = function(event) {
        if (event.data.type === 'ESTADO_CACHE') {
            console.log('📊 Estado del cache:', event.data);
            
            const totalCacheado = event.data.total;
            const totalEsperado = 14; // Número de archivos que deberían estar cacheados
            
            if (totalCacheado >= totalEsperado) {
                console.log('✅ Recursos offline verificados correctamente');
                recursosOfflineVerificados = true;
                
                // Mostrar indicador visual si está en home screen
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    mostrarNotificacion('✅ Aplicación lista para uso offline');
                }
            } else {
                console.warn(`⚠️ Solo ${totalCacheado}/${totalEsperado} recursos en cache`);
                
                // Intentar recachear
                if (navigator.onLine) {
                    console.log('🔄 Intentando recachear recursos faltantes...');
                    recachearRecursosFaltantes();
                }
            }
        }
    };
    
    // Enviar mensaje al Service Worker
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
            { type: 'VERIFICAR_CACHE' },
            [channel.port2]
        );
    } else {
        console.warn('⚠️ Service Worker no está controlando la página');
    }
}

function recachearRecursosFaltantes() {
    // Forzar actualización del Service Worker
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'FORZAR_ACTUALIZACION'
        });
        
        // Recargar después de actualizar
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// ==========================================
// SISTEMA DE SINCRONIZACIÓN DE PIN REMOTO (ANTI-ROBO) - MEJORADO
// ==========================================
function cargarPINLocal() {
    try {
        const pinGuardado = localStorage.getItem('pinRemoto');
        if (pinGuardado && /^\d{4}$/.test(pinGuardado)) {
            PIN_APP = pinGuardado;
            const fechaActualizacion = localStorage.getItem('pinActualizado');
            console.log('📌 PIN cargado desde almacenamiento local:', PIN_APP, 
                       fechaActualizacion ? '(Actualizado: ' + fechaActualizacion + ')' : '');
            
            // También verificar en cache del Service Worker
            if ('caches' in window) {
                caches.match('/pin-remoto-cache')
                    .then(response => {
                        if (response) {
                            return response.json();
                        }
                        return null;
                    })
                    .then(data => {
                        if (data && data.pin && /^\d{4}$/.test(data.pin)) {
                            console.log('📌 PIN encontrado en cache del SW:', data.pin);
                            PIN_APP = data.pin;
                        }
                    })
                    .catch(error => console.log('No hay PIN en cache SW:', error));
            }
        }
    } catch (error) {
        console.warn('Error cargando PIN local:', error);
    }
}

async function sincronizarPIN() {
    // Si estamos offline y el SW está activo, usar cache
    if (!navigator.onLine && servicioWorkerActivo) {
        console.log('📡 Offline - usando PIN cacheado si existe');
        return cargarPINLocal();
    }
    
    // Solo intentar si hay internet
    if (!navigator.onLine) {
        console.log('🌐 Sin conexión - usando PIN local');
        esModoOffline = true;
        return;
    }
    
    esModoOffline = false;
    
    try {
        console.log('🔄 Sincronizando PIN remoto...');
        
        // Timeout de 5 segundos máximo
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Fetch con cache busting
        const respuesta = await fetch(URL_PIN_REMOTO + '?t=' + Date.now(), {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }
        
        const nuevoPIN = (await respuesta.text()).trim();
        
        // Validar que sea un PIN de 4 dígitos
        if (/^\d{4}$/.test(nuevoPIN)) {
            if (nuevoPIN !== PIN_APP) {
                PIN_APP = nuevoPIN;
                ultimaActualizacionPIN = new Date().toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                console.log('✅ PIN actualizado remotamente:', PIN_APP);
                
                // Guardar en localStorage para offline
                try {
                    localStorage.setItem('pinRemoto', PIN_APP);
                    localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
                } catch (error) {
                    console.warn('Error guardando PIN en localStorage:', error);
                }
                
                // Guardar también en cache del Service Worker
                if ('caches' in window) {
                    caches.open('campanas-pwav1')
                        .then(cache => {
                            cache.put(
                                new Request('/pin-remoto-cache'),
                                new Response(JSON.stringify({
                                    pin: nuevoPIN,
                                    fecha: new Date().toISOString()
                                }))
                            );
                            console.log('📦 PIN guardado en cache del SW');
                        })
                        .catch(error => console.warn('Error guardando PIN en cache:', error));
                }
                
                console.log('PIN actualizado remotamente a:', PIN_APP);
                mostrarNotificacion(`PIN actualizado a: ${PIN_APP}`);
                
            } else {
                console.log('📌 PIN ya está actualizado');
            }
        } else {
            console.warn('⚠️ PIN remoto no válido (debe ser 4 dígitos):', nuevoPIN);
        }
        
    } catch (error) {
        console.log('❌ Error sincronizando PIN:', error.name, error.message);
        esModoOffline = true;
        
        // Usar PIN guardado localmente si existe
        cargarPINLocal();
        
        // Intentar sincronización en background si el SW soporta sync
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'REGISTRAR_SYNC_PIN'
            });
        }
    }
}

// ==========================================
// INSTALACIÓN PWA UNIVERSAL (20+ AÑOS) - MEJORADA
// ==========================================
function configurarInstalacionPWAUniversal() {
    console.log('🔧 Configurando sistema de instalación universal v2.0');
    
    // Detectar si ya está instalada
    const yaInstalada = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
    
    if (yaInstalada) {
        console.log('🏠 PWA ya instalada');
        
        // Ocultar botones de instalación inmediatamente
        ocultarBotonesInstalacion();
        
        // Mostrar notificación de bienvenida
        setTimeout(() => {
            mostrarNotificacion('Aplicación instalada - Lista para uso offline');
        }, 1000);
        
        return;
    }
    
    // Configurar botones después de que cargue la página
    setTimeout(() => {
        const installButton = document.getElementById('install-button');
        const installLoginButton = document.getElementById('install-login-button');
        
        if (installButton) {
            installButton.onclick = manejarInstalacionPWA;
            installButton.style.display = 'block';
            console.log('✅ Botón instalación principal configurado');
        }
        
        if (installLoginButton) {
            installLoginButton.onclick = manejarInstalacionPWA;
            installLoginButton.style.display = 'block';
            console.log('✅ Botón instalación login configurado');
        }
        
    }, 1500);
    
    // Manejar beforeinstallprompt para Chrome/Edge
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📱 Evento beforeinstallprompt capturado');
        e.preventDefault();
        deferredPrompt = e;
        
        // Mostrar botón de instalación nativo si está disponible
        mostrarBotonInstalacionNativo();
    });
    
    // Detectar cuando se instala
    window.addEventListener('appinstalled', (evt) => {
        console.log('✅ PWA instalada exitosamente');
        ocultarBotonesInstalacion();
        mostrarNotificacion('¡Aplicación instalada! Ya puede usarla offline.');
    });
}

function manejarInstalacionPWA() {
    // Primero verificar que tenemos recursos offline
    if (!recursosOfflineVerificados && servicioWorkerActivo) {
        verificarRecursosOffline();
        
        const confirmar = confirm(
            'Antes de instalar, necesitamos verificar que todos los recursos estén disponibles offline.\n\n' +
            '¿Desea continuar con la verificación?'
        );
        
        if (!confirmar) return;
    }
    
    // Mostrar instrucciones universales
    mostrarInstruccionesInstalacionUniversal();
}

function mostrarBotonInstalacionNativo() {
    // Solo para navegadores que soportan beforeinstallprompt
    const installButton = document.getElementById('install-button');
    const installLoginButton = document.getElementById('install-login-button');
    
    if (installButton) {
        installButton.textContent = '📲 INSTALAR APLICACIÓN (NATIVO)';
        installButton.style.background = 'linear-gradient(180deg, #2AA952 0%, #1E7E34 100%)';
    }
    
    if (installLoginButton) {
        installLoginButton.textContent = '📲 INSTALAR APLICACIÓN (NATIVO)';
        installLoginButton.style.background = 'linear-gradient(180deg, #2AA952 0%, #1E7E34 100%)';
    }
}

function mostrarInstruccionesInstalacionUniversal() {
    const instrucciones = 
`📱 COMO INSTALAR ESTA APLICACIÓN:

ESTA APP SE PUEDE INSTALAR en su teléfono como una aplicación normal.

✅ VENTAJAS DE INSTALAR:
• Funciona 100% SIN INTERNET
• Ícono en pantalla principal
• Se abre como app independiente
• Más rápido que navegador

PARA INSTALAR:

1. Busque el BOTÓN DE MENÚ en su navegador:
   • Chrome Android: 3 puntos verticales (arriba derecha)
   • Safari iPhone: Cuadrado con flecha (📤 abajo centro)
   • Samsung Internet: 3 líneas horizontales (≡ abajo derecha)

2. En el menú, busque y toque:
   ⭐ "AGREGAR A PANTALLA DE INICIO"
   o "INSTALAR APLICACIÓN"

3. Confirme la instalación cuando se lo pidan.

🔄 La aplicación descargará todos los recursos para funcionar offline.

✅ LISTO: Tendrá su propio ícono en la pantalla principal.
`;

    // Crear modal de instrucciones
    const modalHTML = `
        <div class="modal-overlay" id="install-modal" style="display: flex;">
            <div class="modal-content">
                <div class="drag-handle"></div>
                <h3 class="modal-title">📱 INSTALAR APLICACIÓN</h3>
                <div style="max-height: 300px; overflow-y: auto; margin: 15px 0; text-align: left;">
                    ${instrucciones.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                </div>
                <button class="main-btn" onclick="cerrarModalInstalacion()">ENTENDIDO</button>
                <button class="outline-btn" onclick="verificarRecursosOffline()" style="margin-top: 10px;">
                    🔍 VERIFICAR RECURSOS OFFLINE
                </button>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);
}

function cerrarModalInstalacion() {
    const modal = document.getElementById('install-modal');
    if (modal) {
        modal.remove();
    }
}

function verificarSiYaInstalada() {
    const yaInstalada = 
        window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        document.referrer.includes('android-app://') ||
        (window.location.search.includes('source=pwa') && window.history.length === 1);
    
    if (yaInstalada) {
        console.log('🏠 PWA ya instalada - ocultando botones');
        ocultarBotonesInstalacion();
    }
}

function ocultarBotonesInstalacion() {
    const elementos = [
        'install-container',
        'install-advice',
        'install-button',
        'install-login-button'
    ];
    
    elementos.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.display = 'none';
            console.log(`✅ Ocultado: #${id}`);
        }
    });
}

// ==========================================
// CONFIGURACIÓN DE EVENTOS GLOBALES - MEJORADA
// ==========================================
function configurarEventosGlobales() {
    // 1. Cerrar modal al tocar fuera
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarAyuda();
            }
        });
    }
    
    // 2. Sincronizar PIN cuando vuelve la conexión
    window.addEventListener('online', () => {
        console.log('🌐 Conexión restaurada');
        esModoOffline = false;
        mostrarNotificacion('Conexión a internet restaurada');
        
        // Sincronizar PIN y verificar actualizaciones
        setTimeout(sincronizarPIN, 1000);
        
        // Verificar actualizaciones del Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    reg.update();
                    console.log('🔄 Service Worker actualización verificada');
                }
            });
        }
    });
    
    // 3. Detectar cuando se pierde conexión
    window.addEventListener('offline', () => {
        console.log('⚠️ Sin conexión a internet');
        esModoOffline = true;
        
        // Solo mostrar notificación si está instalada
        if (window.matchMedia('(display-mode: standalone)').matches) {
            mostrarNotificacion('Modo offline activado - La aplicación sigue funcionando');
        }
    });
    
    // 4. Manejar errores globales (silenciosamente)
    window.addEventListener('error', function(e) {
        console.error('⚠️ Error global capturado:', e.message, 'en', e.filename, 'línea', e.lineno);
        
        // Intentar recuperación para errores críticos
        if (e.message.includes('audio') || e.message.includes('Audio')) {
            console.log('🔧 Intentando recuperar sistema de audio...');
            detenerSonido();
        }
    });
    
    // 5. Prevenir cierre con audio reproduciéndose
    window.addEventListener('beforeunload', function(e) {
        if (audioActual && !audioActual.paused) {
            detenerSonido();
        }
    });
    
    // 6. Manejar botón Enter en input PIN
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verificarAcceso();
            }
        });
    }
    
    // 7. Manejar visibilidad de página para ahorrar batería
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && audioActual) {
            console.log('📱 Página oculta - pausando audio si está reproduciendo');
            if (!audioActual.paused) {
                audioActual.pause();
                // Guardar posición para reanudar
                audioActual.dataset.lastPosition = audioActual.currentTime;
            }
        }
    });
}

// ==========================================
// VALIDACIÓN DE INPUT PIN (VISIBLE para personas mayores)
// ==========================================
function validarPinInput(input) {
    // Solo permitir números
    input.value = input.value.replace(/[^0-9]/g, '');
    
    // Limitar a 4 dígitos
    if (input.value.length > 4) {
        input.value = input.value.slice(0, 4);
    }
    
    // Asegurar que el input sea visible (no password)
    if (input.type === 'password') {
        input.type = 'text';
    }
    
    // Cambiar estilo cuando esté completo
    if (input.value.length === 4) {
        input.style.borderColor = '#10B981';
        input.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.2)';
        input.classList.remove('error');
        
        // Auto-enviar si está en modo standalone (para mayor comodidad)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setTimeout(() => verificarAcceso(), 300);
        }
    } else {
        input.style.borderColor = '#8B7355';
        input.style.boxShadow = 'none';
        input.classList.remove('error');
    }
}

// ==========================================
// VERIFICACIÓN DE ACCESO (SIMPLE) - MEJORADA
// ==========================================
function verificarAcceso() {
    const pinInput = document.getElementById('pin-input');
    
    if (!pinInput) {
        mostrarNotificacion("Error del sistema. Recargue la página.");
        return;
    }
    
    const entradaPin = pinInput.value;
    
    // Validar que tenga 4 dígitos
    if (entradaPin.length !== 4) {
        mostrarNotificacion("El PIN debe tener 4 dígitos");
        pinInput.focus();
        return;
    }
    
    if (entradaPin === PIN_APP) {
        // ✅ Acceso concedido
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('home-screen').classList.remove('hidden');
        
        // Limpiar input
        pinInput.value = '';
        pinInput.style.borderColor = '#8B7355';
        pinInput.style.boxShadow = 'none';
        pinInput.classList.remove('error');
        
        // Sincronizar PIN si hay internet
        if (navigator.onLine && !esModoOffline) {
            setTimeout(sincronizarPIN, 500);
        }
        
        console.log('✅ Acceso concedido');
        
        // Mostrar estado offline si aplica
        if (esModoOffline && servicioWorkerActivo) {
            mostrarNotificacion('Modo offline activado - Funcionando sin internet');
        }
        
    } else {
        // ❌ PIN incorrecto
        mostrarNotificacion("PIN Incorrecto. Intente de nuevo.");
        
        // Efecto de vibración (si soportado)
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        // Resaltar error
        pinInput.classList.add('error');
        pinInput.style.borderColor = '#EF4444';
        pinInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        
        // Limpiar y enfocar
        pinInput.value = '';
        setTimeout(() => {
            pinInput.focus();
            pinInput.classList.remove('error');
            pinInput.style.borderColor = '#8B7355';
            pinInput.style.boxShadow = 'none';
        }, 100);
        
        console.log('❌ Acceso denegado - PIN incorrecto');
    }
}

// ==========================================
// SISTEMA DE AUDIO SIMPLIFICADO Y ROBUSTO - MEJORADO
// ==========================================
function playAudio(archivo) {
    if (!archivo || typeof archivo !== 'string') {
        console.error('❌ Nombre de archivo inválido');
        mostrarNotificacion('Error: Archivo de audio no válido');
        return;
    }
    
    detenerSonido();
    
    try {
        audioActual = new Audio(archivo);
        
        // Pre-cargar para mejor respuesta
        audioActual.preload = 'auto';
        audioActual.load();
        
        audioActual.oncanplaythrough = function() {
            console.log('✅ Audio listo:', archivo);
        };
        
        audioActual.onerror = function(e) {
            console.error('❌ Error cargando audio:', archivo, e);
            mostrarNotificacion('Error reproduciendo audio');
            detenerSonido();
            
            // Intentar cargar desde cache si falla
            if ('caches' in window && servicioWorkerActivo) {
                console.log('🔄 Intentando cargar audio desde cache...');
                cargarAudioDesdeCache(archivo);
            }
        };
        
        audioActual.onended = function() {
            console.log('⏹️ Audio terminado:', archivo);
            detenerSonido();
        };
        
        // Manejar interrupciones en iOS
        if (esDispositivoApple) {
            document.body.addEventListener('touchstart', function activarAudioIOS() {
                // iOS requiere gesto de usuario
                const promesaReproduccion = audioActual.play();
                if (promesaReproduccion !== undefined) {
                    promesaReproduccion
                        .then(() => {
                            console.log('🔊 Reproduciendo en iOS:', archivo);
                            document.body.removeEventListener('touchstart', activarAudioIOS);
                        })
                        .catch(error => {
                            console.warn('⚠️ Error reproduciendo en iOS:', error);
                        });
                }
            }, { once: true });
            
            return; // iOS manejará la reproducción con el gesto
        }
        
        // Para otros dispositivos, reproducir inmediatamente
        const promesaReproduccion = audioActual.play();
        
        if (promesaReproduccion !== undefined) {
            promesaReproduccion
                .then(() => {
                    console.log('🔊 Reproduciendo:', archivo);
                })
                .catch(error => {
                    console.warn('⚠️ Error reproduciendo:', archivo, error);
                    
                    if (error.name === 'NotAllowedError') {
                        mostrarNotificacion('Haga clic en la pantalla para activar el audio');
                    }
                    
                    detenerSonido();
                });
        }
        
    } catch (error) {
        console.error('❌ Error crítico en audio:', error);
        detenerSonido();
    }
}

function cargarAudioDesdeCache(archivo) {
    if ('caches' in window) {
        caches.match(archivo)
            .then(response => {
                if (response) {
                    console.log('🎵 Cargando audio desde cache:', archivo);
                    const audioURL = URL.createObjectURL(response.blob());
                    playAudio(audioURL);
                }
            })
            .catch(error => console.log('Audio no encontrado en cache:', error));
    }
}

function confirmarEmergencia() {
    if (confirm("🚨 ¿ESTÁ SEGURO DE ACTIVAR LA ALARMA DE EMERGENCIA?\n\nEsta acción hará sonar la alarma máxima.")) {
        playAudio('emergencia.mp3');
    }
}

function detenerSonido() {
    if (audioActual) {
        try {
            audioActual.pause();
            audioActual.currentTime = 0;
            audioActual.src = '';
            audioActual = null;
            
            console.log('⏹️ Sonido detenido');
            
        } catch (error) {
            console.warn('Advertencia al detener sonido:', error);
        }
    }
}

// ==========================================
// NAVEGACIÓN ENTRE PANTALLAS
// ==========================================
function mostrarInstruccionesBluetooth() {
    const mensaje = 
`📡 CONEXIÓN BLUETOOTH:

Para conectar con el módulo Bluetooth (1Mii o similar):

1. Encienda el módulo Bluetooth
2. Vaya a Configuración → Bluetooth en su celular
3. Busque dispositivos disponibles
4. Conéctese al módulo (parear)

✅ Después de parear una vez, se conectará automáticamente.

⚠️ IMPORTANTE:
• Asegúrese que el módulo esté encendido
• Mantenga el celular cerca del módulo
• Si no aparece, reinicie ambos dispositivos

💡 CONSEJO: Use esta app en modo instalado (como aplicación) para mejor estabilidad.`;

    alert(mensaje);
}

function intentarConfiguracion() {
    // Si ya hay sesión admin activa, ir directamente
    if (sesionAdminActiva) {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        return;
    }
    
    const password = prompt("🔐 Ingrese Clave Maestra para CONFIGURACIÓN ADMIN:");
    if (password === CLAVE_MAESTRA) {
        sesionAdminActiva = true;
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        
    } else if (password !== null) {
        alert("Clave maestra incorrecta.");
    }
}

function irAHome() {
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
}

function cambiarPinApp() {
    // Verificar sesión admin
    if (!sesionAdminActiva) {
        const password = prompt("🔐 Ingrese Clave Maestra para cambiar PIN:");
        if (password !== CLAVE_MAESTRA) {
            alert("Clave incorrecta");
            return;
        }
        sesionAdminActiva = true;
    }
    
    const nuevoPIN = prompt("Nuevo PIN global (4 dígitos):");
    if (!nuevoPIN || !/^\d{4}$/.test(nuevoPIN)) {
        alert("PIN debe ser 4 dígitos numéricos");
        return;
    }
    
    PIN_APP = nuevoPIN;
    ultimaActualizacionPIN = new Date().toLocaleString('es-ES');
    
    try {
        localStorage.setItem('pinRemoto', nuevoPIN);
        localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
    } catch (error) {
        console.warn('Error guardando PIN en localStorage:', error);
    }
    
    alert(`✅ PIN cambiado exitosamente a: ${nuevoPIN}\n\n📝 Nota: Para efecto global en todos los dispositivos, actualice también el archivo remoto:\n${URL_PIN_REMOTO}\n\nLos dispositivos se actualizarán automáticamente al conectarse a internet.`);
}

// ==========================================
// SISTEMA DE AYUDA Y MODAL - MEJORADO
// ==========================================
function abrirAyuda() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        const qrImg = modal.querySelector('.qr-img');
        if (qrImg) {
            qrImg.onerror = function() {
                console.warn('❌ QR no encontrado');
                this.alt = 'QR no disponible - Contacte al administrador';
                this.style.border = '2px dashed #ccc';
                this.src = 'icon-192.png'; // Fallback a icono
            };
        }
    }
}

function cerrarAyuda() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function abrirPDF() {
    // Verificar si estamos offline
    if (!navigator.onLine) {
        alert('📴 Modo offline activado\n\nEl PDF de instrucciones requiere conexión a internet.\n\nPor favor, conéctese a internet para acceder al manual completo.');
        return;
    }
    
    // Abrir PDF en nueva pestaña
    window.open(URL_PDF_INSTRUCCIONES, '_blank', 'noopener,noreferrer');
}

// ==========================================
// FUNCIONES DE VERIFICACIÓN Y UTILIDADES
// ==========================================
function verificarArchivosAudio() {
    console.log('🔍 Verificando archivos de audio...');
    
    const archivos = ['campana1.mp3', 'campana2.mp3', 'campana3.mp3', 'emergencia.mp3'];
    let archivosFaltantes = [];
    
    archivos.forEach(archivo => {
        const audio = new Audio();
        
        audio.onerror = () => {
            console.warn(`❌ Archivo no encontrado: ${archivo}`);
            archivosFaltantes.push(archivo);
        };
        
        audio.oncanplaythrough = () => {
            console.log(`✅ ${archivo} encontrado`);
        };
        
        audio.src = archivo;
        audio.load();
    });
    
    setTimeout(() => {
        if (archivosFaltantes.length > 0) {
            console.warn(`⚠️ ${archivosFaltantes.length} archivo(s) de audio faltan:`, archivosFaltantes);
            
            // Intentar descargar si estamos online
            if (navigator.onLine) {
                console.log('🔄 Intentando descargar archivos faltantes...');
                descargarArchivosFaltantes(archivosFaltantes);
            }
        } else {
            console.log('✅ Todos los archivos de audio están presentes');
        }
    }, 3000);
}

function descargarArchivosFaltantes(archivos) {
    // Esta función intentaría descargar archivos faltantes
    // En una implementación real, se comunicaría con el servidor
    console.log('Simulando descarga de archivos faltantes:', archivos);
}

function mostrarNotificacion(mensaje) {
    console.log('💬 Notificación:', mensaje);
    
    // Crear notificación simple
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        z-index: 9999;
        font-size: 14px;
        max-width: 80%;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: fadeInOut 3s ease;
    `;
    
    // Añadir animación CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            90% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);
    
    // Auto-eliminar después de 3 segundos
    setTimeout(() => {
        if (notificacion.parentNode) {
            notificacion.parentNode.removeChild(notificacion);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 3000);
}

// ==========================================
// CERRAR SESIÓN
// ==========================================
function cerrarSesion() {
    detenerSonido();
    
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Limpiar input PIN
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.value = '';
        pinInput.style.borderColor = '#8B7355';
        pinInput.style.boxShadow = 'none';
        pinInput.classList.remove('error');
        
        // Enfocar después de un breve delay
        setTimeout(() => {
            pinInput.focus();
        }, 300);
    }
    
    // Resetear sesión admin al cerrar sesión
    sesionAdminActiva = false;
    
    console.log('👋 Sesión cerrada');
    mostrarNotificacion('Sesión cerrada');
}

// ==========================================
// POLYFILLS Y COMPATIBILIDAD MÁXIMA
// ==========================================
if (typeof console === 'undefined') {
    window.console = {
        log: function() {},
        warn: function() {},
        error: function() {}
    };
}

if (typeof localStorage === 'undefined') {
    console.warn('⚠️ localStorage no disponible - usando objeto temporal');
    window.localStorage = {
        _data: {},
        setItem: function(key, value) {
            this._data[key] = String(value);
        },
        getItem: function(key) {
            return this._data.hasOwnProperty(key) ? this._data[key] : null;
        },
        removeItem: function(key) {
            delete this._data[key];
        },
        clear: function() {
            this._data = {};
        }
    };
}

// Polyfill para requestIdleCallback
if (!window.requestIdleCallback) {
    window.requestIdleCallback = function(callback) {
        return setTimeout(function() {
            callback({
                didTimeout: false,
                timeRemaining: function() {
                    return 50;
                }
            });
        }, 1);
    };
}

if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function(id) {
        clearTimeout(id);
    };
}

// ==========================================
// EXPORTAR FUNCIONES PARA HTML
// ==========================================
window.validarPinInput = validarPinInput;
window.verificarAcceso = verificarAcceso;
window.playAudio = playAudio;
window.confirmarEmergencia = confirmarEmergencia;
window.detenerSonido = detenerSonido;
window.mostrarInstruccionesBluetooth = mostrarInstruccionesBluetooth;
window.intentarConfiguracion = intentarConfiguracion;
window.irAHome = irAHome;
window.cambiarPinApp = cambiarPinApp;
window.abrirAyuda = abrirAyuda;
window.cerrarAyuda = cerrarAyuda;
window.abrirPDF = abrirPDF;
window.cerrarSesion = cerrarSesion;
window.cerrarModalInstalacion = cerrarModalInstalacion;
window.verificarRecursosOffline = verificarRecursosOffline;

console.log('✅ app.js v2.0 cargado completamente - Sistema listo para 20+ años');

// ==========================================
// AUTO-VERIFICACIÓN DE ACTUALIZACIONES
// ==========================================
// Verificar actualizaciones periódicamente
setInterval(() => {
    if (navigator.onLine && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update();
                console.log('🔄 Verificación periódica de actualizaciones');
            }
        });
    }
}, 1000 * 60 * 60 * 4); // Cada 4 horas

// Verificar al volver a la aplicación
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && navigator.onLine) {
        // La aplicación volvió a estar visible y hay internet
        setTimeout(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) {
                        reg.update();
                    }
                });
            }
        }, 1000);
    }
});
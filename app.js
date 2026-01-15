// ==========================================
// CONFIGURACIÓN DE SEGURIDAD Y ESTADO
// ==========================================
let PIN_APP = "1234";               // PIN inicial por defecto
const CLAVE_MAESTRA = "santamaria"; // Clave solo para ADMIN
const URLS_PIN_REMOTO = [
    "https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt",
    "https://tudominio.com/pin-actual.txt", // TU PROPIO DOMINIO SI TIENES
];
const URL_PDF_INSTRUCCIONES = "https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf";

let audioActual = null;             // Controla el sonido que suena
let esDispositivoApple = false;     // Detectar iPhone/iPad/Mac
let ultimaActualizacionPIN = null;  // Para sincronización remota
let esModoOffline = false;          // Controlar estado de conexión
let sesionAdminActiva = false;      // Controlar sesión admin activa
let servicioWorkerActivo = false;   // Estado del Service Worker
let recursosOfflineVerificados = false; // Si se verificaron los recursos

// Versión de la aplicación para migración de datos
const VERSION_APP = '1.0.0';

// Modo desarrollo/producción
const ES_DESARROLLO = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

// Sistema de logging optimizado para producción
const log = ES_DESARROLLO ? console.log : () => {};
const warn = ES_DESARROLLO ? console.warn : () => {};
const error = ES_DESARROLLO ? console.error : () => {};

// ==========================================
// BLUETOOTH - CONEXIÓN REAL
// ==========================================
async function conectarBluetooth() {
    try {
        // Verificar si Web Bluetooth está disponible
        if (!navigator.bluetooth) {
            mostrarNotificacion('⚠️ Bluetooth no disponible en este navegador');
            
            // Mostrar instrucciones alternativas
            mostrarAlert(
                'Bluetooth no soportado en este navegador.\n\n' +
                'Usa Chrome/Edge en Android o Safari en iOS 13+.\n\n' +
                'Alternativa: Configura Bluetooth manualmente en ' +
                'Ajustes → Bluetooth y conéctate al dispositivo "Campanas".'
            );
            return false;
        }
        
        log('📡 Solicitando dispositivo Bluetooth...');
        
        // Solicitar dispositivo Bluetooth
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'Campanas' }],
            optionalServices: ['battery_service', 'device_information']
        });
        
        log('🔌 Conectando dispositivo Bluetooth:', device.name);
        
        // Conectar
        const server = await device.gatt.connect();
        
        // Guardar referencia
        window.bluetoothDevice = device;
        window.bluetoothServer = server;
        
        // Configurar desconexión automática
        device.addEventListener('gattserverdisconnected', () => {
            log('📡 Dispositivo Bluetooth desconectado');
            mostrarNotificacion('Dispositivo Bluetooth desconectado');
        });
        
        mostrarNotificacion('✅ Bluetooth conectado a ' + device.name);
        return true;
    } catch (err) {
        error('❌ Error Bluetooth:', err);
        
        if (err.name === 'NotFoundError') {
            mostrarAlert(
                'Dispositivo Bluetooth no encontrado.\n\n' +
                'Asegúrate de:\n' +
                '1. El módulo Bluetooth está ENCENDIDO\n' +
                '2. Está cerca de tu celular\n' +
                '3. Se llama "Campanas" o es visible\n' +
                '4. Bluetooth está activado en tu celular'
            );
        } else if (err.name === 'SecurityError') {
            mostrarAlert('Se necesita permiso para usar Bluetooth');
        } else if (err.name === 'NetworkError') {
            mostrarAlert('Error de red Bluetooth. Reintenta.');
        } else {
            mostrarAlert('Error Bluetooth: ' + err.message);
        }
        return false;
    }
}

// Añadir a window para que HTML pueda llamarlo
window.conectarBluetooth = conectarBluetooth;

// Verificar soporte Web Bluetooth al inicio
function verificarSoporteBluetooth() {
    if (!navigator.bluetooth) {
        log('⚠️ Web Bluetooth API no disponible');
        
        // Ocultar botón Bluetooth si no hay soporte
        setTimeout(() => {
            const btBtn = document.getElementById('bluetooth-help-btn');
            if (btBtn) {
                btBtn.style.display = 'none';
                log('Botón Bluetooth ocultado por falta de soporte');
            }
        }, 1000);
        
        return false;
    }
    
    log('✅ Web Bluetooth API disponible');
    return true;
}

// ==========================================
// MODALES PERSONALIZADOS (para reemplazar alert/prompt)
// ==========================================
function mostrarAlert(mensaje) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert');
        const mensajeElem = document.getElementById('alert-message');
        
        if (!modal || !mensajeElem) {
            // Fallback a alert nativo si no hay modal
            alert(mensaje);
            resolve();
            return;
        }
        
        mensajeElem.textContent = mensaje;
        modal.classList.remove('hidden');
        
        // Configurar botón OK
        window.cerrarAlert = function() {
            modal.classList.add('hidden');
            resolve();
        };
    });
}

function mostrarPrompt(pregunta, valorPredeterminado = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-prompt');
        const mensajeElem = document.getElementById('prompt-message');
        const inputElem = document.getElementById('prompt-input');
        
        if (!modal || !mensajeElem || !inputElem) {
            // Fallback a prompt nativo si no hay modal
            const resultado = prompt(pregunta, valorPredeterminado);
            resolve(resultado);
            return;
        }
        
        mensajeElem.textContent = pregunta;
        inputElem.value = valorPredeterminado;
        inputElem.focus();
        modal.classList.remove('hidden');
        
        // Configurar botones
        window.confirmarPrompt = function() {
            modal.classList.add('hidden');
            resolve(inputElem.value);
        };
        
        window.cancelarPrompt = function() {
            modal.classList.add('hidden');
            resolve(null);
        };
        
        // Permitir Enter para confirmar
        inputElem.onkeypress = function(e) {
            if (e.key === 'Enter') {
                confirmarPrompt();
            }
        };
    });
}

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    log('🔔 Campanas Parroquiales - Inicializando v2.0');
    
    // 1. Verificar y migrar datos si es necesario
    verificarMigracionDatos();
    
    // 2. Detectar dispositivo Apple
    esDispositivoApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
    log('Dispositivo Apple:', esDispositivoApple);
    
    // 3. Verificar soporte Bluetooth
    verificarSoporteBluetooth();
    
    // 4. Verificar y configurar Service Worker (PRIMERO)
    inicializarServiceWorker();
    
    // 5. Cargar PIN guardado localmente (si existe)
    cargarPINLocal();
    
    // 6. Sincronizar PIN remoto si hay internet (sin bloquear inicio)
    if (navigator.onLine) {
        setTimeout(sincronizarPIN, 500);
    }
    
    // 7. Configurar instalación PWA (sistema universal)
    configurarInstalacionPWAUniversal();
    
    // 8. Configurar eventos globales
    configurarEventosGlobales();
    
    // 9. Enfocar input automáticamente y ocultar asteriscos si existe
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
    
    // 10. Verificar recursos offline después de que cargue el SW
    setTimeout(verificarRecursosOffline, 2000);
    
    // 11. Verificar archivos de audio (solo en desarrollo)
    if (ES_DESARROLLO) {
        setTimeout(verificarArchivosAudio, 1000);
    }
});

// ==========================================
// SISTEMA DE MIGRACIÓN DE DATOS
// ==========================================
function verificarMigracionDatos() {
    const versionAnterior = localStorage.getItem('app_version');
    
    if (!versionAnterior) {
        // Primera instalación
        log('Primera instalación de la aplicación');
        localStorage.setItem('app_version', VERSION_APP);
        return;
    }
    
    if (versionAnterior !== VERSION_APP) {
        log(`Migrando datos de ${versionAnterior} a ${VERSION_APP}`);
        
        // Aquí lógica de migración si cambia estructura de datos
        migrarDatosVersion(versionAnterior, VERSION_APP);
        
        localStorage.setItem('app_version', VERSION_APP);
    }
}

function migrarDatosVersion(versionAnterior, versionNueva) {
    try {
        log(`Migración ${versionAnterior} → ${versionNueva}`);
        
        // Ejemplo: Si cambiamos estructura de almacenamiento
        const pinViejo = localStorage.getItem('pinRemoto');
        if (pinViejo && !localStorage.getItem('pin_remoto_backup')) {
            localStorage.setItem('pin_remoto_backup', pinViejo);
            log('PIN respaldado para migración');
        }
        
        // Limpiar cache antiguo si existe
        if (versionAnterior.startsWith('0.')) {
            log('Limpiando datos de versión beta');
            // Ejemplo: limpiar cache antiguo
        }
        
    } catch (err) {
        error('Error en migración de datos:', err);
    }
}

// ==========================================
// SISTEMA DE SERVICE WORKER - OFFLINE COMPLETO
// ==========================================
function inicializarServiceWorker() {
    if ('serviceWorker' in navigator) {
        // Intentar registrar el Service Worker
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                log('✅ Service Worker registrado con éxito:', registration.scope);
                servicioWorkerActivo = true;
                
                // Verificar si ya está controlando la página
                if (navigator.serviceWorker.controller) {
                    log('🎮 Service Worker está controlando la página');
                    servicioWorkerActivo = true;
                }
                
                // Escuchar mensajes del Service Worker
                navigator.serviceWorker.addEventListener('message', function(event) {
                    log('📨 Mensaje del Service Worker:', event.data);
                    
                    if (event.data.type === 'SW_ACTIVATED') {
                        log('🔄 Service Worker activado, versión:', event.data.version);
                        servicioWorkerActivo = true;
                        mostrarNotificacion('Aplicación lista para funcionar offline');
                    }
                    
                    if (event.data.type === 'PIN_ACTUALIZADO') {
                        log('📌 PIN actualizado en background:', event.data.pin);
                        PIN_APP = event.data.pin;
                        ultimaActualizacionPIN = event.data.fecha;
                        
                        // Guardar en localStorage
                        try {
                            localStorage.setItem('pinRemoto', event.data.pin);
                            localStorage.setItem('pinActualizado', event.data.fecha);
                        } catch (error) {
                            warn('Error guardando PIN actualizado:', error);
                        }
                        
                        mostrarNotificacion(`PIN actualizado a: ${event.data.pin}`);
                    }
                });
                
                // Monitorear estado del Service Worker
                registration.addEventListener('updatefound', function() {
                    const nuevoWorker = registration.installing;
                    log('🔄 Nuevo Service Worker encontrado:', nuevoWorker.state);
                    
                    nuevoWorker.addEventListener('statechange', function() {
                        log('📊 Estado del nuevo Service Worker:', this.state);
                        
                        if (this.state === 'activated') {
                            log('✨ Nuevo Service Worker activado');
                            mostrarNotificacion('Aplicación actualizada. Recargue para usar nuevas funciones.');
                        }
                    });
                });
            })
            .catch(function(err) {
                error('❌ Error registrando Service Worker:', err);
                servicioWorkerActivo = false;
                
                // Si falla el SW, activar modo offline básico
                activarModoOfflineBasico();
            });
    } else {
        warn('⚠️ Service Worker no soportado en este navegador');
        servicioWorkerActivo = false;
        activarModoOfflineBasico();
    }
}

function activarModoOfflineBasico() {
    log('📴 Activando modo offline básico');
    
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
        warn('⚠️ No se puede verificar recursos offline - Service Worker inactivo');
        return;
    }
    
    log('🔍 Verificando recursos cacheados...');
    
    // Crear un canal de mensajes
    const channel = new MessageChannel();
    
    // Configurar respuesta
    channel.port1.onmessage = function(event) {
        if (event.data.type === 'ESTADO_CACHE') {
            log('📊 Estado del cache:', event.data);
            
            const totalCacheado = event.data.total;
            const totalEsperado = 14; // Número de archivos que deberían estar cacheados
            
            if (totalCacheado >= totalEsperado) {
                log('✅ Recursos offline verificados correctamente');
                recursosOfflineVerificados = true;
                
                // Mostrar indicador visual si está en home screen
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    mostrarNotificacion('✅ Aplicación lista para uso offline');
                }
            } else {
                warn(`⚠️ Solo ${totalCacheado}/${totalEsperado} recursos en cache`);
                
                // Intentar recachear
                if (navigator.onLine) {
                    log('🔄 Intentando recachear recursos faltantes...');
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
        warn('⚠️ Service Worker no está controlando la página');
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
            log('📌 PIN cargado desde almacenamiento local:', PIN_APP, 
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
                            log('📌 PIN encontrado en cache del SW:', data.pin);
                            PIN_APP = data.pin;
                        }
                    })
                    .catch(err => log('No hay PIN en cache SW:', err));
            }
        }
    } catch (err) {
        warn('Error cargando PIN local:', err);
    }
}

async function sincronizarPIN() {
    // Si estamos offline y el SW está activo, usar cache
    if (!navigator.onLine && servicioWorkerActivo) {
        log('📡 Offline - usando PIN cacheado si existe');
        return cargarPINLocal();
    }
    
    // Solo intentar si hay internet
    if (!navigator.onLine) {
        log('🌐 Sin conexión - usando PIN local');
        esModoOffline = true;
        return;
    }
    
    esModoOffline = false;
    
    let exito = false;
    
    // Intentar cada URL de la lista
    for (const url of URLS_PIN_REMOTO) {
        try {
            log(`🔄 Intentando sincronizar PIN desde: ${url}`);
            
            // Timeout de 5 segundos máximo
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            // Fetch con cache busting
            const respuesta = await fetch(url + '?t=' + Date.now(), {
                signal: controller.signal,
                cache: 'no-store'
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
                    
                    log('✅ PIN actualizado remotamente:', PIN_APP);
                    
                    // Guardar en localStorage para offline
                    try {
                        localStorage.setItem('pinRemoto', PIN_APP);
                        localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
                    } catch (err) {
                        warn('Error guardando PIN en localStorage:', err);
                    }
                    
                    // Guardar también en cache del Service Worker
                    if ('caches' in window) {
                        caches.open('campanas-pwa-v' + VERSION_APP)
                            .then(cache => {
                                cache.put(
                                    new Request('/pin-remoto-cache'),
                                    new Response(JSON.stringify({
                                        pin: nuevoPIN,
                                        fecha: new Date().toISOString()
                                    }))
                                );
                                log('📦 PIN guardado en cache del SW');
                            })
                            .catch(err => warn('Error guardando PIN en cache:', err));
                    }
                    
                    log('PIN actualizado remotamente a:', PIN_APP);
                    mostrarNotificacion(`PIN actualizado a: ${PIN_APP}`);
                    
                } else {
                    log('📌 PIN ya está actualizado');
                }
                
                exito = true;
                break; // Salir del loop si éxito
            } else {
                warn('⚠️ PIN remoto no válido (debe ser 4 dígitos):', nuevoPIN);
            }
            
        } catch (err) {
            log(`❌ Error sincronizando desde ${url}:`, err.name, err.message);
            
            // Continuar con la siguiente URL
            continue;
        }
    }
    
    if (!exito) {
        esModoOffline = true;
        log('🌐 Todas las URLs de PIN fallaron');
        
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
    log('🔧 Configurando sistema de instalación universal v2.0');
    
    // Detectar si ya está instalada
    const yaInstalada = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
    
    if (yaInstalada) {
        log('🏠 PWA ya instalada');
        
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
            log('✅ Botón instalación principal configurado');
        }
        
        if (installLoginButton) {
            installLoginButton.onclick = manejarInstalacionPWA;
            installLoginButton.style.display = 'block';
            log('✅ Botón instalación login configurado');
        }
        
    }, 1500);
    
    // Manejar beforeinstallprompt para Chrome/Edge
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        log('📱 Evento beforeinstallprompt capturado');
        e.preventDefault();
        deferredPrompt = e;
        
        // Mostrar botón de instalación nativo si está disponible
        mostrarBotonInstalacionNativo();
    });
    
    // Detectar cuando se instala
    window.addEventListener('appinstalled', (evt) => {
        log('✅ PWA instalada exitosamente');
        ocultarBotonesInstalacion();
        mostrarNotificacion('¡Aplicación instalada! Ya puede usarla offline.');
    });
}

function manejarInstalacionPWA() {
    // Primero verificar que tenemos recursos offline
    if (!recursosOfflineVerificados && servicioWorkerActivo) {
        verificarRecursosOffline();
        
        mostrarAlert(
            'Antes de instalar, necesitamos verificar que todos los recursos estén disponibles offline.\n\n' +
            '¿Desea continuar con la verificación?'
        ).then(() => {
            // Continuar con instrucciones
            mostrarInstruccionesInstalacionUniversal();
        });
        
        return;
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
        log('🏠 PWA ya instalada - ocultando botones');
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
            log(`✅ Ocultado: #${id}`);
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
        log('🌐 Conexión restaurada');
        esModoOffline = false;
        mostrarNotificacion('Conexión a internet restaurada');
        
        // Sincronizar PIN y verificar actualizaciones
        setTimeout(sincronizarPIN, 1000);
    });
    
    window.addEventListener('online', () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    reg.update();
                    log('🔄 Verificando actualizaciones (conexión restaurada)');
                }
            });
        }
    });
    
    // 3. Detectar cuando se pierde conexión
    window.addEventListener('offline', () => {
        log('⚠️ Sin conexión a internet');
        esModoOffline = true;
        
        // Solo mostrar notificación si está instalada
        if (window.matchMedia('(display-mode: standalone)').matches) {
            mostrarNotificacion('Modo offline activado - La aplicación sigue funcionando');
        }
    });
    
    // 4. Manejar errores globales (silenciosamente)
    window.addEventListener('error', function(e) {
        error('⚠️ Error global capturado:', e.message, 'en', e.filename, 'línea', e.lineno);
        
        // Intentar recuperación para errores críticos
        if (e.message.includes('audio') || e.message.includes('Audio')) {
            log('🔧 Intentando recuperar sistema de audio...');
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
            log('📱 Página oculta - pausando audio si está reproduciendo');
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
async function verificarAcceso() {
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
        
        log('✅ Acceso concedido');
        
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
        
        log('❌ Acceso denegado - PIN incorrecto');
    }
}

// ==========================================
// SISTEMA DE AUDIO SIMPLIFICADO Y ROBUSTO - MEJORADO
// ==========================================
function playAudio(archivo) {
    if (!archivo || typeof archivo !== 'string') {
        error('❌ Nombre de archivo inválido');
        mostrarNotificacion('Error: Archivo de audio no válido');
        return;
    }
    
    // Detectar formato soportado
    if (!detectarFormatosAudioSoportados()) {
        mostrarAlert('Formato de audio no soportado en este navegador.');
        return;
    }
    
    detenerSonido();
    
    try {
        audioActual = new Audio(archivo);
        
        // Pre-cargar para mejor respuesta
        audioActual.preload = 'auto';
        audioActual.load();
        
        audioActual.oncanplaythrough = function() {
            log('✅ Audio listo:', archivo);
        };
        
        audioActual.onerror = function(e) {
            error('❌ Error cargando audio:', archivo, e);
            mostrarNotificacion('Error reproduciendo audio');
            detenerSonido();
            
            // Intentar cargar desde cache si falla
            if ('caches' in window && servicioWorkerActivo) {
                log('🔄 Intentando cargar audio desde cache...');
                cargarAudioDesdeCache(archivo);
            }
        };
        
        audioActual.onended = function() {
            log('⏹️ Audio terminado:', archivo);
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
                            log('🔊 Reproduciendo en iOS:', archivo);
                            document.body.removeEventListener('touchstart', activarAudioIOS);
                        })
                        .catch(err => {
                            warn('⚠️ Error reproduciendo en iOS:', err);
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
                    log('🔊 Reproduciendo:', archivo);
                })
                .catch(err => {
                    warn('⚠️ Error reproduciendo:', archivo, err);
                    
                    if (err.name === 'NotAllowedError') {
                        mostrarNotificacion('Haga clic en la pantalla para activar el audio');
                    }
                    
                    detenerSonido();
                });
        }
        
    } catch (err) {
        error('❌ Error crítico en audio:', err);
        detenerSonido();
    }
}

function detectarFormatosAudioSoportados() {
    const audio = document.createElement('audio');
    const formatos = ['mp3', 'wav', 'ogg', 'opus'];
    
    for (const formato of formatos) {
        const canPlay = audio.canPlayType(`audio/${formato}`);
        if (canPlay === 'probably' || canPlay === 'maybe') {
            log(`✅ Formato ${formato} soportado`);
            return true;
        }
    }
    
    warn('⚠️ Ningún formato de audio soportado');
    return false;
}

function cargarAudioDesdeCache(archivo) {
    if ('caches' in window) {
        caches.match(archivo)
            .then(response => {
                if (response) {
                    log('🎵 Cargando audio desde cache:', archivo);
                    const audioURL = URL.createObjectURL(response.blob());
                    playAudio(audioURL);
                }
            })
            .catch(err => log('Audio no encontrado en cache:', err));
    }
}

async function confirmarEmergencia() {
    const respuesta = await mostrarPrompt(
        "🚨 ¿ESTÁ SEGURO DE ACTIVAR LA ALARMA DE EMERGENCIA?\n\n" +
        "Esta acción hará sonar la alarma máxima.\n\n" +
        "Escriba 'CONFIRMAR' para continuar:"
    );
    
    if (respuesta === 'CONFIRMAR') {
        playAudio('emergencia.mp3');
    }
}

function detenerSonido() {
    if (audioActual) {
        try {
            audioActual.pause();
            audioActual.currentTime = 0;
            audioActual.src = '';
            
            // Liberar recursos de audio
            if (audioActual.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioActual.src);
            }
            
            audioActual = null;
            
            log('⏹️ Sonido detenido');
            
        } catch (err) {
            warn('Advertencia al detener sonido:', err);
        }
    }
}

// ==========================================
// NAVEGACIÓN ENTRE PANTALLAS
// ==========================================
function mostrarInstruccionesBluetooth() {
    mostrarAlert(
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

💡 CONSEJO: Use esta app en modo instalado (como aplicación) para mejor estabilidad.`
    );
}

async function intentarConfiguracion() {
    // Si ya hay sesión admin activa, ir directamente
    if (sesionAdminActiva) {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        return;
    }
    
    const password = await mostrarPrompt("🔐 Ingrese Clave Maestra para CONFIGURACIÓN ADMIN:");
    if (password === CLAVE_MAESTRA) {
        sesionAdminActiva = true;
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        
    } else if (password !== null) {
        mostrarAlert("Clave maestra incorrecta.");
    }
}

function irAHome() {
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
}

async function cambiarPinApp() {
    // Verificar sesión admin
    if (!sesionAdminActiva) {
        const password = await mostrarPrompt("🔐 Ingrese Clave Maestra para cambiar PIN:");
        if (password !== CLAVE_MAESTRA) {
            mostrarAlert("Clave incorrecta");
            return;
        }
        sesionAdminActiva = true;
    }
    
    const nuevoPIN = await mostrarPrompt("Nuevo PIN global (4 dígitos):", PIN_APP);
    if (nuevoPIN === null) return; // Usuario canceló
    
    if (!nuevoPIN || !/^\d{4}$/.test(nuevoPIN)) {
        mostrarAlert("PIN debe ser 4 dígitos numéricos");
        return;
    }
    
    PIN_APP = nuevoPIN;
    ultimaActualizacionPIN = new Date().toLocaleString('es-ES');
    
    try {
        localStorage.setItem('pinRemoto', nuevoPIN);
        localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
    } catch (err) {
        warn('Error guardando PIN en localStorage:', err);
    }
    
    mostrarAlert(
        `✅ PIN cambiado exitosamente a: ${nuevoPIN}\n\n` +
        `📝 Nota: Para efecto global en todos los dispositivos, actualice también el archivo remoto:\n` +
        `${URLS_PIN_REMOTO[0]}\n\n` +
        `Los dispositivos se actualizarán automáticamente al conectarse a internet.`
    );
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
                warn('❌ QR no encontrado');
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
        mostrarAlert(
            '📴 Modo offline activado\n\n' +
            'El PDF de instrucciones requiere conexión a internet.\n\n' +
            'Por favor, conéctese a internet para acceder al manual completo.'
        );
        return;
    }
    
    // Abrir PDF en nueva pestaña
    window.open(URL_PDF_INSTRUCCIONES, '_blank', 'noopener,noreferrer');
}

// ==========================================
// FUNCIONES DE VERIFICACIÓN Y UTILIDADES
// ==========================================
function verificarArchivosAudio() {
    log('🔍 Verificando archivos de audio...');
    
    const archivos = ['campana1.mp3', 'campana2.mp3', 'campana3.mp3', 'emergencia.mp3'];
    let archivosFaltantes = [];
    
    archivos.forEach(archivo => {
        const audio = new Audio();
        
        audio.onerror = () => {
            warn(`❌ Archivo no encontrado: ${archivo}`);
            archivosFaltantes.push(archivo);
        };
        
        audio.oncanplaythrough = () => {
            log(`✅ ${archivo} encontrado`);
        };
        
        audio.src = archivo;
        audio.load();
    });
    
    setTimeout(() => {
        if (archivosFaltantes.length > 0) {
            warn(`⚠️ ${archivosFaltantes.length} archivo(s) de audio faltan:`, archivosFaltantes);
            
            // Intentar descargar si estamos online
            if (navigator.onLine) {
                log('🔄 Intentando descargar archivos faltantes...');
                descargarArchivosFaltantes(archivosFaltantes);
            }
        } else {
            log('✅ Todos los archivos de audio están presentes');
        }
    }, 3000);
}

function descargarArchivosFaltantes(archivos) {
    // Esta función intentaría descargar archivos faltantes
    // En una implementación real, se comunicaría con el servidor
    log('Simulando descarga de archivos faltantes:', archivos);
}

function mostrarNotificacion(mensaje) {
    log('💬 Notificación:', mensaje);
    
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
    
    log('👋 Sesión cerrada');
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

// POLYFILL MEJORADO PARA LOCALSTORAGE
if (typeof localStorage === 'undefined') {
    warn('⚠️ localStorage no disponible - usando IndexedDB como polyfill');
    
    const DB_NAME = 'campanas_localstorage';
    const STORE_NAME = 'keyvaluepairs';
    
    let db;
    
    // Inicializar IndexedDB
    const initDB = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
    
    window.localStorage = {
        _ready: initDB,
        
        setItem: function(key, value) {
            this._ready.then(() => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.put(value, key);
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }).catch(err => warn('Error setItem IndexedDB:', err));
        },
        
        getItem: function(key) {
            return new Promise((resolve) => {
                this._ready.then(() => {
                    const transaction = db.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.get(key);
                    
                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => resolve(null);
                }).catch(() => resolve(null));
            });
        },
        
        removeItem: function(key) {
            this._ready.then(() => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.delete(key);
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }).catch(err => warn('Error removeItem IndexedDB:', err));
        },
        
        clear: function() {
            this._ready.then(() => {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.clear();
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }).catch(err => warn('Error clear IndexedDB:', err));
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
window.conectarBluetooth = conectarBluetooth;

log('✅ app.js v2.0 cargado completamente - Sistema listo para 20+ años');
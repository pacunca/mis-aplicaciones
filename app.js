// ==========================================
// CAMPANAS PARROQUIALES - APP.JS v1.0.0
// Diseñado para durar 20+ años
// Compatible con navegadores antiguos y modernos
// ==========================================

// ==========================================
// CONFIGURACIÓN GLOBAL
// ==========================================
var PIN_APP = '1234';
var CLAVE_MAESTRA = 'santamaria';
var URLS_PIN_REMOTO = [
    'https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt'
];
var URL_PDF_INSTRUCCIONES = 'https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf';

var audioActual = null;
var esDispositivoApple = false;
var ultimaActualizacionPIN = null;
var esModoOffline = false;
var sesionAdminActiva = false;
var servicioWorkerActivo = false;
var recursosOfflineVerificados = false;

var VERSION_APP = '1.0.0';
var ES_DESARROLLO = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

// Sistema de logging
var log = ES_DESARROLLO ? 
    function() { console.log.apply(console, arguments); } : 
    function() {};
var warn = ES_DESARROLLO ? 
    function() { console.warn.apply(console, arguments); } : 
    function() {};
var error = function() { console.error.apply(console, arguments); };

// ==========================================
// BLUETOOTH - CONEXIÓN REAL
// ==========================================
function conectarBluetooth() {
    if (!navigator.bluetooth) {
        mostrarNotificacion('⚠️ Bluetooth no disponible en este navegador');
        
        mostrarAlert(
            'Bluetooth no soportado en este navegador.\n\n' +
            'Usa Chrome/Edge en Android o Safari en iOS 13+.\n\n' +
            'Alternativa: Configura Bluetooth manualmente en ' +
            'Ajustes → Bluetooth y conéctate al dispositivo.'
        );
        return Promise.resolve(false);
    }
    
    log('📡 Solicitando dispositivo Bluetooth...');
    
    return navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
    })
        .then(function(device) {
            log('🔌 Conectando dispositivo:', device.name);
            return device.gatt.connect();
        })
        .then(function(server) {
            log('✅ Bluetooth conectado');
            window.bluetoothDevice = server.device;
            window.bluetoothServer = server;
            
            server.device.addEventListener('gattserverdisconnected', function() {
                log('📡 Dispositivo Bluetooth desconectado');
                mostrarNotificacion('Dispositivo Bluetooth desconectado');
            });
            
            mostrarNotificacion('✅ Bluetooth conectado');
            return true;
        })
        .catch(function(err) {
            error('❌ Error Bluetooth:', err);
            
            if (err.name === 'NotFoundError') {
                mostrarAlert(
                    'Dispositivo Bluetooth no encontrado.\n\n' +
                    'Asegúrate de:\n' +
                    '1. El módulo Bluetooth está ENCENDIDO\n' +
                    '2. Está cerca de tu celular\n' +
                    '3. Es visible\n' +
                    '4. Bluetooth activado en tu celular'
                );
            } else if (err.name === 'SecurityError') {
                mostrarAlert('Se necesita permiso para usar Bluetooth');
            } else {
                mostrarAlert('Error Bluetooth: ' + err.message);
            }
            return false;
        });
}

window.conectarBluetooth = conectarBluetooth;

function verificarSoporteBluetooth() {
    if (!navigator.bluetooth) {
        log('⚠️ Web Bluetooth API no disponible');
        
        setTimeout(function() {
            var btBtn = document.getElementById('bluetooth-help-btn');
            if (btBtn) {
                btBtn.style.display = 'none';
                log('Botón Bluetooth ocultado');
            }
        }, 1000);
        
        return false;
    }
    
    log('✅ Web Bluetooth API disponible');
    return true;
}

// ==========================================
// MODALES PERSONALIZADOS
// ==========================================
function mostrarAlert(mensaje) {
    return new Promise(function(resolve) {
        var modal = document.getElementById('custom-alert');
        var mensajeElem = document.getElementById('alert-message');
        
        if (!modal || !mensajeElem) {
            alert(mensaje);
            resolve();
            return;
        }
        
        mensajeElem.textContent = mensaje;
        modal.classList.remove('hidden');
        
        window.cerrarAlert = function() {
            modal.classList.add('hidden');
            resolve();
        };
    });
}

function mostrarPrompt(pregunta, valorPredeterminado) {
    valorPredeterminado = valorPredeterminado || '';
    
    return new Promise(function(resolve) {
        var modal = document.getElementById('custom-prompt');
        var mensajeElem = document.getElementById('prompt-message');
        var inputElem = document.getElementById('prompt-input');
        
        if (!modal || !mensajeElem || !inputElem) {
            var resultado = prompt(pregunta, valorPredeterminado);
            resolve(resultado);
            return;
        }
        
        mensajeElem.textContent = pregunta;
        inputElem.value = valorPredeterminado;
        inputElem.focus();
        modal.classList.remove('hidden');
        
        window.confirmarPrompt = function() {
            modal.classList.add('hidden');
            resolve(inputElem.value);
        };
        
        window.cancelarPrompt = function() {
            modal.classList.add('hidden');
            resolve(null);
        };
        
        inputElem.onkeypress = function(e) {
            if (e.key === 'Enter') {
                confirmarPrompt();
            }
        };
    });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    log('🔔 Campanas Parroquiales - Inicializando v1.0.0');
    
    verificarMigracionDatos();
    
    esDispositivoApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
    log('Dispositivo Apple:', esDispositivoApple);
    
    verificarSoporteBluetooth();
    inicializarServiceWorker();
    cargarPINLocal();
    
    if (navigator.onLine) {
        setTimeout(sincronizarPIN, 500);
    }
    
    configurarInstalacionPWAUniversal();
    configurarEventosGlobales();
    
    setTimeout(function() {
        var pinInput = document.getElementById('pin-input');
        if (pinInput) {
            pinInput.focus();
        }
    }, 300);
    
    // SOLO verificar recursos si el usuario hace clic en el botón
    // NO verificar automáticamente al abrir
    
    if (ES_DESARROLLO) {
        setTimeout(verificarArchivosAudio, 1000);
    }
});

// ==========================================
// MIGRACIÓN DE DATOS
// ==========================================
function verificarMigracionDatos() {
    var versionAnterior = localStorage.getItem('app_version');
    
    if (!versionAnterior) {
        log('Primera instalación');
        localStorage.setItem('app_version', VERSION_APP);
        return;
    }
    
    if (versionAnterior !== VERSION_APP) {
        log('Migrando datos de', versionAnterior, 'a', VERSION_APP);
        migrarDatosVersion(versionAnterior, VERSION_APP);
        localStorage.setItem('app_version', VERSION_APP);
    }
}

function migrarDatosVersion(versionAnterior, versionNueva) {
    try {
        log('Migración', versionAnterior, '→', versionNueva);
        
        var pinViejo = localStorage.getItem('pinRemoto');
        if (pinViejo && !localStorage.getItem('pin_remoto_backup')) {
            localStorage.setItem('pin_remoto_backup', pinViejo);
            log('PIN respaldado');
        }
    } catch (err) {
        error('Error en migración:', err);
    }
}

// ==========================================
// SERVICE WORKER
// ==========================================
function inicializarServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        warn('⚠️ Service Worker no soportado');
        servicioWorkerActivo = false;
        activarModoOfflineBasico();
        return;
    }
    
    navigator.serviceWorker.register('sw.js')
        .then(function(registration) {
            log('✅ Service Worker registrado:', registration.scope);
            servicioWorkerActivo = true;
            
            if (navigator.serviceWorker.controller) {
                log('🎮 Service Worker controlando página');
                servicioWorkerActivo = true;
            }
            
            navigator.serviceWorker.addEventListener('message', function(event) {
                log('📨 Mensaje del SW:', event.data);
                
                if (event.data.type === 'SW_ACTIVADO') {
                    log('🔄 SW activado, versión:', event.data.version);
                    servicioWorkerActivo = true;
                    mostrarNotificacion('Aplicación lista para funcionar offline');
                }
                
                if (event.data.type === 'PIN_ACTUALIZADO') {
                    log('📌 PIN actualizado:', event.data.pin);
                    PIN_APP = event.data.pin;
                    ultimaActualizacionPIN = event.data.fecha;
                    
                    try {
                        localStorage.setItem('pinRemoto', event.data.pin);
                        localStorage.setItem('pinActualizado', event.data.fecha);
                    } catch (err) {
                        warn('Error guardando PIN:', err);
                    }
                    
                    mostrarNotificacion('PIN actualizado a: ' + event.data.pin);
                }
            });
            
            registration.addEventListener('updatefound', function() {
                var nuevoWorker = registration.installing;
                log('🔄 Nuevo SW encontrado:', nuevoWorker.state);
                
                nuevoWorker.addEventListener('statechange', function() {
                    log('📊 Estado nuevo SW:', this.state);
                    
                    if (this.state === 'activated') {
                        log('✨ Nuevo SW activado');
                        mostrarNotificacion('Aplicación actualizada');
                    }
                });
            });
        })
        .catch(function(err) {
            error('❌ Error registrando SW:', err);
            servicioWorkerActivo = false;
            activarModoOfflineBasico();
        });
}

function activarModoOfflineBasico() {
    log('📴 Activando modo offline básico');
    
    var recursos = [
        'campana1.mp3',
        'campana2.mp3',
        'campana3.mp3',
        'emergencia.mp3',
        'icon-192.png'
    ];
    
    recursos.forEach(function(recurso) {
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = recurso.indexOf('.mp3') > -1 ? 'audio' : 'image';
        link.href = recurso;
        document.head.appendChild(link);
    });
}

function verificarRecursosOffline() {
    if (!servicioWorkerActivo) {
        warn('⚠️ No se puede verificar recursos - SW inactivo');
        return;
    }
    
    log('🔍 Verificando recursos cacheados...');
    
    var channel = new MessageChannel();
    
    channel.port1.onmessage = function(event) {
        if (event.data.type === 'ESTADO_CACHE') {
            log('📊 Estado del cache:', event.data);
            
            var totalCacheado = event.data.total;
            var totalEsperado = 19;
            
            if (totalCacheado >= totalEsperado) {
                log('✅ Recursos offline verificados');
                recursosOfflineVerificados = true;
                
                // SOLO mostrar si el usuario presionó el botón manualmente
                // NO mostrar automáticamente al abrir la app
                
            } else {
                warn('⚠️ Solo', totalCacheado, '/', totalEsperado, 'recursos en cache');
                
                if (navigator.onLine) {
                    log('🔄 Intentando recachear...');
                    recachearRecursosFaltantes();
                }
            }
        }
    };
    
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(
            { type: 'VERIFICAR_CACHE' },
            [channel.port2]
        );
    } else {
        warn('⚠️ SW no controlando página');
    }
}

function recachearRecursosFaltantes() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'FORZAR_ACTUALIZACION'
        });
        
        mostrarNotificacion('🔄 Recacheando recursos...');
        
        setTimeout(function() {
            location.reload();
        }, 1500);
    } else {
        mostrarNotificacion('⚠️ Service Worker no disponible');
    }
}

window.recachearRecursosFaltantes = recachearRecursosFaltantes;

function forzarActualizacionSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(registration) {
            if (registration) {
                registration.update();
                mostrarNotificacion('🔄 Buscando actualizaciones...');
                
                setTimeout(function() {
                    location.reload();
                }, 2000);
            }
        });
    }
}

window.forzarActualizacionSW = forzarActualizacionSW;
window.verificarRecursosOffline = verificarRecursosOffline;

// ==========================================
// SINCRONIZACIÓN PIN REMOTO
// ==========================================
function cargarPINLocal() {
    try {
        var pinGuardado = localStorage.getItem('pinRemoto');
        if (pinGuardado && /^\d{4}$/.test(pinGuardado)) {
            PIN_APP = pinGuardado;
            var fechaActualizacion = localStorage.getItem('pinActualizado');
            log('📌 PIN cargado local:', PIN_APP, fechaActualizacion || '');
            
            if ('caches' in window) {
                caches.match('/pin-remoto-cache')
                    .then(function(response) {
                        if (response) {
                            return response.json();
                        }
                        return null;
                    })
                    .then(function(data) {
                        if (data && data.pin && /^\d{4}$/.test(data.pin)) {
                            log('📌 PIN en cache SW:', data.pin);
                            PIN_APP = data.pin;
                        }
                    })
                    .catch(function(err) {
                        log('No hay PIN en cache SW:', err);
                    });
            }
        }
    } catch (err) {
        warn('Error cargando PIN local:', err);
    }
}

function sincronizarPIN() {
    if (!navigator.onLine && servicioWorkerActivo) {
        log('📡 Offline - usando PIN cacheado');
        return cargarPINLocal();
    }
    
    if (!navigator.onLine) {
        log('🌐 Sin conexión - usando PIN local');
        esModoOffline = true;
        return;
    }
    
    esModoOffline = false;
    var exito = false;
    
    var promesas = URLS_PIN_REMOTO.map(function(url) {
        return new Promise(function(resolve) {
            log('🔄 Intentando:', url);
            
            var controller = new AbortController();
            var timeoutId = setTimeout(function() {
                controller.abort();
            }, 5000);
            
            fetch(url + '?t=' + Date.now(), {
                signal: controller.signal,
                cache: 'no-store'
            })
                .then(function(respuesta) {
                    clearTimeout(timeoutId);
                    
                    if (!respuesta.ok) {
                        throw new Error('HTTP ' + respuesta.status);
                    }
                    
                    return respuesta.text();
                })
                .then(function(nuevoPIN) {
                    nuevoPIN = nuevoPIN.trim();
                    
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
                            
                            log('✅ PIN actualizado:', PIN_APP);
                            
                            try {
                                localStorage.setItem('pinRemoto', PIN_APP);
                                localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
                            } catch (err) {
                                warn('Error guardando PIN:', err);
                            }
                            
                            if ('caches' in window) {
                                caches.open('campanas-pwa-v' + VERSION_APP)
                                    .then(function(cache) {
                                        cache.put(
                                            new Request('/pin-remoto-cache'),
                                            new Response(JSON.stringify({
                                                pin: nuevoPIN,
                                                fecha: new Date().toISOString()
                                            }))
                                        );
                                        log('📦 PIN en cache SW');
                                    })
                                    .catch(function(err) {
                                        warn('Error guardando en cache:', err);
                                    });
                            }
                            
                            mostrarNotificacion('PIN actualizado a: ' + PIN_APP);
                        } else {
                            log('📌 PIN ya actualizado');
                        }
                        
                        exito = true;
                        resolve(true);
                    } else {
                        warn('⚠️ PIN no válido:', nuevoPIN);
                        resolve(false);
                    }
                })
                .catch(function(err) {
                    log('❌ Error desde', url, ':', err.message);
                    resolve(false);
                });
        });
    });
    
    Promise.all(promesas).then(function(resultados) {
        var hayExito = resultados.some(function(r) { return r; });
        
        if (!hayExito) {
            esModoOffline = true;
            log('🌐 Todas las URLs fallaron');
            cargarPINLocal();
            
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'REGISTRAR_SYNC_PIN'
                });
            }
        }
    });
}

// ==========================================
// INSTALACIÓN PWA UNIVERSAL
// ==========================================
function configurarInstalacionPWAUniversal() {
    log('🔧 Configurando instalación universal');
    
    var yaInstalada = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.indexOf('android-app://') > -1;
    
    if (yaInstalada) {
        log('🏠 PWA ya instalada');
        ocultarBotonesInstalacion();
        
        setTimeout(function() {
            mostrarNotificacion('Aplicación instalada - Lista para uso offline');
        }, 1000);
        
        return;
    }
    
    setTimeout(function() {
        var installButton = document.getElementById('install-button');
        var installLoginButton = document.getElementById('install-login-button');
        
        if (installButton) {
            installButton.onclick = manejarInstalacionPWA;
            installButton.style.display = 'block';
            log('✅ Botón instalación configurado');
        }
        
        if (installLoginButton) {
            installLoginButton.onclick = manejarInstalacionPWA;
            installLoginButton.style.display = 'block';
            log('✅ Botón instalación login configurado');
        }
    }, 1500);
    
    var deferredPrompt;
    window.addEventListener('beforeinstallprompt', function(e) {
        log('📱 beforeinstallprompt capturado');
        e.preventDefault();
        deferredPrompt = e;
        mostrarBotonInstalacionNativo();
    });
    
    window.addEventListener('appinstalled', function() {
        log('✅ PWA instalada');
        ocultarBotonesInstalacion();
        mostrarNotificacion('¡Aplicación instalada! Ya puede usarla offline.');
    });
}

function manejarInstalacionPWA() {
    if (!recursosOfflineVerificados && servicioWorkerActivo) {
        verificarRecursosOffline();
        
        mostrarAlert(
            'Antes de instalar, necesitamos verificar que todos los recursos estén disponibles offline.\n\n' +
            '¿Desea continuar con la verificación?'
        ).then(function() {
            mostrarInstruccionesInstalacionUniversal();
        });
        
        return;
    }
    
    mostrarInstruccionesInstalacionUniversal();
}

function mostrarBotonInstalacionNativo() {
    var installButton = document.getElementById('install-button');
    var installLoginButton = document.getElementById('install-login-button');
    
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
    var instrucciones = 
'📱 COMO INSTALAR ESTA APLICACIÓN:\n\n' +
'ESTA APP SE PUEDE INSTALAR en su teléfono como una aplicación normal.\n\n' +
'✅ VENTAJAS DE INSTALAR:\n' +
'• Funciona 100% SIN INTERNET\n' +
'• Ícono en pantalla principal\n' +
'• Se abre como app independiente\n' +
'• Más rápido que navegador\n\n' +
'PARA INSTALAR:\n\n' +
'1. Busque el BOTÓN DE MENÚ en su navegador:\n' +
'   • Chrome Android: 3 puntos verticales (arriba derecha)\n' +
'   • Safari iPhone: Cuadrado con flecha (📤 abajo centro)\n' +
'   • Samsung Internet: 3 líneas horizontales (≡ abajo derecha)\n\n' +
'2. En el menú, busque y toque:\n' +
'   ⭐ "AGREGAR A PANTALLA DE INICIO"\n' +
'   o "INSTALAR APLICACIÓN"\n\n' +
'3. Confirme la instalación cuando se lo pidan.\n\n' +
'🔄 La aplicación descargará todos los recursos para funcionar offline.\n\n' +
'✅ LISTO: Tendrá su propio ícono en la pantalla principal.';

    mostrarAlert(instrucciones);
}

function ocultarBotonesInstalacion() {
    var elementos = [
        'install-container',
        'install-advice',
        'install-button',
        'install-login-button'
    ];
    
    elementos.forEach(function(id) {
        var elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.display = 'none';
            log('✅ Ocultado:', id);
        }
    });
}

// ==========================================
// EVENTOS GLOBALES
// ==========================================
function configurarEventosGlobales() {
    var helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarAyuda();
            }
        });
    }
    
    window.addEventListener('online', function() {
        log('🌐 Conexión restaurada');
        esModoOffline = false;
        mostrarNotificacion('Conexión a internet restaurada');
        setTimeout(sincronizarPIN, 1000);
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(function(reg) {
                if (reg) {
                    reg.update();
                    log('🔄 Verificando actualizaciones');
                }
            });
        }
    });
    
    window.addEventListener('offline', function() {
        log('⚠️ Sin conexión');
        esModoOffline = true;
        
        if (window.matchMedia('(display-mode: standalone)').matches) {
            mostrarNotificacion('Modo offline activado - La aplicación sigue funcionando');
        }
    });
    
    window.addEventListener('error', function(e) {
        error('⚠️ Error global:', e.message);
        
        if (e.message && (e.message.indexOf('audio') > -1 || e.message.indexOf('Audio') > -1)) {
            log('🔧 Intentando recuperar audio...');
            detenerSonido();
        }
    });
    
    window.addEventListener('beforeunload', function() {
        if (audioActual && !audioActual.paused) {
            detenerSonido();
        }
    });
    
    var pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verificarAcceso();
            }
        });
    }
    
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && audioActual) {
            log('📱 Página oculta');
            if (!audioActual.paused) {
                audioActual.pause();
                audioActual.dataset.lastPosition = audioActual.currentTime;
            }
        }
    });
}

// ==========================================
// VALIDACIÓN INPUT PIN
// ==========================================
function validarPinInput(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    
    if (input.value.length > 4) {
        input.value = input.value.slice(0, 4);
    }
    
    if (input.value.length === 4) {
        input.style.borderColor = '#10B981';
        input.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.2)';
        input.classList.remove('error');
        
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setTimeout(function() {
                verificarAcceso();
            }, 300);
        }
    } else {
        input.style.borderColor = '#8B7355';
        input.style.boxShadow = 'none';
        input.classList.remove('error');
    }
}

window.validarPinInput = validarPinInput;

// ==========================================
// VERIFICACIÓN DE ACCESO
// ==========================================
function verificarAcceso() {
    var pinInput = document.getElementById('pin-input');
    
    if (!pinInput) {
        mostrarNotificacion('Error del sistema. Recargue la página.');
        return;
    }
    
    var entradaPin = pinInput.value;
    
    if (entradaPin.length !== 4) {
        mostrarNotificacion('El PIN debe tener 4 dígitos');
        pinInput.focus();
        return;
    }
    
    if (entradaPin === PIN_APP) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('home-screen').classList.remove('hidden');
        
        pinInput.value = '';
        pinInput.style.borderColor = '#8B7355';
        pinInput.style.boxShadow = 'none';
        pinInput.classList.remove('error');
        
        if (navigator.onLine && !esModoOffline) {
            setTimeout(sincronizarPIN, 500);
        }
        
        log('✅ Acceso concedido');
        
        if (esModoOffline && servicioWorkerActivo) {
            mostrarNotificacion('Modo offline activado - Funcionando sin internet');
        }
    } else {
        mostrarNotificacion('PIN Incorrecto. Intente de nuevo.');
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        pinInput.classList.add('error');
        pinInput.style.borderColor = '#EF4444';
        pinInput.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
        
        pinInput.value = '';
        setTimeout(function() {
            pinInput.focus();
            pinInput.classList.remove('error');
            pinInput.style.borderColor = '#8B7355';
            pinInput.style.boxShadow = 'none';
        }, 100);
        
        log('❌ Acceso denegado');
    }
}

window.verificarAcceso = verificarAcceso;

// ==========================================
// SISTEMA DE AUDIO
// ==========================================
function playAudio(archivo) {
    if (!archivo || typeof archivo !== 'string') {
        error('❌ Archivo inválido');
        mostrarNotificacion('Error: Archivo de audio no válido');
        return;
    }
    
    if (!detectarFormatosAudioSoportados()) {
        mostrarAlert('Formato de audio no soportado en este navegador.');
        return;
    }
    
    detenerSonido();
    
    try {
        audioActual = new Audio(archivo);
        audioActual.preload = 'auto';
        audioActual.load();
        
        audioActual.oncanplaythrough = function() {
            log('✅ Audio listo:', archivo);
        };
        
        audioActual.onerror = function(e) {
            error('❌ Error cargando audio:', archivo, e);
            mostrarNotificacion('Error reproduciendo audio');
            detenerSonido();
            
            if ('caches' in window && servicioWorkerActivo) {
                log('🔄 Intentando desde cache...');
                cargarAudioDesdeCache(archivo);
            }
        };
        
        audioActual.onended = function() {
            log('⏹️ Audio terminado:', archivo);
            detenerSonido();
        };
        
        if (esDispositivoApple) {
            document.body.addEventListener('touchstart', function activarAudioIOS() {
                var promesaReproduccion = audioActual.play();
                if (promesaReproduccion !== undefined) {
                    promesaReproduccion
                        .then(function() {
                            log('🔊 Reproduciendo en iOS:', archivo);
                            document.body.removeEventListener('touchstart', activarAudioIOS);
                        })
                        .catch(function(err) {
                            warn('⚠️ Error en iOS:', err);
                        });
                }
            }, { once: true });
            
            return;
        }
        
        var promesaReproduccion = audioActual.play();
        
        if (promesaReproduccion !== undefined) {
            promesaReproduccion
                .then(function() {
                    log('🔊 Reproduciendo:', archivo);
                })
                .catch(function(err) {
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
    var audio = document.createElement('audio');
    var formatos = ['mp3', 'wav', 'ogg', 'opus'];
    
    for (var i = 0; i < formatos.length; i++) {
        var canPlay = audio.canPlayType('audio/' + formatos[i]);
        if (canPlay === 'probably' || canPlay === 'maybe') {
            log('✅ Formato', formatos[i], 'soportado');
            return true;
        }
    }
    
    warn('⚠️ Ningún formato de audio soportado');
    return false;
}

function cargarAudioDesdeCache(archivo) {
    if ('caches' in window) {
        caches.match(archivo)
            .then(function(response) {
                if (response) {
                    log('🎵 Cargando desde cache:', archivo);
                    return response.blob();
                }
            })
            .then(function(blob) {
                if (blob) {
                    var audioURL = URL.createObjectURL(blob);
                    playAudio(audioURL);
                }
            })
            .catch(function(err) {
                log('Audio no en cache:', err);
            });
    }
}

function confirmarEmergencia() {
    mostrarPrompt(
        '🚨 ¿ESTÁ SEGURO DE ACTIVAR LA ALARMA DE EMERGENCIA?\n\n' +
        'Esta acción hará sonar la alarma máxima.\n\n' +
        'Escriba "CONFIRMAR" para continuar:'
    ).then(function(respuesta) {
        if (respuesta === 'CONFIRMAR') {
            playAudio('emergencia.mp3');
        }
    });
}

function detenerSonido() {
    if (!audioActual) {
        log('No hay audio para detener');
        return;
    }
    
    try {
        // PRIMERO: Pausar inmediatamente
        if (!audioActual.paused) {
            audioActual.pause();
        }
        
        // SEGUNDO: Resetear tiempo
        try {
            audioActual.currentTime = 0;
        } catch (e) {
            // Algunos navegadores fallan aquí, continuar
        }
        
        // TERCERO: Liberar recursos blob si existe
        var srcOriginal = audioActual.src;
        if (srcOriginal && srcOriginal.indexOf('blob:') === 0) {
            try {
                URL.revokeObjectURL(srcOriginal);
            } catch (e) {
                // Silenciar error de revoke
            }
        }
        
        // CUARTO: Limpiar src
        audioActual.src = '';
        audioActual.load(); // Forzar limpieza
        
        // QUINTO: Remover eventos
        audioActual.onended = null;
        audioActual.onerror = null;
        audioActual.oncanplaythrough = null;
        
        // SEXTO: Eliminar referencia
        audioActual = null;
        
        log('⏹️ Sonido detenido correctamente');
        // SOLO mostrar notificación si realmente había audio sonando
        
    } catch (err) {
        // Si todo falla, forzar eliminación
        error('Error deteniendo sonido:', err);
        audioActual = null;
    }
}

window.playAudio = playAudio;
window.confirmarEmergencia = confirmarEmergencia;
window.detenerSonido = detenerSonido;

// ==========================================
// NAVEGACIÓN
// ==========================================
function mostrarInstruccionesBluetooth() {
    mostrarAlert(
        '📡 CONEXIÓN BLUETOOTH:\n\n' +
        'Para conectar con el módulo Bluetooth (1Mii o similar):\n\n' +
        '1. Encienda el módulo Bluetooth\n' +
        '2. Vaya a Configuración → Bluetooth en su celular\n' +
        '3. Busque dispositivos disponibles\n' +
        '4. Conéctese al módulo (parear)\n\n' +
        '✅ Después de parear una vez, se conectará automáticamente.\n\n' +
        '⚠️ IMPORTANTE:\n' +
        '• Asegúrese que el módulo esté encendido\n' +
        '• Mantenga el celular cerca del módulo\n' +
        '• Si no aparece, reinicie ambos dispositivos\n\n' +
        '💡 CONSEJO: Use esta app en modo instalado (como aplicación) para mejor estabilidad.'
    );
}

function intentarConfiguracion() {
    if (sesionAdminActiva) {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        return;
    }
    
    mostrarPrompt('🔐 Ingrese Clave Maestra para CONFIGURACIÓN ADMIN:')
        .then(function(password) {
            if (password === CLAVE_MAESTRA) {
                sesionAdminActiva = true;
                document.getElementById('home-screen').classList.add('hidden');
                document.getElementById('config-screen').classList.remove('hidden');
            } else if (password !== null) {
                mostrarAlert('Clave maestra incorrecta.');
            }
        });
}

function irAHome() {
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
}

function cambiarPinApp() {
    if (!sesionAdminActiva) {
        mostrarPrompt('🔐 Ingrese Clave Maestra para cambiar PIN:')
            .then(function(password) {
                if (password !== CLAVE_MAESTRA) {
                    mostrarAlert('Clave incorrecta');
                    return;
                }
                sesionAdminActiva = true;
                solicitarNuevoPIN();
            });
    } else {
        solicitarNuevoPIN();
    }
}

function solicitarNuevoPIN() {
    mostrarPrompt('Nuevo PIN global (4 dígitos):', PIN_APP)
        .then(function(nuevoPIN) {
            if (nuevoPIN === null) return;
            
            if (!nuevoPIN || !/^\d{4}$/.test(nuevoPIN)) {
                mostrarAlert('PIN debe ser 4 dígitos numéricos');
                return;
            }
            
            PIN_APP = nuevoPIN;
            ultimaActualizacionPIN = new Date().toLocaleString('es-ES');
            
            try {
                localStorage.setItem('pinRemoto', nuevoPIN);
                localStorage.setItem('pinActualizado', ultimaActualizacionPIN);
            } catch (err) {
                warn('Error guardando PIN:', err);
            }
            
            mostrarAlert(
                '✅ PIN cambiado exitosamente a: ' + nuevoPIN + '\n\n' +
                '📝 Nota: Para efecto global en todos los dispositivos, actualice también el archivo remoto:\n' +
                URLS_PIN_REMOTO[0] + '\n\n' +
                'Los dispositivos se actualizarán automáticamente al conectarse a internet.'
            );
        });
}

function abrirAyuda() {
    var modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        var qrImg = modal.querySelector('.qr-img');
        if (qrImg) {
            qrImg.onerror = function() {
                warn('❌ QR no encontrado');
                this.alt = 'QR no disponible - Contacte al administrador';
                this.style.border = '2px dashed #ccc';
                this.src = 'icon-192.png';
            };
        }
    }
}

function cerrarAyuda() {
    var modal = document.getElementById('help-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function abrirPDF() {
    if (!navigator.onLine) {
        mostrarAlert(
            '📴 Modo offline activado\n\n' +
            'El PDF de instrucciones requiere conexión a internet.\n\n' +
            'Por favor, conéctese a internet para acceder al manual completo.'
        );
        return;
    }
    
    window.open(URL_PDF_INSTRUCCIONES, '_blank', 'noopener,noreferrer');
}

function cerrarSesion() {
    detenerSonido();
    
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    var pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.value = '';
        pinInput.style.borderColor = '#8B7355';
        pinInput.style.boxShadow = 'none';
        pinInput.classList.remove('error');
        
        setTimeout(function() {
            pinInput.focus();
        }, 300);
    }
    
    sesionAdminActiva = false;
    log('👋 Sesión cerrada');
    mostrarNotificacion('Sesión cerrada');
}

window.mostrarInstruccionesBluetooth = mostrarInstruccionesBluetooth;
window.intentarConfiguracion = intentarConfiguracion;
window.irAHome = irAHome;
window.cambiarPinApp = cambiarPinApp;
window.abrirAyuda = abrirAyuda;
window.cerrarAyuda = cerrarAyuda;
window.abrirPDF = abrirPDF;
window.cerrarSesion = cerrarSesion;

// ==========================================
// VERIFICACIÓN DE ARCHIVOS
// ==========================================
function verificarArchivosAudio() {
    log('🔍 Verificando archivos de audio...');
    
    var archivos = ['campana1.mp3', 'campana2.mp3', 'campana3.mp3', 'emergencia.mp3'];
    var archivosFaltantes = [];
    
    archivos.forEach(function(archivo) {
        var audio = new Audio();
        
        audio.onerror = function() {
            warn('❌ Archivo no encontrado:', archivo);
            archivosFaltantes.push(archivo);
        };
        
        audio.oncanplaythrough = function() {
            log('✅', archivo, 'encontrado');
        };
        
        audio.src = archivo;
        audio.load();
    });
    
    setTimeout(function() {
        if (archivosFaltantes.length > 0) {
            warn('⚠️', archivosFaltantes.length, 'archivo(s) faltan:', archivosFaltantes);
            
            if (navigator.onLine) {
                log('🔄 Intentando descargar faltantes...');
            }
        } else {
            log('✅ Todos los archivos de audio están presentes');
        }
    }, 3000);
}

function mostrarNotificacion(mensaje, duracion) {
    duracion = duracion || 3000;
    log('💬 Notificación:', mensaje);
    
    var notificacion = document.createElement('div');
    notificacion.style.cssText = 
        'position: fixed;' +
        'top: 20px;' +
        'left: 50%;' +
        'transform: translateX(-50%);' +
        'background: rgba(0, 0, 0, 0.9);' +
        'color: white;' +
        'padding: 12px 20px;' +
        'border-radius: 10px;' +
        'z-index: 9999;' +
        'font-size: 14px;' +
        'max-width: 80%;' +
        'text-align: center;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
        'animation: fadeInOut ' + (duracion / 1000) + 's ease;';
    
    var style = document.createElement('style');
    style.textContent = 
        '@keyframes fadeInOut {' +
        '0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }' +
        '10% { opacity: 1; transform: translateX(-50%) translateY(0); }' +
        '90% { opacity: 1; transform: translateX(-50%) translateY(0); }' +
        '100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }' +
        '}';
    document.head.appendChild(style);
    
    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);
    
    setTimeout(function() {
        if (notificacion.parentNode) {
            notificacion.parentNode.removeChild(notificacion);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, duracion);
}

window.mostrarNotificacion = mostrarNotificacion;

// ==========================================
// POLYFILLS PARA NAVEGADORES ANTIGUOS
// ==========================================
if (typeof console === 'undefined') {
    window.console = {
        log: function() {},
        warn: function() {},
        error: function() {}
    };
}

if (typeof localStorage === 'undefined') {
    warn('⚠️ localStorage no disponible - usando polyfill');
    
    var DB_NAME = 'campanas_localstorage';
    var STORE_NAME = 'keyvaluepairs';
    var db;
    
    var initDB = new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = function() {
            reject(request.error);
        };
        
        request.onsuccess = function() {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = function(event) {
            var database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
            }
        };
    });
    
    window.localStorage = {
        _ready: initDB,
        
        setItem: function(key, value) {
            this._ready.then(function() {
                return new Promise(function(resolve, reject) {
                    var transaction = db.transaction([STORE_NAME], 'readwrite');
                    var store = transaction.objectStore(STORE_NAME);
                    var request = store.put(value, key);
                    
                    request.onsuccess = function() {
                        resolve();
                    };
                    request.onerror = function() {
                        reject(request.error);
                    };
                });
            }).catch(function(err) {
                warn('Error setItem IndexedDB:', err);
            });
        },
        
        getItem: function(key) {
            return new Promise(function(resolve) {
                initDB.then(function() {
                    var transaction = db.transaction([STORE_NAME], 'readonly');
                    var store = transaction.objectStore(STORE_NAME);
                    var request = store.get(key);
                    
                    request.onsuccess = function() {
                        resolve(request.result || null);
                    };
                    request.onerror = function() {
                        resolve(null);
                    };
                }).catch(function() {
                    resolve(null);
                });
            });
        },
        
        removeItem: function(key) {
            this._ready.then(function() {
                return new Promise(function(resolve, reject) {
                    var transaction = db.transaction([STORE_NAME], 'readwrite');
                    var store = transaction.objectStore(STORE_NAME);
                    var request = store.delete(key);
                    
                    request.onsuccess = function() {
                        resolve();
                    };
                    request.onerror = function() {
                        reject(request.error);
                    };
                });
            }).catch(function(err) {
                warn('Error removeItem IndexedDB:', err);
            });
        },
        
        clear: function() {
            this._ready.then(function() {
                return new Promise(function(resolve, reject) {
                    var transaction = db.transaction([STORE_NAME], 'readwrite');
                    var store = transaction.objectStore(STORE_NAME);
                    var request = store.clear();
                    
                    request.onsuccess = function() {
                        resolve();
                    };
                    request.onerror = function() {
                        reject(request.error);
                    };
                });
            }).catch(function(err) {
                warn('Error clear IndexedDB:', err);
            });
        }
    };
}

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
// FIN
// ==========================================
log('✅ app.js v1.0.0 cargado completamente - Sistema listo para 20+ años');
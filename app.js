// ==========================================
// CONFIGURACIÓN DE SEGURIDAD Y ESTADO
// ==========================================
let PIN_APP = "1234";               // PIN inicial por defecto
const CLAVE_MAESTRA = "santamaria"; // Clave solo para ADMIN
const URL_PIN_REMOTO = "https://raw.githubusercontent.com/pacunca/mis-aplicaciones/main/pin-actual.txt";

let audioActual = null;             // Controla el sonido que suena
let esDispositivoApple = false;     // Detectar iPhone/iPad/Mac
let ultimaActualizacionPIN = null;  // Para sincronización remota
let esModoOffline = false;          // Controlar estado de conexión
let sesionAdminActiva = false;      // Controlar sesión admin activa

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔔 Campanas Parroquiales - Inicializando');
    
    // 1. Detectar dispositivo Apple
    esDispositivoApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
    console.log('Dispositivo Apple:', esDispositivoApple);
    
    // 2. Cargar PIN guardado localmente (si existe)
    cargarPINLocal();
    
    // 3. Sincronizar PIN remoto si hay internet (sin bloquear inicio)
    if (navigator.onLine) {
        setTimeout(sincronizarPIN, 500);
    }
    
    // 4. Configurar instalación PWA (sistema universal)
    configurarInstalacionPWAUniversal();
    
    // 5. Configurar eventos globales
    configurarEventosGlobales();
    
    // 6. Enfocar input automáticamente y ocultar asteriscos si existe
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
    
    // 7. Verificar archivos de audio (solo en desarrollo)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setTimeout(verificarArchivosAudio, 1000);
    }
});

// ==========================================
// SISTEMA DE SINCRONIZACIÓN DE PIN REMOTO (ANTI-ROBO)
// ==========================================
function cargarPINLocal() {
    try {
        const pinGuardado = localStorage.getItem('pinRemoto');
        if (pinGuardado && /^\d{4}$/.test(pinGuardado)) {
            PIN_APP = pinGuardado;
            const fechaActualizacion = localStorage.getItem('pinActualizado');
            console.log('📌 PIN cargado desde almacenamiento local:', PIN_APP, 
                       fechaActualizacion ? '(Actualizado: ' + fechaActualizacion + ')' : '');
        }
    } catch (error) {
        console.warn('Error cargando PIN local:', error);
    }
}

async function sincronizarPIN() {
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
                
                console.log('PIN actualizado remotamente a:', PIN_APP);
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
    }
}

// ==========================================
// INSTALACIÓN PWA UNIVERSAL (20+ AÑOS)
// ==========================================
function configurarInstalacionPWAUniversal() {
    console.log('🔧 Configurando sistema de instalación universal');
    
    // Detectar capacidades del navegador
    const soportaPWA = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone !== undefined;
    
    // Configurar botones después de que cargue la página
    setTimeout(() => {
        const installButton = document.getElementById('install-button');
        const installLoginButton = document.getElementById('install-login-button');
        
        if (installButton) {
            installButton.onclick = mostrarInstruccionesInstalacionUniversal;
            installButton.style.display = 'block';
            console.log('✅ Botón instalación principal configurado');
        }
        
        if (installLoginButton) {
            installLoginButton.onclick = mostrarInstruccionesInstalacionUniversal;
            installLoginButton.style.display = 'block';
            console.log('✅ Botón instalación login configurado');
        }
        
        // Ocultar si ya está instalada
        verificarSiYaInstalada();
        
    }, 1500);
    
    // Mantener beforeinstallprompt solo para registro (no funcionalidad)
    if ('beforeinstallprompt' in window) {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('ℹ️ beforeinstallprompt detectado (información histórica)');
            // No hacer nada funcional, solo registrar
        });
    }
}

function mostrarInstruccionesInstalacionUniversal() {
    const instrucciones = 
`📱 COMO INSTALAR ESTA APLICACIÓN:

ESTA APP SE PUEDE INSTALAR en su teléfono como una aplicación normal.

PARA INSTALAR:

1. Busque el BOTÓN DE MENÚ en su navegador:
   • Chrome Android: 3 puntos verticales (arriba derecha)
   • Safari iPhone: Cuadrado con flecha (📤 abajo centro)
   • Samsung Internet: 3 líneas horizontales (≡ abajo derecha)

2. En el menú, busque y toque:
   ⭐ "AGREGAR A PANTALLA DE INICIO"
   o "INSTALAR APLICACIÓN"

3. Confirme la instalación cuando se lo pidan.

✅ LISTO: La aplicación tendrá su propio ícono en la pantalla principal.

💡 CONSEJO: Una vez instalada, se abre como app independiente, sin barra del navegador.
`;

    // Intentar mostrar en modal si existe, sino usar alert
    if (typeof mostrarModalInstalacion === 'function') {
        mostrarModalInstalacion(instrucciones);
    } else {
        alert(instrucciones);
    }
}

function verificarSiYaInstalada() {
    // Métodos robustos para detectar instalación
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
// CONFIGURACIÓN DE EVENTOS GLOBALES
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
        setTimeout(sincronizarPIN, 1000);
    });
    
    // 3. Detectar cuando se pierde conexión
    window.addEventListener('offline', () => {
        console.log('⚠️ Sin conexión a internet');
        esModoOffline = true;
    });
    
    // 4. Manejar errores globales (silenciosamente)
    window.addEventListener('error', function(e) {
        console.error('⚠️ Error global capturado:', e.message, 'en', e.filename, 'línea', e.lineno);
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
    } else {
        input.style.borderColor = '#8B7355';
        input.style.boxShadow = 'none';
        input.classList.remove('error');
    }
}

// ==========================================
// VERIFICACIÓN DE ACCESO (SIMPLE)
// ==========================================
function verificarAcceso() {
    const pinInput = document.getElementById('pin-input');
    
    if (!pinInput) {
        alert("Error del sistema. Recargue la página.");
        return;
    }
    
    const entradaPin = pinInput.value;
    
    // Validar que tenga 4 dígitos
    if (entradaPin.length !== 4) {
        alert("El PIN debe tener 4 dígitos");
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
        
    } else {
        // ❌ PIN incorrecto
        alert("PIN Incorrecto. Intente de nuevo.");
        
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
// SISTEMA DE AUDIO SIMPLIFICADO Y ROBUSTO
// ==========================================
function playAudio(archivo) {
    if (!archivo || typeof archivo !== 'string') {
        console.error('❌ Nombre de archivo inválido');
        return;
    }
    
    detenerSonido();
    
    try {
        audioActual = new Audio(archivo);
        
        audioActual.oncanplaythrough = function() {
            console.log('✅ Audio listo:', archivo);
        };
        
        audioActual.onerror = function(e) {
            console.error('❌ Error cargando audio:', archivo, e);
            detenerSonido();
        };
        
        audioActual.onended = function() {
            console.log('⏹️ Audio terminado:', archivo);
            detenerSonido();
        };
        
        const promesaReproduccion = audioActual.play();
        
        if (promesaReproduccion !== undefined) {
            promesaReproduccion
                .then(() => {
                    console.log('🔊 Reproduciendo:', archivo);
                })
                .catch(error => {
                    console.warn('⚠️ Error reproduciendo:', archivo, error);
                    
                    if (error.name === 'NotAllowedError' && esDispositivoApple) {
                        console.log('iOS requiere gesto de usuario para audio');
                    }
                    
                    detenerSonido();
                });
        }
        
    } catch (error) {
        console.error('❌ Error crítico en audio:', error);
        detenerSonido();
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
    alert("📡 Para conectar Bluetooth:\n\n1. Encienda el módulo Bluetooth\n2. Vaya a Configuración de su celular\n3. Bluetooth → Buscar dispositivos\n4. Conéctese al módulo\n\nDespués de parear una vez, se conectará automáticamente.");
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
        console.warn('Error guardando PIN:', error);
    }
    
    alert(`✅ PIN cambiado exitosamente a: ${nuevoPIN}\n\n📝 Nota: Para efecto global en todos los dispositivos, actualice también el archivo remoto:\n${URL_PIN_REMOTO}\n\nLos dispositivos se actualizarán automáticamente al conectarse a internet.`);
}

// ==========================================
// SISTEMA DE AYUDA Y MODAL
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
    window.open('https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf', '_blank', 'noopener,noreferrer');
}

// ==========================================
// FUNCIONES DE VERIFICACIÓN (SOLO DESARROLLO)
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
        } else {
            console.log('✅ Todos los archivos de audio están presentes');
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

console.log('✅ app.js cargado completamente - Sistema listo');
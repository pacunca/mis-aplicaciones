// ==========================================
// CONFIGURACIÓN DE SEGURIDAD Y ESTADO
// ==========================================
let PIN_APP = "1234";               // PIN inicial de entrada
const CLAVE_MAESTRA = "santamaria"; // Clave para configuración
let entradaPin = "";                // Almacena lo que el usuario digita
let audioActual = null;             // Controla el sonido que suena
let dispositivoBluetooth = null;    // Referencia al dispositivo Bluetooth
let servidorGATT = null;            // Servidor GATT conectado
let deferredPrompt = null;          // Para instalación PWA
let conexionActiva = false;         // Estado de conexión Bluetooth
let esDispositivoApple = false;     // Detectar iPhone/iPad

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // Detectar si es dispositivo Apple
    esDispositivoApple = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    // Configurar instalación PWA
    configurarInstalacionPWA();
    
    // Verificar compatibilidad Bluetooth
    verificarCompatibilidadBluetooth();
    
    // Verificar estado Bluetooth inicial
    verificarEstadoBluetooth();
    
    // Verificar si hay MAC guardada
    const macGuardada = localStorage.getItem('macBluetooth');
    if (macGuardada) {
        actualizarEstadoBluetooth('MAC guardada: ' + macGuardada, 'info');
    }
    
    // Configurar cierre de modal al tocar fuera
    document.getElementById('help-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarAyuda();
        }
    });
});

// ==========================================
// COMPROBACIÓN DE COMPATIBILIDAD
// ==========================================
function verificarCompatibilidadBluetooth() {
    const problemas = [];
    
    // 1. Verificar soporte de API Bluetooth
    if (!navigator.bluetooth) {
        problemas.push("❌ Bluetooth Web no soportado en este navegador");
        problemas.push("Use Chrome en Android o Safari en iPhone");
    }
    
    // 2. Verificar si es iPhone/iPad
    if (esDispositivoApple) {
        // Detectar versión de iOS
        const userAgent = navigator.userAgent;
        const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        
        if (match) {
            const versionIOS = parseInt(match[1]);
            if (versionIOS < 13) {
                problemas.push("❌ iPhone/iPad necesita iOS 13 o superior");
                problemas.push("Tu versión: iOS " + versionIOS);
            } else {
                problemas.push("ℹ️ iPhone: Debe seleccionar manualmente el dispositivo Bluetooth");
            }
        } else {
            problemas.push("ℹ️ iPhone/iPad: Bluetooth funciona pero con limitaciones");
        }
        
        // Verificar si es Safari (único navegador con Bluetooth en iOS)
        if (!/Safari/.test(navigator.userAgent) && !/CriOS/.test(navigator.userAgent)) {
            problemas.push("⚠️ En iPhone, use Safari para Bluetooth");
        }
    }
    
    // 3. Verificar Android antiguo
    if (/Android/.test(navigator.userAgent)) {
        const match = navigator.userAgent.match(/Android (\d+)/);
        if (match) {
            const versionAndroid = parseInt(match[1]);
            if (versionAndroid < 6) {
                problemas.push("❌ Android necesita versión 6.0 o superior");
                problemas.push("Tu versión: Android " + versionAndroid);
            }
        }
    }
    
    // Mostrar advertencias si hay problemas
    if (problemas.length > 0) {
        console.warn("Problemas de compatibilidad:", problemas);
        
        // Solo mostrar alerta si es crítico
        const problemasCriticos = problemas.filter(p => p.includes('❌'));
        if (problemasCriticos.length > 0) {
            setTimeout(() => {
                alert("AVISO DE COMPATIBILIDAD:\n\n" + problemasCriticos.join('\n') + 
                      "\n\nAlgunas funciones pueden no estar disponibles.");
            }, 1000);
        }
    }
    
    return problemas;
}

// ==========================================
// INSTALACIÓN PWA (PROMPT DEFERIDO)
// ==========================================
function configurarInstalacionPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Mostrar botón de instalación
        const installContainer = document.getElementById('install-container');
        const installButton = document.getElementById('install-button');
        
        installContainer.classList.remove('hidden');
        
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('Usuario aceptó instalar la PWA');
                installContainer.classList.add('hidden');
            }
            
            deferredPrompt = null;
        });
    });
    
    // Ocultar botón si ya está instalado
    window.addEventListener('appinstalled', () => {
        console.log('PWA instalada');
        document.getElementById('install-container').classList.add('hidden');
        deferredPrompt = null;
    });
}

// ==========================================
// LÓGICA DEL TECLADO TÁCTIL (PANTALLA 1)
// ==========================================
function abrirTeclado() {
    document.getElementById('numpad-overlay').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cerrarTeclado() {
    document.getElementById('numpad-overlay').classList.remove('active');
}

function presionarTecla(numero) {
    if (entradaPin.length < 4) {
        entradaPin += numero;
        actualizarVisor();
    }
}

function borrarTecla() {
    entradaPin = entradaPin.slice(0, -1);
    actualizarVisor();
}

function actualizarVisor() {
    const visor = document.getElementById('pin-display-input');
    visor.value = "●".repeat(entradaPin.length);
}

function verificarAcceso() {
    if (entradaPin === PIN_APP) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('home-screen').classList.remove('hidden');
        cerrarTeclado();
        entradaPin = "";
        
        // Verificar Bluetooth al ingresar
        verificarEstadoBluetooth();
    } else {
        alert("PIN Incorrecto. Intente de nuevo.");
        entradaPin = "";
        actualizarVisor();
    }
}

// ==========================================
// SISTEMA BLUETOOTH (API Web Bluetooth)
// ==========================================
async function verificarEstadoBluetooth() {
    const statusElement = document.getElementById('bluetooth-status');
    const textElement = document.getElementById('bluetooth-status-text');
    
    if (!navigator.bluetooth) {
        actualizarEstadoBluetooth('❌ Bluetooth no soportado', 'error');
        return;
    }
    
    // Advertencia especial para iPhone
    if (esDispositivoApple) {
        actualizarEstadoBluetooth('📱 iPhone: Seleccione dispositivo manualmente', 'info');
        return;
    }
    
    // Verificar si Bluetooth está disponible
    try {
        const disponible = await navigator.bluetooth.getAvailability();
        if (disponible) {
            actualizarEstadoBluetooth('✅ Bluetooth disponible. Listo para conectar.', 'info');
        } else {
            actualizarEstadoBluetooth('⚠️ Encienda el Bluetooth del dispositivo', 'warning');
        }
    } catch (error) {
        actualizarEstadoBluetooth('⚠️ No se pudo verificar Bluetooth', 'warning');
    }
}

function actualizarEstadoBluetooth(mensaje, tipo = 'info') {
    const statusElement = document.getElementById('bluetooth-status');
    const textElement = document.getElementById('bluetooth-status-text');
    
    textElement.textContent = mensaje;
    
    // Remover todas las clases de estado
    statusElement.classList.remove('connected', 'error');
    
    // Aplicar clase según tipo
    if (tipo === 'connected') {
        statusElement.classList.add('connected');
    } else if (tipo === 'error') {
        statusElement.classList.add('error');
    }
}

function validarFormatoMAC(mac) {
    // Formato: XX:XX:XX:XX:XX:XX (hexadecimal)
    const regexMAC = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    return regexMAC.test(mac);
}

async function guardarMAC() {
    const macInput = document.getElementById('mac-input');
    const mac = macInput.value.trim().toUpperCase();
    const savedText = document.getElementById('mac-saved-text');
    
    if (!mac) {
        alert('Por favor ingrese una dirección MAC');
        return;
    }
    
    if (!validarFormatoMAC(mac)) {
        alert('Formato MAC inválido. Use: XX:XX:XX:XX:XX:XX');
        return;
    }
    
    // Guardar en localStorage
    localStorage.setItem('macBluetooth', mac);
    
    // Mostrar confirmación
    savedText.classList.remove('hidden');
    setTimeout(() => {
        savedText.classList.add('hidden');
    }, 3000);
    
    console.log('MAC guardada:', mac);
}

async function probarConexionBT() {
    const macGuardada = localStorage.getItem('macBluetooth');
    
    if (!macGuardada) {
        alert('Primero guarde una dirección MAC en Configuración');
        return;
    }
    
    if (!navigator.bluetooth) {
        alert('Bluetooth no está soportado en este navegador');
        return;
    }
    
    // Advertencia especial para iPhone
    if (esDispositivoApple) {
        const confirmar = confirm(
            'PARA iPhone:\n\n' +
            '1. Bluetooth funcionará pero NO por dirección MAC\n' +
            '2. Debe seleccionar manualmente el dispositivo\n' +
            '3. Asegúrese que el dispositivo esté encendido y cerca\n\n' +
            '¿Continuar?'
        );
        
        if (!confirmar) return;
    }
    
    actualizarEstadoBluetooth('Buscando dispositivo...', 'info');
    
    try {
        // Parámetros de filtro para Bluetooth
        const filtros = [];
        
        // Para iPhone, no podemos filtrar por MAC
        if (macGuardada && !esDispositivoApple) {
            filtros.push({ services: ['battery_service'] }); // Servicio común
        }
        
        // Opciones de conexión
        const opciones = {
            filters: filtros.length > 0 ? filtros : undefined,
            optionalServices: ['battery_service', 'device_information']
        };
        
        // Para iPhone, agregar opción de aceptar todos los dispositivos
        if (esDispositivoApple) {
            opciones.acceptAllDevices = true;
        }
        
        // Solicitar dispositivo al usuario
        dispositivoBluetooth = await navigator.bluetooth.requestDevice(opciones);
        
        // Mensaje para iPhone (selección manual)
        if (esDispositivoApple) {
            actualizarEstadoBluetooth('📱 Conectando a ' + (dispositivoBluetooth.name || 'dispositivo'), 'info');
        }
        
        // Conectar al servidor GATT
        actualizarEstadoBluetooth('Conectando...', 'info');
        servidorGATT = await dispositivoBluetooth.gatt.connect();
        
        conexionActiva = true;
        actualizarEstadoBluetooth('✅ Conectado a ' + (dispositivoBluetooth.name || 'dispositivo Bluetooth'), 'connected');
        
        // Configurar evento de desconexión
        dispositivoBluetooth.addEventListener('gattserverdisconnected', () => {
            conexionActiva = false;
            actualizarEstadoBluetooth('❌ Dispositivo desconectado', 'error');
        });
        
        console.log('Conectado a:', dispositivoBluetooth.name || 'dispositivo sin nombre');
        
    } catch (error) {
        console.error('Error Bluetooth:', error);
        
        if (error.name === 'NotFoundError') {
            actualizarEstadoBluetooth('❌ No se encontró el dispositivo', 'error');
            alert('No se encontró el dispositivo Bluetooth. Asegúrese que:\n1. Está encendido\n2. Está cerca\n3. No está conectado a otro dispositivo');
        } else if (error.name === 'SecurityError') {
            actualizarEstadoBluetooth('❌ Permiso denegado', 'error');
            alert('Permiso de Bluetooth denegado. Por favor acepte los permisos.');
        } else if (error.name === 'NetworkError') {
            actualizarEstadoBluetooth('❌ Error de conexión', 'error');
            alert('Error de conexión. Intente nuevamente.');
        } else if (error.name === 'AbortError') {
            actualizarEstadoBluetooth('⚠️ Búsqueda cancelada', 'warning');
            // No mostrar alerta, usuario canceló
        } else {
            actualizarEstadoBluetooth('❌ Error: ' + error.message, 'error');
            alert('Error Bluetooth: ' + error.message);
        }
        
        conexionActiva = false;
    }
}

async function enviarComandoBluetooth(comando) {
    if (!conexionActiva || !servidorGATT) {
        alert('No hay conexión Bluetooth activa');
        return false;
    }
    
    try {
        // NOTA: Aquí debe implementar el servicio y característica específicos
        // de su dispositivo Bluetooth (módulo de vehículo/1Mii)
        // Este es un ejemplo genérico
        
        /*
        // Ejemplo para módulos HM-10/CC41-A:
        const servicio = await servidorGATT.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
        const caracteristica = await servicio.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
        
        // Convertir comando a ArrayBuffer
        const encoder = new TextEncoder();
        const datos = encoder.encode(comando + '\n');
        
        // Enviar datos
        await caracteristica.writeValue(datos);
        */
        
        console.log('Comando enviado (simulado):', comando);
        
        // Simular éxito para pruebas
        return true;
        
    } catch (error) {
        console.error('Error enviando comando:', error);
        actualizarEstadoBluetooth('❌ Error enviando comando', 'error');
        
        // Si hay error de conexión, marcar como desconectado
        if (error.message.includes('disconnected') || error.message.includes('GATT')) {
            conexionActiva = false;
            actualizarEstadoBluetooth('❌ Dispositivo desconectado', 'error');
        }
        
        return false;
    }
}

// ==========================================
// LÓGICA DE CONFIGURACIÓN
// ==========================================
function intentarConfiguracion() {
    const password = prompt("Ingrese Clave Maestra:");
    if (password === CLAVE_MAESTRA) {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
        
        // Cargar MAC guardada si existe
        const macGuardada = localStorage.getItem('macBluetooth');
        if (macGuardada) {
            document.getElementById('mac-input').value = macGuardada;
        }
    } else if (password !== null) {
        alert("Clave Maestra incorrecta.");
    }
}

function irAHome() {
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
}

function cambiarPinApp() {
    alert("Función en mantenimiento: El cambio de PIN global se configurará con la base de datos.");
}

// ==========================================
// LÓGICA DE AYUDA Y MODAL
// ==========================================
function abrirAyuda() {
    document.getElementById('help-modal').classList.remove('hidden');
}

function cerrarAyuda() {
    document.getElementById('help-modal').classList.add('hidden');
}

function abrirPDF() {
    window.open('https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf', '_blank');
}

// ==========================================
// SISTEMA DE AUDIO Y CAMPANAS
// ==========================================
function actualizarEstadoAudio(mensaje, activo) {
    const statusBox = document.querySelector('.status-bar');
    const statusText = statusBox.querySelector('span');
    
    statusText.innerText = mensaje;
    if (activo) {
        statusBox.style.background = "#D4EDDA";
        statusBox.style.color = "#155724";
        statusBox.style.borderColor = "#c3e6cb";
    } else {
        statusBox.style.background = "#FFF3CD";
        statusBox.style.color = "#856404";
        statusBox.style.borderColor = "rgba(0,0,0,0.05)";
    }
}

function playAudio(archivo) {
    // Detener audio actual si hay
    detenerSonido();
    
    // Primero intentar enviar comando por Bluetooth si está conectado
    if (conexionActiva) {
        const comando = obtenerComandoPorAudio(archivo);
        if (comando) {
            enviarComandoBluetooth(comando);
        }
    }
    
    // También reproducir audio local (para feedback)
    try {
        audioActual = new Audio(archivo);
        actualizarEstadoAudio("🔔 Reproduciendo...", true);
        
        audioActual.play().catch(error => {
            console.warn('Error reproduciendo audio local:', error);
            actualizarEstadoAudio("Audio Bluetooth Listo", false);
            
            // Si no hay audio local, solo usar Bluetooth
            if (error.name === 'NotSupportedError') {
                console.log('Audio no soportado, usando solo Bluetooth');
            }
        });
        
        audioActual.onended = () => {
            detenerSonido();
        };
        
        audioActual.onerror = () => {
            detenerSonido();
            actualizarEstadoAudio("❌ Error en audio", false);
        };
        
    } catch (error) {
        console.error('Error creando audio:', error);
        actualizarEstadoAudio("❌ Error de audio", false);
    }
}

function obtenerComandoPorAudio(nombreArchivo) {
    // Mapear archivos de audio a comandos Bluetooth
    // AJUSTE ESTOS COMANDOS SEGÚN SU DISPOSITIVO
    const comandos = {
        'campana1.mp3': 'CAMPANA1',
        'campana2.mp3': 'CAMPANA2',
        'campana3.mp3': 'CAMPANA3',
        'emergencia.mp3': 'ALARMA'
    };
    
    return comandos[nombreArchivo] || null;
}

/**
 * FUNCIÓN REFORZADA: Detiene audio y limpia recursos
 */
function detenerSonido() {
    if (audioActual) {
        audioActual.pause();
        audioActual.currentTime = 0;
        audioActual.src = "";
        audioActual.load();
        audioActual = null;
    }
    
    // También enviar comando de STOP por Bluetooth
    if (conexionActiva) {
        enviarComandoBluetooth('STOP');
    }
    
    actualizarEstadoAudio("Audio Bluetooth Listo", false);
}

function confirmarEmergencia() {
    if (confirm("⚠️ ADVERTENCIA: ¿Está seguro de activar la alarma?")) {
        playAudio('emergencia.mp3');
    }
}

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================
function cerrarSesion() {
    // Desconectar Bluetooth si está conectado
    if (dispositivoBluetooth && dispositivoBluetooth.gatt.connected) {
        try {
            dispositivoBluetooth.gatt.disconnect();
        } catch (error) {
            console.log('Error al desconectar:', error);
        }
    }
    
    // Limpiar variables
    dispositivoBluetooth = null;
    servidorGATT = null;
    conexionActiva = false;
    
    // Volver a pantalla de login
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Limpiar PIN
    entradaPin = "";
    actualizarVisor();
    
    // Resetear estado Bluetooth
    actualizarEstadoBluetooth("Verificando Bluetooth...", "info");
}

// ==========================================
// MANEJO DE OFFLINE Y ERRORES
// ==========================================
window.addEventListener('online', () => {
    console.log('Aplicación en línea');
});

window.addEventListener('offline', () => {
    console.log('Aplicación offline - Modo local activado');
    actualizarEstadoBluetooth('⚠️ Modo offline - Funciones locales activas', 'warning');
});

// Manejar errores no capturados
window.addEventListener('error', function(e) {
    console.error('Error global:', e.error);
    // No alertar al usuario para no interrumpir
});

// ==========================================
// MODO PRUEBA PARA DISPOSITIVOS SIN BLUETOOTH
// ==========================================
function activarModoPrueba() {
    if (confirm('¿Activar modo de prueba?\n\nSe simulará Bluetooth para probar la interfaz.')) {
        conexionActiva = true;
        actualizarEstadoBluetooth('✅ MODO PRUEBA - Bluetooth simulado', 'connected');
        alert('Modo prueba activado. Los comandos se mostrarán en consola.');
    }
}

// Para probar en navegadores sin Bluetooth, agregar al final:
// if (!navigator.bluetooth) { console.log('Modo prueba disponible - use activarModoPrueba()'); }
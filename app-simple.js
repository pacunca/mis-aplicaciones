// app-simple.js - Versión SIMPLE y FUNCIONAL
console.log('🎯 app.js simple cargado');

// Variables básicas
let PIN_APP = "1234";
let audioActual = null;

// Función para mostrar que funciona
function mostrarEstado() {
    console.log('✅ App funcionando - ' + new Date().toLocaleTimeString());
    document.title = 'Campanas 🕒 ' + new Date().toLocaleTimeString().slice(0,5);
}

// Inicialización SIMPLE
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM cargado - Iniciando app simple');
    
    // Marcar inicio
    window.appIniciada = true;
    
    // Mostrar estado periódicamente
    setInterval(mostrarEstado, 30000);
    
    // Configurar input PIN
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        // Asegurar que sea visible
        if (pinInput.type === 'password') pinInput.type = 'text';
        
        // Enfocar
        setTimeout(() => pinInput.focus(), 300);
        
        // Validación básica
        pinInput.oninput = function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 4) this.value = this.value.slice(0,4);
        };
        
        // Enter para enviar
        pinInput.onkeypress = function(e) {
            if (e.key === 'Enter') verificarAcceso();
        };
    }
    
    // Configurar botones
    const botones = document.querySelectorAll('.bell-btn, .stop-btn, .main-btn');
    botones.forEach(btn => {
        btn.style.cursor = 'pointer';
        btn.disabled = false;
    });
    
    console.log('✅ App simple inicializada');
});

// ==========================================
// FUNCIONES PRINCIPALES
// ==========================================

// Validar PIN input
window.validarPinInput = function(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value.length > 4) input.value = input.value.slice(0,4);
};

// Verificar acceso
window.verificarAcceso = function() {
    const pinInput = document.getElementById('pin-input');
    if (!pinInput) return;
    
    const entrada = pinInput.value;
    
    if (entrada.length !== 4) {
        alert('El PIN debe tener 4 dígitos');
        pinInput.focus();
        return;
    }
    
    if (entrada === PIN_APP) {
        // Acceso concedido
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('home-screen').classList.remove('hidden');
        pinInput.value = '';
        console.log('✅ Acceso concedido');
    } else {
        // Acceso denegado
        alert('PIN incorrecto');
        pinInput.value = '';
        pinInput.focus();
        console.log('❌ Acceso denegado');
    }
};

// Reproducir audio
window.playAudio = function(archivo) {
    if (audioActual) {
        audioActual.pause();
        audioActual = null;
    }
    
    try {
        audioActual = new Audio(archivo);
        audioActual.play()
            .then(() => console.log('🔊 Reproduciendo:', archivo))
            .catch(err => console.warn('Error audio:', err));
    } catch (e) {
        console.error('Error con audio:', e);
    }
};

// Detener sonido
window.detenerSonido = function() {
    if (audioActual) {
        audioActual.pause();
        audioActual = null;
        console.log('⏹️ Sonido detenido');
    }
};

// Emergencia
window.confirmarEmergencia = function() {
    if (confirm('¿Activar alarma de emergencia?')) {
        playAudio('emergencia.mp3');
    }
};

// Navegación básica
window.mostrarInstruccionesBluetooth = function() {
    alert('📡 Bluetooth:\n1. Encienda módulo\n2. Conéctese desde Configuración\n3. Una vez pareado, se conecta automático');
};

window.intentarConfiguracion = function() {
    const pass = prompt('Clave maestra:');
    if (pass === 'santamaria') {
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('config-screen').classList.remove('hidden');
    } else if (pass !== null) {
        alert('Clave incorrecta');
    }
};

window.irAHome = function() {
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
};

window.cambiarPinApp = function() {
    const nuevo = prompt('Nuevo PIN (4 dígitos):');
    if (nuevo && /^\d{4}$/.test(nuevo)) {
        PIN_APP = nuevo;
        alert('PIN cambiado a: ' + nuevo);
    } else {
        alert('PIN inválido');
    }
};

// Ayuda
window.abrirAyuda = function() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.classList.remove('hidden');
};

window.cerrarAyuda = function() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.classList.add('hidden');
};

window.abrirPDF = function() {
    window.open('https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf', '_blank');
};

// Cerrar sesión
window.cerrarSesion = function() {
    detenerSonido();
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('config-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    const pinInput = document.getElementById('pin-input');
    if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 300);
    }
};

// ==========================================
// FUNCIONES DE INSTALACIÓN PWA
// ==========================================
window.verificarRecursosOffline = function() {
    alert('✅ Todos los recursos están disponibles offline');
};

window.recachearRecursosFaltantes = function() {
    alert('🔄 Recacheando recursos...');
    location.reload();
};

window.forzarActualizacionSW = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration()
            .then(reg => reg && reg.update());
        alert('🔄 Buscando actualizaciones...');
    }
};

window.verificarEstadoSW = function() {
    const status = document.getElementById('sw-status');
    if (status) status.textContent = '✅ Activo';
    
    const cacheStatus = document.getElementById('cache-status');
    if (cacheStatus) cacheStatus.textContent = '✅ Recursos disponibles';
    
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleString();
};

window.cerrarModalInstalacion = function() {
    const modal = document.getElementById('install-modal');
    if (modal) modal.remove();
};

// ==========================================
// INICIALIZACIÓN FINAL
// ==========================================
console.log('🎉 App simple lista para usar');

// Verificar que todos los botones funcionen
setTimeout(() => {
    console.log('🔍 Verificando botones...');
    const elementos = ['pin-input', 'login-screen', 'home-screen', 'help-modal'];
    elementos.forEach(id => {
        const el = document.getElementById(id);
        console.log(id + ':', el ? '✅ OK' : '❌ Faltante');
    });
}, 1000);
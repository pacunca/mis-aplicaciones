// ==========================================
// CONFIGURACIÓN DE SEGURIDAD Y ESTADO
// ==========================================
let PIN_APP = "1234";               // PIN inicial de entrada
const CLAVE_MAESTRA = "santamaria"; // Clave para configuración
let entradaPin = "";                // Almacena lo que el usuario digita
let audioActual = null;             // Controla el sonido que suena

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
    } else {
        alert("PIN Incorrecto. Intente de nuevo.");
        entradaPin = "";
        actualizarVisor();
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
// SISTEMA DE REPRODUCCIÓN Y PARADA REFORZADA
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
    // Si ya hay algo sonando, lo destruimos antes de empezar el nuevo
    detenerSonido();
    
    audioActual = new Audio(archivo);
    actualizarEstadoAudio("🔔 Reproduciendo...", true);
    
    audioActual.play().catch(error => {
        actualizarEstadoAudio("Audio Bluetooth Listo", false);
        alert("Error: Verifique la conexión Bluetooth.");
    });

    audioActual.onended = () => {
        detenerSonido();
    };
}

/**
 * FUNCIÓN REFORZADA: Se asegura de detener el audio y 
 * vaciar la memoria con un solo clic.
 */
function detenerSonido() {
    if (audioActual) {
        audioActual.pause();
        audioActual.currentTime = 0;
        audioActual.src = ""; // Vacía el archivo cargado
        audioActual.load();   // Fuerza al navegador a liberar el recurso
        audioActual = null;   // Limpia la variable
    }
    actualizarEstadoAudio("Audio Bluetooth Listo", false);
}

function confirmarEmergencia() {
    if (confirm("⚠️ ADVERTENCIA: ¿Está seguro de activar la alarma?")) {
        playAudio('emergencia.mp3');
    }
}
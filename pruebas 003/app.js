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
// LÓGICA DE CONFIGURACIÓN (CLAVE MAESTRA)
// ==========================================

function intentarConfiguracion() {
    const password = prompt("Ingrese Clave Maestra para Configuración:");
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
    const actual = document.getElementById('pin-actual').value;
    const nuevo = document.getElementById('pin-nuevo').value;
    const confirma = document.getElementById('pin-confirma').value;

    if (actual === PIN_APP) {
        if (nuevo === confirma && nuevo.length >= 4) {
            PIN_APP = nuevo;
            alert("ÉXITO: El PIN de la App ha sido cambiado.");
            irAHome();
        } else {
            alert("Error: El nuevo PIN no coincide o es muy corto.");
        }
    } else {
        alert("Error: El PIN actual es incorrecto.");
    }
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

// Abre el archivo PDF de instrucciones desde el enlace externo de GitHub
function abrirPDF() {
    const link = document.createElement('a');
    // Enlace directo configurado para descarga
    link.href = 'https://pacunca.github.io/mis-aplicaciones/instrucciones.pdf';
    link.download = 'Instrucciones_Campanas.pdf'; 
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// SISTEMA DE REPRODUCCIÓN Y ESTADO DE AUDIO
// ==========================================

// Actualiza visualmente la barra de estado (Indicador Bluetooth)
function actualizarEstadoAudio(mensaje, activo) {
    const statusBox = document.querySelector('.status-bar');
    const statusText = statusBox.querySelector('span');
    
    statusText.innerText = mensaje;
    if (activo) {
        statusBox.style.background = "#D4EDDA"; // Verde si suena
        statusBox.style.color = "#155724";
    } else {
        statusBox.style.background = "#FFF3CD"; // Amarillo/Original
        statusBox.style.color = "#856404";
    }
}

function playAudio(archivo) {
    if (audioActual) {
        audioActual.pause();
        audioActual.currentTime = 0;
    }
    
    audioActual = new Audio(archivo);
    actualizarEstadoAudio("🔔 Reproduciendo...", true);
    
    audioActual.play().catch(error => {
        console.error("Error al reproducir:", archivo);
        actualizarEstadoAudio("Audio Bluetooth Listo", false);
        alert("Error: No se pudo reproducir el audio. Verifique su conexión Bluetooth.");
    });

    // Al finalizar el audio, la barra vuelve al estado original
    audioActual.onended = () => {
        actualizarEstadoAudio("Audio Bluetooth Listo", false);
    };
}

function detenerSonido() {
    if (audioActual) {
        audioActual.pause();
        audioActual.currentTime = 0;
        actualizarEstadoAudio("Audio Bluetooth Listo", false);
    }
}

// Lógica de seguridad para el botón de emergencia
function confirmarEmergencia() {
    const respuesta = confirm("⚠️ ADVERTENCIA: ¿Está seguro de que desea activar la alarma de EMERGENCIA? Esto notificará a toda la comunidad.");
    
    if (respuesta) {
        playAudio('emergencia.mp3');
    }
}
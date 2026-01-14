// ==========================================
// DETECCIÓN Y RECOMENDACIÓN DE NAVEGADOR PWA
// ==========================================

function evaluarCompatibilidadPWA() {
    const userAgent = navigator.userAgent.toLowerCase();
    let navegador = 'desconocido';
    let problema = '';
    let recomendacion = '';
    let esCompatible = false;
    
    // Detectar navegador exacto
    if (userAgent.includes('samsungbrowser')) {
        navegador = 'samsung';
        problema = 'Samsung Internet tiene soporte PWA limitado. Solo crea accesos directos, no apps instalables.';
        recomendacion = 'Google Chrome';
        esCompatible = false;
    }
    else if (userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('opr')) {
        navegador = 'chrome';
        problema = '';
        recomendacion = '';
        esCompatible = true;
    }
    else if (userAgent.includes('firefox')) {
        navegador = 'firefox';
        problema = 'Firefox para Android tiene soporte PWA básico.';
        recomendacion = 'Google Chrome para mejor experiencia';
        esCompatible = true;
    }
    else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        navegador = 'safari';
        problema = '';
        recomendacion = '';
        esCompatible = true; // Safari iOS sí soporta PWA bien
    }
    else if (userAgent.includes('edge')) {
        navegador = 'edge';
        problema = 'Microsoft Edge puede tener comportamiento inconsistente.';
        recomendacion = 'Google Chrome';
        esCompatible = true;
    }
    else {
        navegador = 'desconocido';
        problema = 'Navegador no reconocido o muy antiguo.';
        recomendacion = 'Google Chrome (Android) o Safari (iPhone)';
        esCompatible = false;
    }
    
    return {
        navegador,
        problema,
        recomendacion,
        esCompatible,
        esIOS: /iphone|ipad|ipod/.test(userAgent),
        esAndroid: /android/.test(userAgent)
    };
}

function mostrarRecomendacionNavegador() {
    const info = evaluarCompatibilidadPWA();
    
    // Solo mostrar si NO es compatible o tiene problemas
    if (!info.esCompatible || info.problema) {
        // Esperar a que la app cargue
        setTimeout(() => {
            let mensaje = `🔍 DETECTADO: ${info.navegador.toUpperCase()}\n\n`;
            
            if (info.problema) {
                mensaje += `⚠️ ${info.problema}\n\n`;
            }
            
            mensaje += `📱 RECOMENDACIÓN:\n`;
            
            if (info.esAndroid) {
                mensaje += `• Instale GOOGLE CHROME desde Play Store\n`;
                mensaje += `• Abra esta app en Chrome\n`;
                mensaje += `• Toque ⋮ (3 puntos) → "Instalar app"\n\n`;
                mensaje += `✅ Chrome ofrece experiencia de app completa.`;
            } 
            else if (info.esIOS) {
                mensaje += `• Use SAFARI (ya instalado en iPhone)\n`;
                mensaje += `• Toque 📤 (Compartir)\n`;
                mensaje += `• Deslice → "Agregar a Inicio"\n\n`;
                mensaje += `✅ Safari instalará como app nativa.`;
            }
            else {
                mensaje += `• Para Android: Google Chrome\n`;
                mensaje += `• Para iPhone: Safari\n\n`;
                mensaje += `✅ Estos navegadores soportan apps instalables.`;
            }
            
            // Mostrar solo una vez por sesión
            if (!sessionStorage.getItem('mostradaRecomendacion')) {
                alert(mensaje);
                sessionStorage.setItem('mostradaRecomendacion', 'true');
            }
        }, 3000); // Esperar 3 segundos después de cargar
    }
}

// ==========================================
// INSTRUCCIONES DE INSTALACIÓN MEJORADAS
// ==========================================

function mostrarInstruccionesInstalacionInteligente() {
    const info = evaluarCompatibilidadPWA();
    
    if (info.navegador === 'samsung') {
        alert(
            "📱 PARA SAMSUNG INTERNET:\n\n" +
            "1. Toque ☰ (3 líneas ABAJO derecha)\n" +
            "2. Toque 'Agregar página a'\n" +
            "3. Toque 'Pantalla de inicio'\n\n" +
            "⚠️ LIMITACIÓN: Solo acceso directo\n\n" +
            "💡 PARA APP COMPLETA:\n" +
            "• Instale Google Chrome\n" +
            "• Abra esta app en Chrome\n" +
            "• Toque ⋮ (3 puntos) → 'Instalar app'"
        );
    }
    else if (info.esIOS) {
        alert(
            "📱 PARA iPHONE (Safari):\n\n" +
            "1. Toque 📤 (COMPARTIR)\n" +
            "   (cuadrado con flecha arriba)\n\n" +
            "2. Deslice HACIA ABAJO en el menú\n\n" +
            "3. Toque ⭐ 'AGREGAR A INICIO'\n\n" +
            "4. Toque 'AGREGAR' (arriba derecha)\n\n" +
            "✅ Se instalará como app nativa."
        );
    }
    else {
        // Para Chrome/Firefox/Edge Android
        alert(
            "📱 PARA INSTALAR COMO APP:\n\n" +
            "1. Toque ⋮ (3 puntos ARRIBA derecha)\n" +
            "   (En Firefox: 3 puntos ABAJO derecha)\n\n" +
            "2. Busque y toque:\n" +
            "   ⭐ 'INSTALAR CAMPANAS'\n" +
            "   o 'AGREGAR A PANTALLA DE INICIO'\n\n" +
            "3. Confirme la instalación\n\n" +
            "✅ Se abrirá como app independiente."
        );
    }
}

// ==========================================
// INTEGRAR EN LA INICIALIZACIÓN
// ==========================================

// En tu DOMContentLoaded, añadir:
document.addEventListener('DOMContentLoaded', function() {
    // ... tu código existente ...
    
    // Mostrar recomendación si es necesario
    setTimeout(mostrarRecomendacionNavegador, 5000); // 5 segundos después
    
    // Configurar botones de instalación con inteligencia
    setTimeout(() => {
        const installButton = document.getElementById('install-button');
        const installLoginButton = document.getElementById('install-login-button');
        
        if (installButton) {
            installButton.onclick = mostrarInstruccionesInstalacionInteligente;
        }
        if (installLoginButton) {
            installLoginButton.onclick = mostrarInstruccionesInstalacionInteligente;
        }
    }, 1000);
});
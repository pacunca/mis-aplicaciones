// sw.js - MÍNIMO Y FUNCIONAL
self.addEventListener('install', function(e) {
    console.log('PWA Campanas instalada');
});

self.addEventListener('fetch', function(e) {
    // Permitir todas las peticiones normalmente
    e.respondWith(fetch(e.request));
});
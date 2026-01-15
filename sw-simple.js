// sw-simple.js - Service Worker SUPER SIMPLE
const CACHE_NAME = 'campanas-simple-v1';

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando versión simple');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activando');
    event.waitUntil(self.clients.claim());
});

// NO interceptar fetch - dejar todo pasar directo
// Esto evita congelamientos
// =====================================================
// SERVICE WORKER — App Shell Caching
// =====================================================
// This caches the STATIC files (HTML/CSS/JS/icons) so the app
// can load even with no internet connection. Firestore handles
// its OWN offline caching for actual student/class DATA
// separately (enabled in firebase-config.js).
//
// Bump CACHE_NAME any time you update the cached files below,
// otherwise returning users will keep seeing the old cached version.
// =====================================================
const CACHE_NAME = "student-id-app-v1";

const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./picker.html",
  "./style.css",
  "./app.js",
  "./picker.js",
  "./firebase-config.js",
  "./manifest.json"
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network.
// Firestore/Firebase Auth requests (firestore.googleapis.com,
// identitytoolkit.googleapis.com, etc.) are NOT intercepted here —
// they go straight to the network so Firebase's own offline
// queueing/sync logic can do its job uninterrupted.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Let all Firebase/Google API calls pass through untouched.
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // If both cache and network fail (e.g. offline + uncached page),
        // fall back to the main app shell so the app still opens.
        return caches.match("./index.html");
      });
    })
  );
});
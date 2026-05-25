const CACHE = "wenlan-v1"
const URLS = ["/", "/business"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(URLS))
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.url.startsWith("chrome-extension://")) return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      return cached || fetchPromise
    })
  )
})

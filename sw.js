// mdvim Service Worker v0.4
const CACHE_NAME = 'mdvim-v0.4';
const ASSETS_TO_CACHE = [
  './',
  './mdvim-jp.html',
  './mdvim.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // 分割版日本語
  './jp/',
  './jp/index.html',
  './jp/manifest.json',
  './jp/css/style.css',
  './jp/js/app.js',
  './jp/js/vim-editor.js',
  './jp/js/markdown-parser.js',
  // 分割版英語
  './en/',
  './en/index.html',
  './en/manifest.json',
  './en/css/style.css',
  './en/js/app.js',
  './en/js/vim-editor.js',
  './en/js/markdown-parser.js'
];

// 外部リソース（オプショナル）
const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // 外部リソースは失敗しても続行
        return caches.open(CACHE_NAME).then(cache => {
          return Promise.allSettled(
            EXTERNAL_ASSETS.map(url => 
              cache.add(url).catch(err => console.log('[SW] Optional cache failed:', url))
            )
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// フェッチ時の戦略: Cache First, Network Fallback
self.addEventListener('fetch', event => {
  // POSTリクエストはキャッシュしない
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // キャッシュがあればそれを返す
          return cachedResponse;
        }

        // キャッシュがなければネットワークから取得
        return fetch(event.request)
          .then(response => {
            // 有効なレスポンスのみキャッシュ
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // オフラインでキャッシュもない場合
            console.log('[SW] Fetch failed, no cache available');
          });
      })
  );
});

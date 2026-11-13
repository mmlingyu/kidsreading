# 最后的孩子 · 儿童英语分级阅读

Static site. Open `index.html` through a web server. There is no build step, package manager, backend, or environment file.

Hash routes, handled in the browser:

- `#/home` bookshelf
- `#/book/:id` switches the active book, then opens its map
- `#/map`
- `#/read/:id`
- `#/game/:id`

Two ready books are registered in `data/bookshelf.js`: The Last Kids on Earth (`tlkoe`, 8 chapters) and Mister Shivers (`mister-shivers`, 6 chapters, scenes 101–106). Progress is stored per book. A third shelf slot is marked coming soon.

Progress stays in `localStorage`. English reading defaults to offline Phonon (`af_maple`); Chinese guidance uses `zf_001`. Both run in a browser worker from same-origin files. Browser speech is a visible fallback only. Music and effects stay on the existing Web Audio graph. Nothing is uploaded.

The Kokoro model is about 324 MB and is not in git. See `tts/model-spec.js`. Copy it and the ONNX Runtime `.wasm` files onto this site before expecting offline speech. Do not point the app at another site.

## Local static server

From this directory:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`. ES modules do not load reliably from a `file://` URL.

Any other static server is fine. Do not put a Node application server in front of these files.

## Deploy

Publish the files in this directory as the site root. `index.html` must be at the root, with `assets/` and `vendor/` beside it. Do not keep an extra `app/` directory in the URL path.

The production host for this copy is `https://kidsreading.abaog.com`, with its own document root `/var/www/kidsreading`. Unpack the static tree there and leave every other site on the machine untouched.

## Nginx

Use a dedicated `server` for `kidsreading.abaog.com` only. Do not reuse another site's `root` or `alias`.

```nginx
server {
    listen 80;
    server_name kidsreading.abaog.com;
    root /var/www/kidsreading;
    index index.html;
    charset utf-8;
    autoindex off;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Force the module MIME type in this location only.
    # An empty types map keeps this from replacing css and image types on the rest of the server.
    location ~* \.m?js$ {
        types { }
        default_type application/javascript;
        try_files $uri =404;
        expires 1h;
    }

    location ~* \.(css|png|jpe?g|gif|svg|webp|woff2?)$ {
        try_files $uri =404;
        expires 1h;
    }

    location ~* \.wasm$ {
        types { }
        default_type application/wasm;
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location ~* \.(onnx|bin)$ {
        types { }
        default_type application/octet-stream;
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Requirements:

- The `http` block already has `include mime.types;`. Do not replace that map with a one-line `types` block.
- `root` is `/var/www/kidsreading` and that directory contains `index.html` directly.
- JavaScript must be served as `application/javascript`. ES modules fail when the type is `text/plain`.
- Hash routes never reach Nginx. Do not rewrite `#/read/1` or proxy these files to an application server.
- Asset locations return 404 for a missing file. They must not fall through to `index.html`.
- Files need to be readable by the Nginx user. No secrets, certificates, or environment variables belong in this tree.
- TLS for `kidsreading.abaog.com` stays on the certificate already issued for that name. Add `listen 443 ssl` and the existing certificate directives on this server only. Do not copy another vhost's certificate paths.
- Do not add analytics, an external text-to-speech service, or a reverse proxy to Node.

## Credits already in the source

The home view states that the reading text is an original simplified retelling, that chapter art is AI-generated, and that pixel effects come from pixelfx. Those notices, plus `vendor/pixelfx/LICENSE` and `vendor/pixelfx/NOTICE.md`, are kept as they arrived. This repository does not add a license for the app or the reading text.

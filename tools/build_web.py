#!/usr/bin/env python3
"""يبني النسخة المستقلة web/ من المصدر المشترك claude-version/index.html.

المصدر واحد: كل تعديل على البرنامج يُكتب في claude-version/index.html، ثم:
    python3 tools/build_web.py
فتتحدّث web/ تلقائياً (وتنشرها Cloudflare Pages عند الرفع إلى main).
"""
import pathlib, shutil, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'claude-version'
WS = ROOT / 'web-src'
OUT = ROOT / 'web'

html = (SRC / 'index.html').read_text(encoding='utf-8')

marker = '<script>\n"use strict";'
if html.count(marker) != 1:
    sys.exit('build_web: main <script> marker not found exactly once')
inject = ('<script>window.ENJAZ_WEB=true;window.ENJAZ_READY=new Promise(function(r){window.__enjazReady=r});</script>\n'
          '<script type="module" src="firebase-shim.js"></script>\n')
html = html.replace(marker, inject + marker)

# رابط المنصة في رسائل التذكير = رابط الموقع نفسه.
html, n = re.subn(r"const APP_URL='[^']*';", "const APP_URL=location.origin+location.pathname;", html)
if n != 1:
    sys.exit('build_web: APP_URL not found')
html = html.replace('حساب Claude: ', 'الحساب: ')

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
(OUT / 'index.html').write_text(html, encoding='utf-8')
for f in ('pdfjs.min.js', 'pdfjs.worker.min.js'):
    shutil.copy(SRC / f, OUT / f)
for f in WS.iterdir():
    shutil.copy(f, OUT / f.name)
print('built', OUT)

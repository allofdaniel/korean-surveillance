"""Full text of every chart page (text layer, or OCR for image-only pages), cached by file hash.

Used to verify that a procedure / fix / radial really appears on the current AIP charts.
"""
from __future__ import annotations
import os, re, json
import pymupdf as fitz
import pytesseract
from .ocr_tables import render

def _cache_dir():
    from .build import CACHE_DIR
    return CACHE_DIR

def page_texts(path: str):
    from .build import sha
    key = os.path.join(_cache_dir(), sha(path) + '.corpus.json')
    if os.path.exists(key):
        try:
            return json.load(open(key, encoding='utf-8'))
        except Exception:
            pass
    out = []
    for i, p in enumerate(fitz.open(path)):
        t = p.get_text('text')
        src = 'text'
        if len(t.strip()) < 200 and 'INTENTIONALLY LEFT BLANK' not in t:
            try:
                t = pytesseract.image_to_string(render(p, 250), config='--psm 11')
                src = 'ocr'
            except Exception:
                pass
        out.append({'page': i + 1, 'src': src, 'text': t})
    try:
        os.makedirs(_cache_dir(), exist_ok=True)
        json.dump(out, open(key, 'w', encoding='utf-8'), ensure_ascii=False)
    except Exception:
        pass
    return out

def airport_corpus(files):
    pages = []
    for f in files:
        if not f.lower().endswith('.pdf'):
            continue
        for pg in page_texts(f):
            t = pg['text'] or ''
            pages.append({'file': os.path.basename(f), 'path': f, 'page': pg['page'], 'src': pg['src'],
                          'text': t, 'norm': norm(t), 'is_text_doc': '-TEXT' in os.path.basename(f).upper()})
    return pages

def norm(t: str) -> str:
    t = (t or '').upper().replace('˚', '°').replace('º', '°')
    return re.sub(r'\s+', ' ', t)

def ocr_page(pg):
    """OCR a chart page that has a partial text layer (labels drawn as vector outlines); cached."""
    from .build import sha
    if pg.get('src') == 'ocr' or pg.get('ocr_done'):
        return pg
    key = os.path.join(_cache_dir(), f"{sha(pg['path'])}.p{pg['page']}.ocr.txt")
    if os.path.exists(key):
        t = open(key, encoding='utf-8').read()
    else:
        t = pytesseract.image_to_string(render(fitz.open(pg['path'])[pg['page'] - 1], 250), config='--psm 11')
        try:
            open(key, 'w', encoding='utf-8').write(t)
        except Exception:
            pass
    pg['text'] = pg['text'] + '\n' + t
    pg['norm'] = norm(pg['text'])
    pg['ocr_done'] = True
    return pg

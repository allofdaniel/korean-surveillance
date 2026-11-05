"""Identify AIP documents/pages and extract raw tables + text."""
from __future__ import annotations
import re
import pymupdf as fitz
from .ocr_tables import read_page_tables, header_text, render
import pytesseract

CHART_RE = re.compile(r'\b(RK[A-Z]{2})\s*AD\s*CHART\s*([0-9](?:\s*-\s*[0-9]+){1,2})')
DATE_RE = re.compile(r'\b(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+20\d{2})\b')
AMDT_RE = re.compile(r'((?:AIRAC\s+)?AIP\s+AMDT\s+\d+/\d+)')
EFF_RE = re.compile(r'Effective\s*:\s*([0-9]{4}UTC\s+\d{1,2}\s+[A-Z]{3}\s+20\d{2})')
TEXT_RE = re.compile(r'\b(RK[A-Z]{2})\s+AD\s+2\.1\b')

def page_meta(page) -> dict:
    hdr = header_text(page)
    if 'RWY' not in hdr.upper() and len(page.get_text('text').strip()) < 200:
        g = render(page, 300)
        h, w = g.shape
        hdr += ' ' + pytesseract.image_to_string(g[int(h * 0.05): int(h * 0.16), int(w * 0.6):], config='--psm 6')
    full_txt = page.get_text('text')
    footer = full_txt[-400:] if full_txt.strip() else ''
    m = CHART_RE.search(hdr) or CHART_RE.search(full_txt)
    chart = re.sub(r'\s+', '', m.group(2)) if m else None
    icao = m.group(1) if m else None
    d = DATE_RE.search(hdr) or DATE_RE.search(full_txt)
    a = AMDT_RE.search(footer) or AMDT_RE.search(full_txt)
    e = EFF_RE.search(full_txt)
    return {'icao': icao, 'chart': chart, 'date': d.group(1) if d else None,
            'amdt': a.group(1) if a else None, 'effective': e.group(1) if e else None,
            'header': hdr, 'has_text': len(full_txt.strip()) > 200}

def is_tabulation(meta) -> bool:
    h = (meta['header'] or '').upper()
    return 'TABULATION' in h or 'CODING' in h or (meta['chart'] or '').count('-') == 2

def ocr_page_text(page, dpi=300) -> str:
    if len(page.get_text('text').strip()) > 200:
        return page.get_text('text')
    return pytesseract.image_to_string(render(page, dpi), config='--psm 4')

def iter_pages(path: str):
    doc = fitz.open(path)
    for i, page in enumerate(doc):
        yield i, page

def classify_pdf(path: str) -> str:
    doc = fitz.open(path)
    t = ''.join(doc[i].get_text('text') for i in range(min(2, len(doc))))
    if TEXT_RE.search(t) or 'AERODROME LOCATION INDICATOR' in t:
        return 'AD2_TEXT'
    return 'CHARTS'

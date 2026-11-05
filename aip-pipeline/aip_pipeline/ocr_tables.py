"""Table extraction from AIP chart pages.

Works for pages whose text is real text (pdfplumber words) and for pages whose
text is outlined vector glyphs (rendered + OCR per cell).
"""
from __future__ import annotations
import re
import pymupdf as fitz
import cv2
import numpy as np
import pytesseract

DPI = 300

def render(page: fitz.Page, dpi: int = DPI) -> np.ndarray:
    pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)

def _grid_mask(gray: np.ndarray):
    bw = cv2.adaptiveThreshold(255 - gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, -2)
    h, w = bw.shape
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, w // 60), 1))
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(20, h // 60)))
    hl = cv2.dilate(cv2.erode(bw, hk), hk)
    vl = cv2.dilate(cv2.erode(bw, vk), vk)
    return hl, vl

def find_tables(gray: np.ndarray, min_cells: int = 4):
    """Return list of tables; each table = list of rows; row = list of cell boxes (x,y,w,h)."""
    hl, vl = _grid_mask(gray)
    grid = cv2.bitwise_or(hl, vl)
    grid = cv2.dilate(grid, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(grid, 8)
    tables = []
    H, W = gray.shape
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if (w < W * 0.06 and h < H * 0.06) or w < 40 or h < 40:
            continue
        sub = (labels[y:y + h, x:x + w] == i).astype(np.uint8) * 255
        inv = 255 - sub
        m, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
        cells = []
        for j in range(1, m):
            cx, cy, cw, ch, ca = st2[j]
            if cx == 0 and cy == 0 and (cw >= w - 2 or ch >= h - 2):
                continue  # outside region
            if cw < 12 or ch < 12 or cw > w * 0.98 and ch > h * 0.9:
                continue
            cells.append((x + cx, y + cy, cw, ch))
        if len(cells) >= min_cells:
            tables.append({'bbox': (x, y, w, h), 'cells': cells})
    return tables

def _rows_cols(cells, rotated: bool):
    """Group cells into rows. For rotated (landscape-on-portrait) tables, a 'row' is a column of the image."""
    key_r = (lambda c: c[0] + c[2] / 2) if rotated else (lambda c: c[1] + c[3] / 2)
    key_c = (lambda c: -(c[1] + c[3] / 2)) if rotated else (lambda c: c[0] + c[2] / 2)
    size = (lambda c: c[2]) if rotated else (lambda c: c[3])
    cells = sorted(cells, key=key_r)
    rows, cur, last = [], [], None
    for c in cells:
        k = key_r(c)
        if last is not None and abs(k - last) > max(8, size(c) * 0.45):
            rows.append(sorted(cur, key=key_c)); cur = []
        cur.append(c); last = k if last is None else (last + k) / 2 if cur and len(cur) > 1 else k
    if cur:
        rows.append(sorted(cur, key=key_c))
    return rows

_CFG = '--psm 7 -c preserve_interword_spaces=1'

def pdf_cell_text(page, box, dpi=DPI) -> str:
    k = 72.0 / dpi
    x, y, w, h = box
    r = fitz.Rect(x * k, y * k, (x + w) * k, (y + h) * k)
    t = page.get_text('text', clip=r)
    return re.sub(r'\s+', ' ', t).strip()

def ocr_cell(gray, box, rotated: bool, pad: int = 4, multiline: bool = False) -> str:
    x, y, w, h = box
    crop = gray[max(0, y + pad):y + h - pad, max(0, x + pad):x + w - pad]
    if crop.size == 0:
        return ''
    if rotated:
        crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
        if multiline or crop.shape[0] > crop.shape[1] * 1.6:  # multi-line cell
            return _ocr(crop, '--psm 6')
    elif crop.shape[0] > 70:  # tall cell → may be 2 lines
        return _ocr(crop, '--psm 6')
    return _ocr(crop, _CFG)

def _ocr(img, cfg):
    img = cv2.copyMakeBorder(img, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
    t = pytesseract.image_to_string(img, lang='eng', config=cfg)
    return re.sub(r'\s+', ' ', t).strip()

def table_is_rotated(cells) -> bool:
    ws = np.median([c[2] for c in cells]); hs = np.median([c[3] for c in cells])
    return hs > ws * 1.3

def read_page_tables(page: fitz.Page, dpi: int = DPI):
    gray = render(page, dpi)
    has_text = len(page.get_text('text').strip()) > 200
    out = []
    for t in find_tables(gray):
        rot = table_is_rotated(t['cells'])
        rows = _rows_cols(t['cells'], rot)
        if has_text:
            data = [[pdf_cell_text(page, c, dpi) for c in r] for r in rows]
        else:
            data = [[ocr_cell(gray, c, rot, multiline=(rot and len(r) >= 12 and j in (7, 8, 12))) for j, c in enumerate(r)] for r in rows]
        title = ocr_title(gray, t['bbox'], rot)
        out.append({'bbox': t['bbox'], 'rotated': rot, 'title': title, 'rows': data})
    return out, gray

def ocr_title(gray, bbox, rotated: bool) -> str:
    x, y, w, h = bbox
    if rotated:  # title sits to the left of the table (above in reading orientation)
        crop = gray[y:y + h, max(0, x - 70):x]
        crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
    else:
        crop = gray[max(0, y - 70):y, x:x + w]
    return _ocr(crop, '--psm 6') if crop.size else ''

def header_text(page: fitz.Page) -> str:
    t = page.get_text('text', clip=fitz.Rect(0, 0, page.rect.width, page.rect.height * 0.14))
    if len(t.strip()) > 20:
        return re.sub(r'\s+', ' ', t).strip()
    gray = render(page, 200)
    top = gray[: int(gray.shape[0] * 0.12), :]
    return _ocr(top, '--psm 6')

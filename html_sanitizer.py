"""Serverseitige Allowlist-Bereinigung für Fragen-/Lösungs-HTML.

Der WYSIWYG-Editor bereinigt nur im Browser. Wer die JSON-Routen direkt
aufruft (oder über Import/KI Inhalte einspielt), konnte bisher beliebiges HTML
speichern, das anschließend per ``innerHTML`` bei allen Kolleg:innen landet.
Dieses Modul bildet die Allowlist von ``static/js/wysiwyg.js`` auf dem Server
nach und kommt ohne Zusatzabhängigkeit aus (nur Standardbibliothek).
"""

from html import escape
from html.parser import HTMLParser

ALLOWED_TAGS = frozenset({
    "b", "strong", "i", "em", "u",
    "br", "p", "div", "span",
    "ul", "ol", "li",
    "sub", "sup",
    "a",
})
VOID_TAGS = frozenset({"br"})
# Inhalt dieser Elemente wird komplett verworfen (nicht nur das Tag).
DROP_CONTENT_TAGS = frozenset({
    "script", "style", "iframe", "object", "embed", "template",
    "noscript", "svg", "math", "textarea", "select", "title", "head",
})
SAFE_HREF_PREFIXES = ("http://", "https://", "mailto:", "/")


def _looks_like_html(value: str) -> bool:
    """True, sobald etwas Tag-artiges vorkommt (``<x``, ``</``, ``<!``, ``<?``)."""
    for idx, ch in enumerate(value):
        if ch == "<" and idx + 1 < len(value):
            nxt = value[idx + 1]
            if nxt.isalpha() or nxt in "/!?":
                return True
    return False


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            if tag not in VOID_TAGS:
                self.drop_depth += 1
            return
        if self.drop_depth or tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = ""
            for name, value in attrs:
                if name.lower() == "href" and value:
                    candidate = value.strip()
                    lowered = candidate.lower()
                    # "//host" und "/\host" wären protokollrelativ, also extern.
                    if lowered.startswith(SAFE_HREF_PREFIXES) and not lowered.startswith(("//", "/\\")):
                        href = candidate
            if href:
                self.out.append(f'<a href="{escape(href, quote=True)}" rel="noopener noreferrer">')
            else:
                self.out.append("<a>")
            return
        self.out.append(f"<{tag}>")

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if tag in VOID_TAGS and not self.drop_depth:
            self.out.append(f"<{tag}>")
        elif tag not in DROP_CONTENT_TAGS:
            self.handle_starttag(tag, attrs)
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            if self.drop_depth:
                self.drop_depth -= 1
            return
        if self.drop_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.drop_depth:
            self.out.append(escape(data, quote=False))

    # Kommentare, Doctype, Processing Instructions werden verworfen.
    def handle_comment(self, data):
        pass

    def handle_decl(self, decl):
        pass

    def handle_pi(self, data):
        pass

    def unknown_decl(self, data):
        pass


def sanitize_html(value) -> str:
    """Bereinigt HTML auf die Editor-Allowlist.

    Reiner Text ohne Tags bleibt unverändert, damit Klartext-Antworten
    (z. B. ``pH < 7``) und der Word-Export sich nicht verändern.
    """
    if value is None:
        return ""
    text = str(value)
    if not _looks_like_html(text):
        return text
    parser = _Sanitizer()
    parser.feed(text)
    parser.close()
    return "".join(parser.out)

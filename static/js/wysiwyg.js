// Minimaler WYSIWYG-Helper (ohne externe Dependencies)
// Features: bold/italic/underline, lists, link, removeFormat, sanitize before save

(function () {
  const ALLOWED_TAGS = new Set([
    "B", "STRONG", "I", "EM", "U",
    "BR", "P", "DIV", "SPAN",
    "UL", "OL", "LI",
    "A"
  ]);

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const body = doc.body;

    // remove scripts/styles
    body.querySelectorAll("script,style").forEach((n) => n.remove());

    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, null);
    const toRemove = [];

    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        toRemove.push(el);
        continue;
      }

      // strip event handlers and dangerous attrs
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if (name === "style") el.removeAttribute(attr.name);
      });

      if (el.tagName === "A") {
        const href = el.getAttribute("href") || "";
        // allow only http(s) and mailto, or relative
        const ok =
          href.startsWith("/") ||
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("mailto:");
        if (!ok) el.removeAttribute("href");
        el.setAttribute("rel", "noopener");
        el.setAttribute("target", "_blank");
      } else {
        // remove href on non-links if any
        el.removeAttribute("href");
      }
    }

    // unwrap disallowed tags: replace with text content
    toRemove.forEach((el) => {
      const text = doc.createTextNode(el.textContent || "");
      el.replaceWith(text);
    });

    return (body.innerHTML || "").trim();
  }

  function exec(editor, cmd, value) {
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch (e) {
      // ignore
    }
  }

  function bindToolbar(toolbarEl) {
    if (!toolbarEl) return;
    const editorId = toolbarEl.getAttribute("data-editor");
    const editor = editorId ? document.getElementById(editorId) : null;
    if (!editor) return;

    toolbarEl.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-cmd]");
      if (!btn) return;
      ev.preventDefault();

      const cmd = btn.getAttribute("data-cmd");
      if (!cmd) return;

      if (cmd === "createLink") {
        const url = prompt("Link-URL (https://...):", "https://");
        if (!url) return;
        exec(editor, cmd, url);
        return;
      }
      exec(editor, cmd);
    });

    // optional: paste as plain text
    editor.addEventListener("paste", (ev) => {
      if (!editor.hasAttribute("data-paste-plain")) return;
      ev.preventDefault();
      const text = (ev.clipboardData || window.clipboardData).getData("text");
      exec(editor, "insertText", text);
    });
  }

  window.HortiWysiwyg = {
    sanitizeHtml,
    bindAll: function () {
      document.querySelectorAll(".wysiwyg-toolbar[data-editor]").forEach(bindToolbar);
    }
  };
})();


(function () {
  function mermaidFencePlugin(md) {
    var defaultFence =
      md.renderer.rules.fence ||
      function (tokens, idx, options, env, slf) {
        return slf.renderToken(tokens, idx, options);
      };
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
      var token = tokens[idx];
      var info = (token.info || "").trim().split(/\s+/)[0];
      if (info === "mermaid") {
        var src = token.content.replace(/\n$/, "");
        return (
          '<div class="mermaid-widget" contenteditable="false" data-mermaid="' +
          encodeURIComponent(src) +
          '"></div>\n'
        );
      }
      return defaultFence(tokens, idx, options, env, slf);
    };
  }

  var md = window.markdownit({
    html: false,
    linkify: true,
    breaks: false,
  });
  mermaidFencePlugin(md);

  var turndown = new window.TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("mermaidWidget", {
    filter: function (node) {
      return (
        node.nodeName === "DIV" &&
        node.classList &&
        node.classList.contains("mermaid-widget")
      );
    },
    replacement: function (_content, node) {
      var src = decodeURIComponent(node.getAttribute("data-mermaid") || "");
      return "\n\n```mermaid\n" + src + "\n```\n\n";
    },
  });
  turndown.addRule("taskItem", {
    filter: function (node) {
      return (
        node.nodeName === "LI" &&
        node.classList &&
        node.classList.contains("task-item")
      );
    },
    replacement: function (content, node) {
      var box = node.querySelector('input[type="checkbox"]');
      var mark = box && box.checked ? "[x]" : "[ ]";
      var text = content.replace(/^\s+/, "").replace(/\n+$/, "").trim();
      return "- " + mark + " " + text + "\n";
    },
  });

  var applying = false;
  var debounceTimer = null;
  var mermaidSeq = 0;
  var UNDO_LIMIT = 100;
  var undoPast = [];
  var undoFuture = [];
  var lastSnap = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function insertLink(url, text) {
    var article = document.getElementById("doc");
    article.focus();
    var selected = "";
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && article.contains(sel.anchorNode)) {
      selected = sel.toString();
    }
    if (selected) {
      document.execCommand("createLink", false, url);
    } else {
      var label = text || url;
      var html =
        '<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + "</a>";
      document.execCommand("insertHTML", false, html);
    }
    scheduleNotify();
  }

  function headingFromCaret(article) {
    var sel = window.getSelection();
    var node = sel && sel.anchorNode ? sel.anchorNode : null;
    var el = node;
    if (el && el.nodeType === 3) {
      el = el.parentElement;
    }
    while (el && el !== article) {
      if (el.nodeType === 1 && /^H[1-6]$/i.test(el.tagName)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function headingToParagraph(heading) {
    var p = document.createElement("p");
    while (heading.firstChild) {
      p.appendChild(heading.firstChild);
    }
    heading.parentNode.replaceChild(p, heading);
    var sel = window.getSelection();
    if (!sel) {
      return;
    }
    var range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function unwrapToParagraph() {
    var article = document.getElementById("doc");
    var heading = headingFromCaret(article);
    if (heading) {
      headingToParagraph(heading);
      return;
    }
    document.execCommand("formatBlock", false, "p");
  }

  function applyHeading(tag) {
    var name = String(tag || "")
      .replace(/[<>]/g, "")
      .toLowerCase();
    if (name === "p") {
      unwrapToParagraph();
      return;
    }
    var article = document.getElementById("doc");
    var heading = headingFromCaret(article);
    if (heading && heading.tagName.toLowerCase() === name) {
      headingToParagraph(heading);
      return;
    }
    document.execCommand("formatBlock", false, name);
  }

  function isBoldWrap(el) {
    if (!el || el.nodeType !== 1) {
      return false;
    }
    if (el.tagName === "B" || el.tagName === "STRONG") {
      return true;
    }
    if (el.tagName !== "SPAN") {
      return false;
    }
    var weight = String((el.style && el.style.fontWeight) || "").toLowerCase();
    return (
      weight === "bold" ||
      weight === "bolder" ||
      weight === "600" ||
      weight === "700" ||
      weight === "800" ||
      weight === "900"
    );
  }

  function closestBold(node, article) {
    var el = node;
    if (el && el.nodeType === 3) {
      el = el.parentElement;
    }
    while (el && el !== article) {
      if (isBoldWrap(el)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function rangeTouchesNode(range, node) {
    if (!range || !node) {
      return false;
    }
    if (range.intersectsNode) {
      return range.intersectsNode(node);
    }
    var other = document.createRange();
    other.selectNode(node);
    return (
      range.compareBoundaryPoints(Range.END_TO_START, other) < 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, other) > 0
    );
  }

  function findBoldWrap(article) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return null;
    }
    var range = sel.getRangeAt(0);
    var wrap = closestBold(range.startContainer, article);
    if (wrap) {
      return wrap;
    }
    wrap = closestBold(range.endContainer, article);
    if (wrap) {
      return wrap;
    }
    wrap = closestBold(range.commonAncestorContainer, article);
    if (wrap) {
      return wrap;
    }
    var root = range.commonAncestorContainer;
    if (root.nodeType !== 1) {
      root = root.parentElement;
    }
    if (!root || !root.querySelectorAll) {
      return null;
    }
    var nodes = root.querySelectorAll("strong, b, span");
    var i = 0;
    while (i < nodes.length) {
      var node = nodes[i];
      if (isBoldWrap(node) && rangeTouchesNode(range, node)) {
        return node;
      }
      i += 1;
    }
    return null;
  }

  function unwrapElement(el) {
    var parent = el.parentNode;
    if (!parent) {
      return;
    }
    var first = el.firstChild;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
    if (!first) {
      return;
    }
    var sel = window.getSelection();
    if (!sel) {
      return;
    }
    var range = document.createRange();
    range.setStartBefore(first);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function toggleBold() {
    var article = document.getElementById("doc");
    var wrap = findBoldWrap(article);
    if (wrap) {
      unwrapElement(wrap);
      return;
    }
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      var range = sel.getRangeAt(0);
      var strong = document.createElement("strong");
      try {
        range.surroundContents(strong);
        return;
      } catch (err) {}
    }
    document.execCommand("bold", false, false);
  }

  function slugify(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "");
  }

  function markTaskItems(root) {
    var items = root.querySelectorAll("li");
    items.forEach(function (li) {
      var html = li.innerHTML;
      var match = html.match(/^\s*\[( |x|X)\]\s+/);
      if (!match) {
        return;
      }
      var checked = match[1].toLowerCase() === "x";
      li.innerHTML = html.replace(/^\s*\[( |x|X)\]\s+/, "");
      li.classList.add("task-item");
      if (li.parentElement) {
        li.parentElement.classList.add("task-list");
      }
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = checked;
      box.contentEditable = "false";
      li.insertBefore(box, li.firstChild);
    });
  }

  function slugifyHeadings(root) {
    var heads = root.querySelectorAll("h1, h2, h3");
    heads.forEach(function (heading) {
      if (!heading.id) {
        heading.id = slugify(heading.textContent || "");
      }
    });
  }

  function mermaidTargets(root) {
    if (root.classList && root.classList.contains("mermaid-widget")) {
      return [root];
    }
    return Array.prototype.slice.call(root.querySelectorAll(".mermaid-widget"));
  }

  function renderMermaidWidgets(root) {
    var nodes = mermaidTargets(root);
    var jobs = [];
    nodes.forEach(function (node) {
      if (node.classList.contains("mmd-editing")) {
        return;
      }
      var src = decodeURIComponent(node.getAttribute("data-mermaid") || "");
      var id = "mmd-" + mermaidSeq;
      mermaidSeq += 1;
      jobs.push(
        window.mermaid
          .render(id, src)
          .then(function (result) {
            node.innerHTML = result.svg;
          })
          .catch(function (err) {
            node.innerHTML =
              '<pre class="mermaid-error">' + escapeHtml(err) + "</pre>";
          })
      );
    });
    return Promise.all(jobs).then(function () {
      if (window.MermaidEdit) {
        window.MermaidEdit.bind(root);
      }
    });
  }

  function caretOffset(root) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
      return 0;
    }
    var range = sel.getRangeAt(0);
    var pre = document.createRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  function setCaretOffset(root, offset) {
    var remain = offset;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node = walker.nextNode();
    var sel = window.getSelection();
    var range = document.createRange();
    while (node) {
      var len = node.nodeValue.length;
      if (remain <= len) {
        range.setStart(node, remain);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remain -= len;
      node = walker.nextNode();
    }
    range.selectNodeContents(root);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function takeSnap() {
    var article = document.getElementById("doc");
    return {
      html: article.innerHTML,
      caret: caretOffset(article),
    };
  }

  function resetHistory() {
    undoPast = [];
    undoFuture = [];
    lastSnap = takeSnap();
  }

  function trimStack(stack) {
    while (stack.length > UNDO_LIMIT) {
      stack.shift();
    }
  }

  function recordHistory() {
    if (applying) {
      return;
    }
    var snap = takeSnap();
    if (lastSnap && snap.html === lastSnap.html) {
      lastSnap = snap;
      return;
    }
    if (lastSnap) {
      undoPast.push(lastSnap);
      trimStack(undoPast);
    }
    undoFuture = [];
    lastSnap = snap;
  }

  function restoreSnap(snap) {
    applying = true;
    var article = document.getElementById("doc");
    article.innerHTML = snap.html;
    if (window.MermaidEdit) {
      window.MermaidEdit.bind(article);
    }
    setCaretOffset(article, snap.caret || 0);
    lastSnap = snap;
    applying = false;
    notifyChange();
  }

  function undoEdit() {
    clearTimeout(debounceTimer);
    recordHistory();
    if (!undoPast.length) {
      return;
    }
    undoFuture.push(takeSnap());
    trimStack(undoFuture);
    restoreSnap(undoPast.pop());
  }

  function redoEdit() {
    clearTimeout(debounceTimer);
    recordHistory();
    if (!undoFuture.length) {
      return;
    }
    undoPast.push(takeSnap());
    trimStack(undoPast);
    restoreSnap(undoFuture.pop());
  }

  function setMarkdown(text) {
    applying = true;
    var article = document.getElementById("doc");
    article.innerHTML = md.render(text || "");
    markTaskItems(article);
    slugifyHeadings(article);
    return renderMermaidWidgets(article).then(function () {
      applying = false;
      resetHistory();
    });
  }

  window.setMarkdown = setMarkdown;

  function toMarkdown() {
    var article = document.getElementById("doc");
    return turndown.turndown(article.innerHTML || "");
  }

  function notifyChange() {
    if (applying || !window.bridge) {
      return;
    }
    window.bridge.setMarkdown(toMarkdown());
  }

  function scheduleNotify() {
    if (applying) {
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      recordHistory();
      notifyChange();
    }, 250);
  }

  function isEmptyListItem(li) {
    var clone = li.cloneNode(true);
    var boxes = clone.querySelectorAll('input[type="checkbox"]');
    boxes.forEach(function (box) {
      box.remove();
    });
    var text = (clone.textContent || "").replace(/\u00a0/g, " ").trim();
    return text === "";
  }

  function closestLi(node) {
    var el = node && node.nodeType === 1 ? node : node.parentElement;
    return el ? el.closest("li") : null;
  }

  function placeCaretIn(el, afterCheckbox) {
    var sel = window.getSelection();
    var range = document.createRange();
    if (afterCheckbox && el.firstChild && el.firstChild.nodeName === "INPUT") {
      if (el.childNodes.length > 1) {
        range.setStart(el, 1);
      } else {
        el.appendChild(document.createTextNode("\u00a0"));
        range.setStart(el, 1);
      }
    } else {
      range.setStart(el, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function continueTaskItem(li, sel) {
    var range = sel.getRangeAt(0);
    if (!range.collapsed) {
      range.deleteContents();
      range = sel.getRangeAt(0);
    }
    var next = document.createElement("li");
    next.className = "task-item";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.contentEditable = "false";
    next.appendChild(box);
    try {
      var rest = document.createRange();
      rest.selectNodeContents(li);
      rest.setStart(range.endContainer, range.endOffset);
      var frag = rest.extractContents();
      if (frag.querySelectorAll) {
        var leftover = frag.querySelectorAll('input[type="checkbox"]');
        leftover.forEach(function (extra) {
          extra.remove();
        });
      }
      next.appendChild(frag);
    } catch (err) {
      next.appendChild(document.createTextNode("\u00a0"));
    }
    if (isEmptyListItem(next)) {
      next.appendChild(document.createTextNode("\u00a0"));
    }
    li.parentNode.insertBefore(next, li.nextSibling);
    placeCaretIn(next, true);
  }

  function exitList(li) {
    var list = li.parentElement;
    if (!list) {
      return;
    }
    var following = [];
    var sib = li.nextElementSibling;
    while (sib) {
      following.push(sib);
      sib = sib.nextElementSibling;
    }
    list.removeChild(li);
    var p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    if (following.length === 0) {
      while (list.lastElementChild && isEmptyListItem(list.lastElementChild)) {
        list.removeChild(list.lastElementChild);
      }
      if (!list.firstElementChild) {
        list.parentNode.replaceChild(p, list);
      } else {
        list.parentNode.insertBefore(p, list.nextSibling);
      }
    } else {
      var rest = document.createElement(list.tagName.toLowerCase());
      rest.className = list.className;
      following.forEach(function (item) {
        rest.appendChild(item);
      });
      if (!list.firstElementChild) {
        list.parentNode.replaceChild(p, list);
      } else {
        list.parentNode.insertBefore(p, list.nextSibling);
      }
      p.parentNode.insertBefore(rest, p.nextSibling);
    }
    placeCaretIn(p, false);
  }

  function onListEnter(event) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return;
    }
    var li = closestLi(sel.anchorNode);
    var article = document.getElementById("doc");
    if (!li || !article.contains(li)) {
      return;
    }
    var anchor = sel.anchorNode;
    var widgetHost = anchor.nodeType === 1 ? anchor : anchor.parentElement;
    if (widgetHost && widgetHost.closest(".mermaid-widget")) {
      return;
    }
    if (isEmptyListItem(li)) {
      event.preventDefault();
      exitList(li);
      scheduleNotify();
      return;
    }
    if (li.classList.contains("task-item")) {
      event.preventDefault();
      continueTaskItem(li, sel);
      scheduleNotify();
    }
  }

  function insertCodeFence(lang) {
    var article = document.getElementById("doc");
    article.focus();
    var info = String(lang || "").replace(/[^\w.+-]/g, "");
    var sel = window.getSelection();
    var selected = "";
    if (sel && sel.rangeCount > 0 && article.contains(sel.anchorNode)) {
      selected = sel.toString();
    }
    var pre = document.createElement("pre");
    var code = document.createElement("code");
    if (info) {
      code.className = "language-" + info;
    }
    code.textContent = selected || "\n";
    pre.appendChild(code);
    if (sel && sel.rangeCount > 0 && article.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pre);
    } else {
      article.appendChild(pre);
    }
    var caret = document.createRange();
    caret.selectNodeContents(code);
    caret.collapse(false);
    var caretSel = window.getSelection();
    caretSel.removeAllRanges();
    caretSel.addRange(caret);
    scheduleNotify();
  }

  function insertTaskList() {
    var article = document.getElementById("doc");
    article.focus();
    var ul = document.createElement("ul");
    ul.className = "task-list";
    var li = document.createElement("li");
    li.className = "task-item";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.contentEditable = "false";
    li.appendChild(box);
    li.appendChild(document.createTextNode(" "));
    ul.appendChild(li);
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && article.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(ul);
    } else {
      article.appendChild(ul);
    }
    scheduleNotify();
  }

  window.setUiStrings = function (placeholder, lang) {
    var article = document.getElementById("doc");
    if (article && placeholder) {
      article.setAttribute("data-placeholder", placeholder);
    }
    if (lang) {
      document.documentElement.lang = lang;
    }
  };
  function handleEditorTab(shift) {
    var article = document.getElementById("doc");
    if (!article) {
      return;
    }
    article.focus();
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (el && el.closest(".mermaid-widget")) {
      return;
    }
    if (el && el.closest("li") && !el.closest("pre")) {
      document.execCommand(shift ? "outdent" : "indent", false, false);
      scheduleNotify();
      return;
    }
    if (shift) {
      return;
    }
    document.execCommand("insertText", false, "    ");
    scheduleNotify();
  }

  window.handleEditorTab = handleEditorTab;
  window.execEditorCommand = function (name, arg, arg2) {
    var article = document.getElementById("doc");
    var sel = window.getSelection();
    var saved = null;
    if (sel && sel.rangeCount > 0) {
      saved = sel.getRangeAt(0).cloneRange();
    }
    article.focus();
    if (saved) {
      sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    if (name === "heading") {
      applyHeading(arg);
    } else if (name === "bold") {
      toggleBold();
    } else if (name === "undo") {
      undoEdit();
      return;
    } else if (name === "redo") {
      redoEdit();
      return;
    } else if (name === "insertLink") {
      insertLink(arg, arg2 || "");
      return;
    } else if (name === "insertCodeFence") {
      insertCodeFence(arg || "");
      return;
    } else if (name === "insertTaskList") {
      insertTaskList();
      return;
    } else if (name === "insertMermaidFlowchart" || name === "insertMermaid") {
      if (window.MermaidEdit) {
        window.MermaidEdit.insert(arg || "flowchart");
      }
      return;
    } else if (name === "insertHorizontalRule") {
      document.execCommand("insertHorizontalRule", false, false);
    } else {
      document.execCommand(name, false, false);
    }
    scheduleNotify();
  };

  function connectBridge() {
    if (typeof QWebChannel === "undefined" || typeof qt === "undefined") {
      setTimeout(connectBridge, 50);
      return;
    }
    new QWebChannel(qt.webChannelTransport, function (channel) {
      window.bridge = channel.objects.bridge;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
    });
    if (window.MermaidEdit) {
      window.MermaidEdit.attach({
        scheduleNotify: scheduleNotify,
        renderWidget: renderMermaidWidgets,
      });
    }
    var article = document.getElementById("doc");
    article.addEventListener("input", scheduleNotify);
    article.addEventListener("keydown", onListEnter);
    article.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Tab") {
          event.preventDefault();
        }
      },
      true
    );
    document.addEventListener(
      "keydown",
      function (event) {
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }
        var key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          undoEdit();
          return;
        }
        if (key === "y" || (key === "z" && event.shiftKey)) {
          event.preventDefault();
          redoEdit();
        }
      },
      true
    );
    article.addEventListener("change", function (event) {
      if (event.target && event.target.matches('input[type="checkbox"]')) {
        scheduleNotify();
      }
    });
    article.addEventListener(
      "click",
      function (event) {
        if (event.target.closest('input[type="checkbox"]')) {
          return;
        }
        var link = event.target.closest("a");
        if (!link) {
          return;
        }
        event.preventDefault();
        var href = link.getAttribute("href") || "";
        if (href.charAt(0) === "#") {
          var id = decodeURIComponent(href.slice(1));
          var target = document.getElementById(id);
          if (target) {
            target.scrollIntoView();
          }
          return;
        }
        if (window.bridge) {
          window.bridge.followLink(href);
        }
      },
      true
    );
    connectBridge();
  });
})();

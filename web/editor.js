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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  function renderMermaidWidgets(root) {
    var nodes = root.querySelectorAll(".mermaid-widget");
    var jobs = [];
    nodes.forEach(function (node) {
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
    return Promise.all(jobs);
  }

  function setMarkdown(text) {
    applying = true;
    var article = document.getElementById("doc");
    article.innerHTML = md.render(text || "");
    markTaskItems(article);
    slugifyHeadings(article);
    return renderMermaidWidgets(article).then(function () {
      applying = false;
    });
  }

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
    debounceTimer = setTimeout(notifyChange, 250);
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

  window.setMarkdown = setMarkdown;
  window.execEditorCommand = function (name, arg) {
    var article = document.getElementById("doc");
    article.focus();
    if (name === "heading") {
      document.execCommand("formatBlock", false, arg);
    } else if (name === "createLink") {
      document.execCommand("createLink", false, arg);
    } else if (name === "insertTaskList") {
      insertTaskList();
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
    var article = document.getElementById("doc");
    article.addEventListener("input", scheduleNotify);
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

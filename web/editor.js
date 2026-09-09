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

  var applying = false;
  var debounceTimer = null;
  var mermaidSeq = 0;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  window.setMarkdown = setMarkdown;
  window.execEditorCommand = function (name, arg) {
    var article = document.getElementById("doc");
    article.focus();
    if (name === "heading") {
      document.execCommand("formatBlock", false, arg);
    } else if (name === "createLink") {
      document.execCommand("createLink", false, arg);
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
    article.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (link) {
        event.preventDefault();
      }
    });
    connectBridge();
  });
})();

(function (root) {
  function escapedSplit(line) {
    var cells = [];
    var current = "";
    var escaped = false;
    var i = 0;
    var start = 0;
    if (line.charCodeAt(0) === 0x7c) {
      start = 1;
    }
    i = start;
    while (i < line.length) {
      var ch = line.charCodeAt(i);
      if (escaped) {
        current += line.charAt(i);
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === 0x5c) {
        escaped = true;
        i += 1;
        continue;
      }
      if (ch === 0x7c) {
        cells.push(current.trim());
        current = "";
        i += 1;
        continue;
      }
      current += line.charAt(i);
      i += 1;
    }
    cells.push(current.trim());
    if (line.charCodeAt(line.length - 1) === 0x7c && cells[cells.length - 1] === "") {
      cells.pop();
    }
    return cells;
  }

  function isSepCell(cell) {
    return /^:?-+:?$/.test(String(cell || "").replace(/\s/g, ""));
  }

  function isSeparatorRow(line) {
    var cells = escapedSplit(line);
    if (cells.length === 0) {
      return false;
    }
    var i = 0;
    while (i < cells.length) {
      if (!isSepCell(cells[i])) {
        return false;
      }
      i += 1;
    }
    return true;
  }

  function looksLikeRow(line) {
    return String(line || "").indexOf("|") >= 0;
  }

  function cellAlign(cell) {
    var s = String(cell || "").replace(/\s/g, "");
    var left = s.charAt(0) === ":";
    var right = s.charAt(s.length - 1) === ":";
    if (left && right) {
      return "center";
    }
    if (right) {
      return "right";
    }
    if (left) {
      return "left";
    }
    return "";
  }

  function padRow(cells, count) {
    var out = [];
    var i = 0;
    while (i < count) {
      out.push(i < cells.length ? cells[i] : "");
      i += 1;
    }
    return out;
  }

  function tableBlock(state, startLine, endLine, silent) {
    if (startLine + 1 >= endLine) {
      return false;
    }
    var first = state.getLines(startLine, startLine + 1, 0, false).replace(/\n$/, "");
    var second = state.getLines(startLine + 1, startLine + 2, 0, false).replace(/\n$/, "");
    if (!looksLikeRow(first) || !isSeparatorRow(second)) {
      return false;
    }
    var header = escapedSplit(first);
    var seps = escapedSplit(second);
    if (header.length === 0 || seps.length === 0) {
      return false;
    }
    var cols = header.length;
    if (seps.length > cols) {
      cols = seps.length;
    }
    header = padRow(header, cols);
    seps = padRow(seps, cols);
    if (silent) {
      return true;
    }
    var aligns = [];
    var c = 0;
    while (c < cols) {
      aligns.push(cellAlign(seps[c]));
      c += 1;
    }
    var body = [];
    var next = startLine + 2;
    while (next < endLine) {
      if (state.isEmpty(next)) {
        break;
      }
      var rowLine = state.getLines(next, next + 1, 0, false).replace(/\n$/, "");
      if (!looksLikeRow(rowLine)) {
        break;
      }
      if (isSeparatorRow(rowLine) && body.length === 0) {
        break;
      }
      body.push(padRow(escapedSplit(rowLine), cols));
      next += 1;
    }
    var token = state.push("table_open", "table", 1);
    token.map = [startLine, next];
    state.push("thead_open", "thead", 1);
    state.push("tr_open", "tr", 1);
    c = 0;
    while (c < cols) {
      token = state.push("th_open", "th", 1);
      if (aligns[c]) {
        token.attrSet("style", "text-align:" + aligns[c]);
      }
      token = state.push("inline", "", 0);
      token.content = header[c];
      token.children = [];
      state.push("th_close", "th", -1);
      c += 1;
    }
    state.push("tr_close", "tr", -1);
    state.push("thead_close", "thead", -1);
    if (body.length > 0) {
      state.push("tbody_open", "tbody", 1);
      var r = 0;
      while (r < body.length) {
        state.push("tr_open", "tr", 1);
        c = 0;
        while (c < cols) {
          token = state.push("td_open", "td", 1);
          if (aligns[c]) {
            token.attrSet("style", "text-align:" + aligns[c]);
          }
          token = state.push("inline", "", 0);
          token.content = body[r][c];
          token.children = [];
          state.push("td_close", "td", -1);
          c += 1;
        }
        state.push("tr_close", "tr", -1);
        r += 1;
      }
      state.push("tbody_close", "tbody", -1);
    }
    state.push("table_close", "table", -1);
    state.line = next;
    return true;
  }

  function tablePlugin(md) {
    md.block.ruler.before("paragraph", "table", tableBlock, {
      alt: ["paragraph", "reference"],
    });
  }

  function isDefMarker(line) {
    return /^:\s+\S/.test(String(line || "").replace(/^\s+/, ""));
  }

  function isTermLine(line) {
    var t = String(line || "").trim();
    if (!t || isDefMarker(t)) {
      return false;
    }
    if (/^#{1,6}\s/.test(t) || /^```/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t)) {
      return false;
    }
    if (t.indexOf("|") >= 0) {
      return false;
    }
    return true;
  }

  function deflistBlock(state, startLine, endLine, silent) {
    if (startLine + 1 >= endLine) {
      return false;
    }
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      return false;
    }
    var term = state.getLines(startLine, startLine + 1, 0, false).replace(/\n$/, "");
    var defLine = state.getLines(startLine + 1, startLine + 2, 0, false).replace(/\n$/, "");
    if (!isTermLine(term) || !isDefMarker(defLine)) {
      return false;
    }
    if (silent) {
      return true;
    }
    var pos = startLine;
    var items = [];
    while (pos < endLine) {
      if (state.isEmpty(pos)) {
        if (pos + 1 >= endLine) {
          break;
        }
        var peek = state.getLines(pos + 1, pos + 2, 0, false).replace(/\n$/, "");
        if (!peek.trim()) {
          break;
        }
        if (isDefMarker(peek)) {
          pos += 1;
          continue;
        }
        if (pos + 2 < endLine) {
          var peekDef = state.getLines(pos + 2, pos + 3, 0, false).replace(/\n$/, "");
          if (isTermLine(peek) && isDefMarker(peekDef)) {
            pos += 1;
            continue;
          }
        }
        break;
      }
      var line = state.getLines(pos, pos + 1, 0, false).replace(/\n$/, "");
      if (isDefMarker(line)) {
        if (items.length === 0) {
          return false;
        }
        items[items.length - 1].defs.push(line.replace(/^\s*:\s*/, ""));
        pos += 1;
        continue;
      }
      if (!isTermLine(line)) {
        break;
      }
      items.push({ term: line.trim(), defs: [] });
      pos += 1;
    }
    var hasDef = false;
    var i = 0;
    while (i < items.length) {
      if (items[i].defs.length > 0) {
        hasDef = true;
      }
      i += 1;
    }
    if (!hasDef) {
      return false;
    }
    var token = state.push("dl_open", "dl", 1);
    token.map = [startLine, pos];
    i = 0;
    while (i < items.length) {
      token = state.push("dt_open", "dt", 1);
      token = state.push("inline", "", 0);
      token.content = items[i].term;
      token.children = [];
      state.push("dt_close", "dt", -1);
      var d = 0;
      while (d < items[i].defs.length) {
        token = state.push("dd_open", "dd", 1);
        token = state.push("inline", "", 0);
        token.content = items[i].defs[d];
        token.children = [];
        state.push("dd_close", "dd", -1);
        d += 1;
      }
      i += 1;
    }
    state.push("dl_close", "dl", -1);
    state.line = pos;
    return true;
  }

  function deflistPlugin(md) {
    md.block.ruler.before("paragraph", "deflist", deflistBlock, {
      alt: ["paragraph", "reference"],
    });
  }

  function strikethroughPlugin(md) {
    function tokenize(state, silent) {
      var start = state.pos;
      if (state.src.charCodeAt(start) !== 0x7e) {
        return false;
      }
      var scanned = state.scanDelims(start, true);
      var len = scanned.length;
      var ch = "~";
      if (len < 2) {
        return false;
      }
      if (silent) {
        return false;
      }
      if (len % 2) {
        var odd = state.push("text", "", 0);
        odd.content = ch;
        len -= 1;
      }
      var i = 0;
      while (i < len) {
        var token = state.push("text", "", 0);
        token.content = ch + ch;
        if (scanned.can_open || scanned.can_close) {
          state.delimiters.push({
            marker: 0x7e,
            length: 0,
            token: state.tokens.length - 1,
            end: -1,
            open: scanned.can_open,
            close: scanned.can_close,
          });
        }
        i += 2;
      }
      state.pos += scanned.length;
      return true;
    }

    function postProcess(state, delimiters) {
      var i = 0;
      while (i < delimiters.length) {
        var startDelim = delimiters[i];
        if (startDelim.marker === 0x7e && startDelim.end !== -1) {
          var endDelim = delimiters[startDelim.end];
          var token = state.tokens[startDelim.token];
          token.type = "s_open";
          token.tag = "del";
          token.nesting = 1;
          token.markup = "~~";
          token.content = "";
          token = state.tokens[endDelim.token];
          token.type = "s_close";
          token.tag = "del";
          token.nesting = -1;
          token.markup = "~~";
          token.content = "";
        }
        i += 1;
      }
    }

    md.inline.ruler.before("emphasis", "strikethrough", tokenize);
    md.inline.ruler2.before("emphasis", "strikethrough", function (state) {
      postProcess(state, state.delimiters);
      var meta = state.tokens_meta || [];
      var curr = 0;
      while (curr < meta.length) {
        if (meta[curr] && meta[curr].delimiters) {
          postProcess(state, meta[curr].delimiters);
        }
        curr += 1;
      }
    });
  }

  function escapePipes(text) {
    return String(text || "").replace(/\|/g, "\\|").replace(/\n+/g, " ");
  }

  function rowAligns(row) {
    var aligns = [];
    var i = 0;
    var cells = row.cells || [];
    while (i < cells.length) {
      var cell = cells[i];
      var align = "";
      if (cell.getAttribute) {
        var style = String(cell.getAttribute("style") || "");
        var match = style.match(/text-align:\s*(left|right|center)/i);
        if (match) {
          align = match[1].toLowerCase();
        } else if (cell.getAttribute("align")) {
          align = String(cell.getAttribute("align")).toLowerCase();
        }
      }
      aligns.push(align);
      i += 1;
    }
    return aligns;
  }

  function sepCell(align) {
    if (align === "center") {
      return ":---:";
    }
    if (align === "right") {
      return "---:";
    }
    if (align === "left") {
      return ":---";
    }
    return "---";
  }

  function gfmRow(cells) {
    var i = 0;
    var out = "|";
    while (i < cells.length) {
      out += " " + escapePipes(cells[i]) + " |";
      i += 1;
    }
    return out;
  }

  function tableToMarkdown(node) {
    var rows = node.rows ? Array.prototype.slice.call(node.rows) : [];
    if (rows.length === 0) {
      return "";
    }
    var aligns = rowAligns(rows[0]);
    var lines = [];
    var r = 0;
    while (r < rows.length) {
      var cells = [];
      var c = 0;
      var row = rows[r];
      while (c < row.cells.length) {
        cells.push((row.cells[c].textContent || "").trim());
        c += 1;
      }
      while (cells.length < aligns.length) {
        cells.push("");
      }
      lines.push(gfmRow(cells));
      if (r === 0) {
        var seps = [];
        c = 0;
        while (c < aligns.length) {
          seps.push(sepCell(aligns[c]));
          c += 1;
        }
        while (seps.length < cells.length) {
          seps.push("---");
        }
        lines.push(gfmRow(seps));
      }
      r += 1;
    }
    return "\n\n" + lines.join("\n") + "\n\n";
  }

  function deflistToMarkdown(node) {
    var parts = [];
    var children = node.children || [];
    var i = 0;
    var pending = [];
    while (i < children.length) {
      var child = children[i];
      var name = child.nodeName;
      if (name === "DT") {
        pending.push((child.textContent || "").trim());
      } else if (name === "DD") {
        var t = 0;
        while (t < pending.length) {
          parts.push(pending[t]);
          t += 1;
        }
        if (pending.length === 0) {
          parts.push("");
        }
        pending = [];
        parts.push(": " + (child.textContent || "").trim());
      }
      i += 1;
    }
    return "\n\n" + parts.join("\n") + "\n\n";
  }

  function install(md, turndown) {
    if (md) {
      tablePlugin(md);
      deflistPlugin(md);
      strikethroughPlugin(md);
    }
    if (!turndown) {
      return;
    }
    turndown.addRule("gfmTable", {
      filter: "table",
      replacement: function (_content, node) {
        return tableToMarkdown(node);
      },
    });
    turndown.addRule("deflist", {
      filter: "dl",
      replacement: function (_content, node) {
        return deflistToMarkdown(node);
      },
    });
    turndown.addRule("strikethrough", {
      filter: ["del", "s", "strike"],
      replacement: function (content) {
        return "~~" + content + "~~";
      },
    });
  }

  var api = {
    install: install,
    escapedSplit: escapedSplit,
    isSeparatorRow: isSeparatorRow,
    tableToMarkdown: tableToMarkdown,
    deflistToMarkdown: deflistToMarkdown,
  };
  root.MarkdownExtra = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

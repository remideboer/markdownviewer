(function (root) {
  function stripQuotes(text) {
    var s = String(text || "").trim();
    if (s.length >= 2) {
      var a = s.charAt(0);
      var b = s.charAt(s.length - 1);
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
        return s.slice(1, -1);
      }
    }
    return s;
  }

  function normalize(src) {
    return String(src || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function skipSpaces(s, i) {
    while (i < s.length && (s.charAt(i) === " " || s.charAt(i) === "\t")) {
      i += 1;
    }
    return i;
  }

  function quoteLabel(label) {
    var s = String(label || "");
    if (/[[\](){}|"']/.test(s) || /^\s|\s$/.test(s)) {
      return '"' + s.replace(/"/g, "'") + '"';
    }
    return s;
  }

  function emptyGraph(kind) {
    var dir = "LR";
    if (kind === "class" || kind === "state") {
      dir = "TD";
    }
    return {
      kind: kind,
      dir: dir,
      title: "",
      nodes: [],
      edges: [],
      extras: {},
    };
  }

  function normalizeDir(d) {
    var x = String(d || "").toUpperCase();
    if (x === "TB") {
      return "TD";
    }
    if (x === "LR" || x === "RL" || x === "TD" || x === "BT") {
      return x;
    }
    return "";
  }

  function parseDirectionLine(line) {
    var m = String(line || "")
      .trim()
      .match(/^direction\s+(LR|RL|TD|BT|TB)\s*$/i);
    if (!m) {
      return null;
    }
    return normalizeDir(m[1]);
  }

  var CLASS_RELS = [
    { arrow: "<|--", en: "Inheritance", nl: "Overerving" },
    { arrow: "<|..", en: "Implements", nl: "Implementeert" },
    { arrow: "-->", en: "Association", nl: "Associatie" },
    { arrow: "..>", en: "Uses", nl: "Gebruikt" },
  ];

  function supportsDirection(kind) {
    return kind === "flowchart" || kind === "class" || kind === "state" || kind === "er";
  }

  function firstCodeLine(src) {
    var lines = normalize(src).split("\n");
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      if (line !== "" && line.indexOf("%%") !== 0) {
        return line;
      }
      i += 1;
    }
    return "";
  }

  var KIND_IDS = [
    "flowchart",
    "sequence",
    "class",
    "state",
    "er",
    "c4context",
    "c4container",
    "c4component",
    "c4dynamic",
    "pie",
    "gantt",
    "timeline",
    "journey",
    "quadrant",
    "git",
    "mindmap",
    "kanban",
  ];

  var GRAPH_KINDS = {
    flowchart: true,
    sequence: true,
    class: true,
    state: true,
    er: true,
    c4context: true,
    c4container: true,
    c4component: true,
    c4dynamic: true,
  };

  var TEMPLATES = {
    flowchart: "flowchart LR\n  a[Start] --> b[End]",
    sequence:
      "sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello",
    class:
      "classDiagram\n  class Animal {\n    +String name\n    +eat()\n  }\n  class Duck\n  Animal <|-- Duck",
    state: "stateDiagram-v2\n  [*] --> Still\n  Still --> Moving\n  Moving --> [*]",
    er:
      "erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    string name\n  }\n  ORDER {\n    int id\n  }",
    c4context:
      'C4Context\n  title System context\n  Person(user, "User", "A person")\n  System(app, "App", "Does work")\n  Rel(user, app, "Uses")',
    c4container:
      'C4Container\n  title Containers\n  Person(user, "User")\n  Container(web, "Web app", "JS", "UI")\n  Rel(user, web, "Uses")',
    c4component:
      'C4Component\n  title Components\n  Component(api, "API", "Java", "HTTP API")\n  ComponentDb(db, "DB", "SQL", "Store")\n  Rel(api, db, "Reads")',
    c4dynamic:
      'C4Dynamic\n  title Dynamic\n  Container(web, "Web")\n  Container(api, "API")\n  Rel(web, api, "Calls")',
    pie: 'pie title Pets\n  "Dogs" : 40\n  "Cats" : 30\n  "Rats" : 30',
    gantt:
      "gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Work\n  Design :a1, 2026-01-01, 7d\n  Build :after a1, 14d",
    timeline: "timeline\n  title History\n  2024 : Start\n  2025 : Launch",
    journey:
      "journey\n  title Shop\n  section Browse\n    Open site: 5: User\n  section Buy\n    Pay: 3: User",
    quadrant:
      "quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 We should\n  quadrant-2 Promote\n  quadrant-3 Reconsider\n  quadrant-4 Monitor\n  Campaign: [0.3, 0.6]",
    git: 'gitGraph\n  commit id: "A"\n  commit id: "B"\n  branch develop\n  checkout develop\n  commit id: "C"\n  checkout main\n  merge develop',
    mindmap: "mindmap\n  root((App))\n    Edit\n    Save",
    kanban: "kanban\n  Todo\n    Task one\n  Doing\n    Task two\n  Done",
  };

  function detectKind(src) {
    var line = firstCodeLine(src);
    if (/^(flowchart|graph)\s+/i.test(line)) {
      return "flowchart";
    }
    if (/^sequenceDiagram\b/i.test(line)) {
      return "sequence";
    }
    if (/^classDiagram\b/i.test(line)) {
      return "class";
    }
    if (/^stateDiagram(-v2)?\b/i.test(line)) {
      return "state";
    }
    if (/^erDiagram\b/i.test(line)) {
      return "er";
    }
    if (/^C4Context\b/i.test(line)) {
      return "c4context";
    }
    if (/^C4Container\b/i.test(line)) {
      return "c4container";
    }
    if (/^C4Component\b/i.test(line)) {
      return "c4component";
    }
    if (/^C4Dynamic\b/i.test(line)) {
      return "c4dynamic";
    }
    if (/^pie\b/i.test(line)) {
      return "pie";
    }
    if (/^gantt\b/i.test(line)) {
      return "gantt";
    }
    if (/^timeline\b/i.test(line)) {
      return "timeline";
    }
    if (/^journey\b/i.test(line)) {
      return "journey";
    }
    if (/^quadrantChart\b/i.test(line)) {
      return "quadrant";
    }
    if (/^gitGraph\b/i.test(line)) {
      return "git";
    }
    if (/^mindmap\b/i.test(line)) {
      return "mindmap";
    }
    if (/^kanban\b/i.test(line)) {
      return "kanban";
    }
    return null;
  }

  function isGraphKind(kind) {
    return !!GRAPH_KINDS[kind];
  }

  function template(kind) {
    return TEMPLATES[kind] || TEMPLATES.flowchart;
  }

  function readBalanced(s, i, openCh, closeCh) {
    if (s.charAt(i) !== openCh) {
      return null;
    }
    var start = i + 1;
    var depth = 1;
    i += 1;
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === '"' || ch === "'") {
        var q = ch;
        i += 1;
        while (i < s.length && s.charAt(i) !== q) {
          i += 1;
        }
        i += 1;
        continue;
      }
      if (ch === openCh) {
        depth += 1;
      } else if (ch === closeCh) {
        depth -= 1;
        if (depth === 0) {
          return { text: s.slice(start, i), next: i + 1 };
        }
      }
      i += 1;
    }
    return null;
  }

  function readFlowNode(s, i) {
    i = skipSpaces(s, i);
    var idMatch = s.slice(i).match(/^[A-Za-z][\w-]*/);
    if (!idMatch) {
      return null;
    }
    var id = idMatch[0];
    i += id.length;
    var shape = "rect";
    var label = id;
    var explicit = false;
    if (s.charAt(i) === "(") {
      var round = readBalanced(s, i, "(", ")");
      if (!round) {
        return null;
      }
      var body = round.text;
      if (body.charAt(0) === "(" && body.charAt(body.length - 1) === ")") {
        label = stripQuotes(body.slice(1, -1));
        shape = "circle";
      } else {
        label = stripQuotes(body);
        shape = "round";
      }
      explicit = true;
      i = round.next;
    } else if (s.charAt(i) === "[") {
      var rect = readBalanced(s, i, "[", "]");
      if (!rect) {
        return null;
      }
      label = stripQuotes(rect.text);
      shape = "rect";
      explicit = true;
      i = rect.next;
    } else if (s.charAt(i) === "{") {
      var diamond = readBalanced(s, i, "{", "}");
      if (!diamond) {
        return null;
      }
      label = stripQuotes(diamond.text);
      shape = "diamond";
      explicit = true;
      i = diamond.next;
    }
    if (label === "") {
      label = id;
    }
    return { type: "node", id: id, label: label, shape: shape, explicit: explicit, next: i };
  }

  function readFlowArrow(s, i) {
    i = skipSpaces(s, i);
    var kind = s.slice(i, i + 3);
    if (kind !== "-->" && kind !== "---" && kind !== "==>") {
      return null;
    }
    i += 3;
    i = skipSpaces(s, i);
    var label = "";
    if (s.charAt(i) === "|") {
      var end = s.indexOf("|", i + 1);
      if (end < 0) {
        return null;
      }
      label = s.slice(i + 1, end).trim();
      i = end + 1;
    }
    return { type: "arrow", label: label, next: i };
  }

  function upsertNode(graph, tok) {
    var existing = graph.nodeMap[tok.id];
    if (!existing) {
      var node = { id: tok.id, label: tok.label, shape: tok.shape };
      graph.nodes.push(node);
      graph.nodeMap[tok.id] = node;
      return node;
    }
    if (tok.explicit) {
      existing.label = tok.label;
      existing.shape = tok.shape;
    }
    return existing;
  }

  function parseFlowLine(line, graph) {
    var s = line.trim();
    var i = 0;
    var tokens = [];
    while (i < s.length) {
      i = skipSpaces(s, i);
      if (i >= s.length) {
        break;
      }
      var arrow = readFlowArrow(s, i);
      if (arrow) {
        tokens.push(arrow);
        i = arrow.next;
        continue;
      }
      var node = readFlowNode(s, i);
      if (!node) {
        return false;
      }
      tokens.push(node);
      i = node.next;
    }
    if (tokens.length === 0) {
      return true;
    }
    var prev = null;
    var t = 0;
    while (t < tokens.length) {
      var tok = tokens[t];
      if (tok.type === "node") {
        upsertNode(graph, tok);
        if (prev && prev.type === "arrow") {
          var from = tokens[t - 2];
          if (!from || from.type !== "node") {
            return false;
          }
          graph.edges.push({
            from: from.id,
            to: tok.id,
            label: prev.label || "",
            arrow: "-->",
          });
        }
        prev = tok;
      } else if (tok.type === "arrow") {
        if (!prev || prev.type !== "node") {
          return false;
        }
        prev = tok;
      }
      t += 1;
    }
    return !(prev && prev.type === "arrow");
  }

  function parseFlowchart(src) {
    var lines = normalize(src).split("\n");
    var graph = emptyGraph("flowchart");
    graph.nodeMap = {};
    var seenHeader = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seenHeader) {
        var m = line.match(/^(flowchart|graph)\s+(LR|RL|TD|BT|TB)\s*$/i);
        if (!m) {
          delete graph.nodeMap;
          return null;
        }
        var dir = m[2].toUpperCase();
        graph.dir = dir === "TB" ? "TD" : dir;
        seenHeader = true;
        continue;
      }
      var flowDir = parseDirectionLine(line);
      if (flowDir) {
        graph.dir = flowDir;
        continue;
      }
      if (/^(subgraph\b|classDef\b|class\s|click\s|style\s|linkStyle\b)/i.test(line)) {
        continue;
      }
      if (/^end$/i.test(line)) {
        continue;
      }
      parseFlowLine(line, graph);
    }
    if (!seenHeader) {
      delete graph.nodeMap;
      return null;
    }
    delete graph.nodeMap;
    return graph;
  }

  function emitFlowNode(node) {
    var inner = quoteLabel(node.label || node.id);
    if (node.shape === "circle") {
      return node.id + "((" + inner + "))";
    }
    if (node.shape === "round") {
      return node.id + "(" + inner + ")";
    }
    if (node.shape === "diamond") {
      return node.id + "{" + inner + "}";
    }
    return node.id + "[" + inner + "]";
  }

  function serializeFlowchart(graph) {
    var dir = (graph && graph.dir) || "LR";
    var lines = ["flowchart " + dir];
    var nodes = (graph && graph.nodes) || [];
    var n = 0;
    while (n < nodes.length) {
      lines.push("  " + emitFlowNode(nodes[n]));
      n += 1;
    }
    var edges = (graph && graph.edges) || [];
    var e = 0;
    while (e < edges.length) {
      var edge = edges[e];
      var arrow = " --> ";
      if (edge.label) {
        arrow = " -->|" + String(edge.label).replace(/\|/g, "") + "| ";
      }
      lines.push("  " + edge.from + arrow + edge.to);
      e += 1;
    }
    return lines.join("\n");
  }

  function ensureNode(graph, id, label) {
    var i = 0;
    while (i < graph.nodes.length) {
      if (graph.nodes[i].id === id) {
        if (label && graph.nodes[i].label === id) {
          graph.nodes[i].label = label;
        }
        return graph.nodes[i];
      }
      i += 1;
    }
    var node = { id: id, label: label || id, shape: "rect" };
    graph.nodes.push(node);
    return node;
  }

  function parseSequence(src) {
    var graph = emptyGraph("sequence");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^sequenceDiagram\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var part = line.match(/^(participant|actor)\s+([A-Za-z][\w-]*)(?:\s+as\s+(.+))?$/i);
      if (part) {
        var node = ensureNode(graph, part[2], stripQuotes(part[3] || part[2]));
        node.actor = part[1].toLowerCase() === "actor";
        continue;
      }
      var msg = line.match(
        /^([A-Za-z][\w-]*)\s*(->>|-->>|->|-->|-x|--x|-\)|--\))\s*([A-Za-z][\w-]*)\s*:\s*(.*)$/
      );
      if (msg) {
        ensureNode(graph, msg[1], msg[1]);
        ensureNode(graph, msg[3], msg[3]);
        graph.edges.push({
          from: msg[1],
          to: msg[3],
          label: msg[4] || "",
          arrow: msg[2],
        });
        continue;
      }
      var note = line.match(/^Note\s+(left of|right of|over)\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/i);
      if (note) {
        if (!graph.extras.notes) {
          graph.extras.notes = [];
        }
        graph.extras.notes.push({
          where: note[1].toLowerCase(),
          target: note[2],
          text: note[3],
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeSequence(graph) {
    var lines = ["sequenceDiagram"];
    var n = 0;
    var nodes = graph.nodes || [];
    while (n < nodes.length) {
      var node = nodes[n];
      var kw = node.actor ? "actor" : "participant";
      if (node.label && node.label !== node.id) {
        lines.push("  " + kw + " " + node.id + " as " + node.label);
      } else {
        lines.push("  " + kw + " " + node.id);
      }
      n += 1;
    }
    var e = 0;
    var edges = graph.edges || [];
    while (e < edges.length) {
      var edge = edges[e];
      var arr = edge.arrow || "->>";
      lines.push("  " + edge.from + arr + edge.to + ": " + (edge.label || "message"));
      e += 1;
    }
    var notes = (graph.extras && graph.extras.notes) || [];
    var k = 0;
    while (k < notes.length) {
      lines.push("  Note " + notes[k].where + " " + notes[k].target + ": " + notes[k].text);
      k += 1;
    }
    return lines.join("\n");
  }

  function parseClass(src) {
    var graph = emptyGraph("class");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    var current = null;
    while (i < lines.length) {
      var raw = lines[i];
      var line = raw.trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^classDiagram\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var classDir = parseDirectionLine(line);
      if (classDir) {
        graph.dir = classDir;
        continue;
      }
      if (current) {
        if (line === "}") {
          current = null;
          continue;
        }
        current.members = (current.members ? current.members + "\n" : "") + line;
        continue;
      }
      var cls = line.match(/^class\s+([A-Za-z][\w-]*)\s*(\{)?\s*$/);
      if (cls) {
        current = ensureNode(graph, cls[1], cls[1]);
        current.members = current.members || "";
        if (!cls[2]) {
          current = null;
        }
        continue;
      }
      var rel = line.match(
        /^([A-Za-z][\w-]*)\s+(<\|\.\.|<\|--|--\|>|\|--|>\|--|\*--|o--|-->|<--|<\.\.|\.\.>|\.\.--|--)\s+([A-Za-z][\w-]*)(?:\s*:\s*(.*))?$/
      );
      if (rel) {
        ensureNode(graph, rel[1], rel[1]);
        ensureNode(graph, rel[3], rel[3]);
        graph.edges.push({
          from: rel[1],
          to: rel[3],
          label: rel[4] || "",
          arrow: rel[2],
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeClass(graph) {
    var lines = ["classDiagram"];
    var dir = normalizeDir(graph.dir) || "TD";
    lines.push("  direction " + dir);
    var nodes = graph.nodes || [];
    var n = 0;
    while (n < nodes.length) {
      var node = nodes[n];
      var name = node.id;
      if (node.members && String(node.members).trim()) {
        lines.push("  class " + name + " {");
        var mems = String(node.members).split("\n");
        var m = 0;
        while (m < mems.length) {
          if (mems[m].trim()) {
            lines.push("    " + mems[m].trim());
          }
          m += 1;
        }
        lines.push("  }");
      } else {
        lines.push("  class " + name);
      }
      n += 1;
    }
    var edges = graph.edges || [];
    var e = 0;
    while (e < edges.length) {
      var edge = edges[e];
      var extra = edge.label ? " : " + edge.label : "";
      lines.push("  " + edge.from + " " + (edge.arrow || "-->") + " " + edge.to + extra);
      e += 1;
    }
    return lines.join("\n");
  }

  function parseState(src) {
    var graph = emptyGraph("state");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^stateDiagram(-v2)?\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var stateDir = parseDirectionLine(line);
      if (stateDir) {
        graph.dir = stateDir;
        continue;
      }
      if (/^state\s+/.test(line) && line.indexOf("{") >= 0) {
        continue;
      }
      if (line === "}") {
        continue;
      }
      var trans = line.match(/^(\[\*\]|[A-Za-z][\w-]*)\s*-->\s*(\[\*\]|[A-Za-z][\w-]*)(?:\s*:\s*(.*))?$/);
      if (trans) {
        var fromId = trans[1] === "[*]" ? "__start__" : trans[1];
        var toId = trans[2] === "[*]" ? "__end__" : trans[2];
        var fromNode = ensureNode(graph, fromId, fromId === "__start__" ? "[*]" : fromId);
        var toNode = ensureNode(graph, toId, toId === "__end__" ? "[*]" : toId);
        if (fromId === "__start__" || fromId === "__end__") {
          fromNode.shape = "circle";
        }
        if (toId === "__start__" || toId === "__end__") {
          toNode.shape = "circle";
        }
        graph.edges.push({
          from: fromId,
          to: toId,
          label: trans[3] || "",
          arrow: "-->",
        });
      } else {
        var named = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z][\w-]*)$/);
        if (named) {
          ensureNode(graph, named[2], named[1]);
        }
      }
    }
    return seen ? graph : null;
  }

  function serializeState(graph) {
    var lines = ["stateDiagram-v2"];
    var stateDir = normalizeDir(graph.dir) || "TD";
    lines.push("  direction " + stateDir);
    function emitId(id, node) {
      if (id === "__start__" || id === "__end__" || (node && node.label === "[*]")) {
        return "[*]";
      }
      return id;
    }
    var nodes = graph.nodes || [];
    var n = 0;
    while (n < nodes.length) {
      var node = nodes[n];
      if (node.id !== "__start__" && node.id !== "__end__" && node.label && node.label !== node.id && node.label !== "[*]") {
        lines.push('  state "' + node.label.replace(/"/g, "") + '" as ' + node.id);
      }
      n += 1;
    }
    var edges = graph.edges || [];
    var e = 0;
    while (e < edges.length) {
      var edge = edges[e];
      var fromNode = null;
      var toNode = null;
      n = 0;
      while (n < nodes.length) {
        if (nodes[n].id === edge.from) {
          fromNode = nodes[n];
        }
        if (nodes[n].id === edge.to) {
          toNode = nodes[n];
        }
        n += 1;
      }
      var extra = edge.label ? " : " + edge.label : "";
      lines.push("  " + emitId(edge.from, fromNode) + " --> " + emitId(edge.to, toNode) + extra);
      e += 1;
    }
    return lines.join("\n");
  }

  function parseEr(src) {
    var graph = emptyGraph("er");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    var current = null;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^erDiagram\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var erDir = parseDirectionLine(line);
      if (erDir) {
        graph.dir = erDir;
        continue;
      }
      if (current) {
        if (line === "}") {
          current = null;
          continue;
        }
        current.members = (current.members ? current.members + "\n" : "") + line;
        continue;
      }
      var ent = line.match(/^([A-Za-z][\w-]*)\s*\{\s*$/);
      if (ent) {
        current = ensureNode(graph, ent[1], ent[1]);
        current.members = current.members || "";
        continue;
      }
      var rel = line.match(
        /^([A-Za-z][\w-]*)\s+(\|\|--o\{|\|\|--\|\{|\|\|--\|\||\}o--o\{|\|o--o\{|\|o--\|\||\}o--\|\||\|\|--o\||}o--o\||--o\{)\s+([A-Za-z][\w-]*)(?:\s*:\s*(.*))?$/
      );
      if (!rel) {
        rel = line.match(/^([A-Za-z][\w-]*)\s+(\S+)\s+([A-Za-z][\w-]*)(?:\s*:\s*(.*))?$/);
        if (rel && rel[2].indexOf("--") < 0 && rel[2].indexOf("..") < 0) {
          rel = null;
        }
      }
      if (rel) {
        ensureNode(graph, rel[1], rel[1]);
        ensureNode(graph, rel[3], rel[3]);
        graph.edges.push({
          from: rel[1],
          to: rel[3],
          label: rel[4] || "",
          arrow: rel[2],
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeEr(graph) {
    var lines = ["erDiagram"];
    var erDir = normalizeDir(graph.dir) || "LR";
    lines.push("  direction " + erDir);
    var nodes = graph.nodes || [];
    var n = 0;
    while (n < nodes.length) {
      var node = nodes[n];
      if (node.members && String(node.members).trim()) {
        lines.push("  " + node.id + " {");
        var mems = String(node.members).split("\n");
        var m = 0;
        while (m < mems.length) {
          if (mems[m].trim()) {
            lines.push("    " + mems[m].trim());
          }
          m += 1;
        }
        lines.push("  }");
      }
      n += 1;
    }
    var edges = graph.edges || [];
    var e = 0;
    while (e < edges.length) {
      var edge = edges[e];
      var extra = edge.label ? " : " + edge.label : "";
      lines.push("  " + edge.from + " " + (edge.arrow || "||--o{") + " " + edge.to + extra);
      e += 1;
    }
    return lines.join("\n");
  }

  function splitArgs(inner) {
    var out = [];
    var cur = "";
    var quote = "";
    var i = 0;
    var s = String(inner || "");
    while (i < s.length) {
      var ch = s.charAt(i);
      if (quote) {
        if (ch === quote) {
          quote = "";
        } else {
          cur += ch;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ",") {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
      i += 1;
    }
    out.push(cur.trim());
    return out;
  }

  var C4_HEADERS = {
    c4context: "C4Context",
    c4container: "C4Container",
    c4component: "C4Component",
    c4dynamic: "C4Dynamic",
  };

  function parseC4(src, kind) {
    var header = C4_HEADERS[kind];
    var graph = emptyGraph(kind);
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    var entRe =
      /^(Person_Ext|Person|System_Ext|SystemDb|SystemQueue|System|Container_Ext|ContainerDb|ContainerQueue|Container|Component_Ext|ComponentDb|ComponentQueue|Component)\s*\((.*)\)\s*$/;
    var relRe = /^(Rel_Back|Rel_D|Rel_U|BiRel|Rel)\s*\((.*)\)\s*$/;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (line.toUpperCase() !== header.toUpperCase()) {
          return null;
        }
        seen = true;
        continue;
      }
      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        graph.title = title[1];
        continue;
      }
      if (/^(UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig|Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary)\b/i.test(line)) {
        continue;
      }
      var ent = line.match(entRe);
      if (ent) {
        var args = splitArgs(ent[2]);
        var id = args[0] || "n";
        var node = ensureNode(graph, id, args[1] || id);
        node.c4type = ent[1];
        node.desc = args[2] || "";
        node.tech = args[3] || args[2] || "";
        if (ent[1].indexOf("Person") === 0) {
          node.shape = "circle";
        }
        continue;
      }
      var rel = line.match(relRe);
      if (rel) {
        var rargs = splitArgs(rel[2]);
        if (rargs.length >= 2) {
          ensureNode(graph, rargs[0], rargs[0]);
          ensureNode(graph, rargs[1], rargs[1]);
          graph.edges.push({
            from: rargs[0],
            to: rargs[1],
            label: rargs[2] || "",
            arrow: rel[1],
            tech: rargs[3] || "",
          });
        }
      }
    }
    return seen ? graph : null;
  }

  function serializeC4(graph) {
    var kind = graph.kind || "c4context";
    var lines = [C4_HEADERS[kind] || "C4Context"];
    if (graph.title) {
      lines.push("  title " + graph.title);
    }
    var nodes = graph.nodes || [];
    var n = 0;
    while (n < nodes.length) {
      var node = nodes[n];
      var typ = node.c4type || "System";
      var bits = [node.id, '"' + String(node.label || node.id).replace(/"/g, "") + '"'];
      if (node.desc) {
        bits.push('"' + String(node.desc).replace(/"/g, "") + '"');
      }
      if (node.tech && node.tech !== node.desc) {
        bits.push('"' + String(node.tech).replace(/"/g, "") + '"');
      }
      lines.push("  " + typ + "(" + bits.join(", ") + ")");
      n += 1;
    }
    var edges = graph.edges || [];
    var e = 0;
    while (e < edges.length) {
      var edge = edges[e];
      var rbits = [edge.from, edge.to];
      if (edge.label) {
        rbits.push('"' + String(edge.label).replace(/"/g, "") + '"');
      }
      lines.push("  " + (edge.arrow || "Rel") + "(" + rbits.join(", ") + ")");
      e += 1;
    }
    return lines.join("\n");
  }

  function parsePie(src) {
    var graph = emptyGraph("pie");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        var head = line.match(/^pie(?:\s+showData)?(?:\s+title\s+(.+))?$/i);
        if (!head) {
          return null;
        }
        graph.title = head[1] || "";
        seen = true;
        continue;
      }
      var titleOnly = line.match(/^title\s+(.+)$/i);
      if (titleOnly) {
        graph.title = titleOnly[1];
        continue;
      }
      var slice = line.match(/^"([^"]+)"\s*:\s*([0-9.]+)\s*$/);
      if (!slice) {
        slice = line.match(/^([^:]+):\s*([0-9.]+)\s*$/);
      }
      if (slice) {
        graph.nodes.push({
          id: "s" + graph.nodes.length,
          label: stripQuotes(slice[1].trim()),
          value: Number(slice[2]),
          shape: "rect",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializePie(graph) {
    var lines = ["pie title " + (graph.title || "Pie")];
    var n = 0;
    while (n < (graph.nodes || []).length) {
      var node = graph.nodes[n];
      lines.push('  "' + String(node.label || "Item").replace(/"/g, "") + '" : ' + (node.value || 0));
      n += 1;
    }
    return lines.join("\n");
  }

  function parseGantt(src) {
    var graph = emptyGraph("gantt");
    graph.extras.dateFormat = "YYYY-MM-DD";
    var lines = normalize(src).split("\n");
    var seen = false;
    var section = "Work";
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^gantt\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        graph.title = title[1];
        continue;
      }
      var fmt = line.match(/^dateFormat\s+(.+)$/i);
      if (fmt) {
        graph.extras.dateFormat = fmt[1];
        continue;
      }
      var sec = line.match(/^section\s+(.+)$/i);
      if (sec) {
        section = sec[1];
        continue;
      }
      var task = line.match(/^(.+?)\s*:\s*(.+)$/);
      if (task) {
        graph.nodes.push({
          id: "t" + graph.nodes.length,
          label: task[1].trim(),
          extra: task[2].trim(),
          section: section,
          shape: "rect",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeGantt(graph) {
    var lines = ["gantt"];
    if (graph.title) {
      lines.push("  title " + graph.title);
    }
    lines.push("  dateFormat " + ((graph.extras && graph.extras.dateFormat) || "YYYY-MM-DD"));
    var section = "";
    var n = 0;
    var nodes = graph.nodes || [];
    while (n < nodes.length) {
      var node = nodes[n];
      var sec = node.section || "Work";
      if (sec !== section) {
        lines.push("  section " + sec);
        section = sec;
      }
      lines.push("  " + node.label + " :" + (node.extra || "2026-01-01, 7d"));
      n += 1;
    }
    return lines.join("\n");
  }

  function parseTimeline(src) {
    var graph = emptyGraph("timeline");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^timeline\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        graph.title = title[1];
        continue;
      }
      var item = line.match(/^(.+?)\s*:\s*(.+)$/);
      if (item) {
        graph.nodes.push({
          id: "t" + graph.nodes.length,
          label: item[1].trim(),
          extra: item[2].trim(),
          shape: "rect",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeTimeline(graph) {
    var lines = ["timeline"];
    if (graph.title) {
      lines.push("  title " + graph.title);
    }
    var n = 0;
    while (n < (graph.nodes || []).length) {
      var node = graph.nodes[n];
      lines.push("  " + node.label + " : " + (node.extra || node.label));
      n += 1;
    }
    return lines.join("\n");
  }

  function parseJourney(src) {
    var graph = emptyGraph("journey");
    var lines = normalize(src).split("\n");
    var seen = false;
    var section = "Section";
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^journey\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        graph.title = title[1];
        continue;
      }
      var sec = line.match(/^section\s+(.+)$/i);
      if (sec) {
        section = sec[1];
        continue;
      }
      var task = line.match(/^(.+?)\s*:\s*([0-9]+)\s*:\s*(.+)$/);
      if (task) {
        graph.nodes.push({
          id: "j" + graph.nodes.length,
          label: task[1].trim(),
          value: Number(task[2]),
          extra: task[3].trim(),
          section: section,
          shape: "rect",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeJourney(graph) {
    var lines = ["journey"];
    if (graph.title) {
      lines.push("  title " + graph.title);
    }
    var section = "";
    var n = 0;
    while (n < (graph.nodes || []).length) {
      var node = graph.nodes[n];
      var sec = node.section || "Section";
      if (sec !== section) {
        lines.push("  section " + sec);
        section = sec;
      }
      lines.push("    " + node.label + ": " + (node.value || 3) + ": " + (node.extra || "User"));
      n += 1;
    }
    return lines.join("\n");
  }

  function parseQuadrant(src) {
    var graph = emptyGraph("quadrant");
    graph.extras.xaxis = ["Low", "High"];
    graph.extras.yaxis = ["Low", "High"];
    graph.extras.quadrants = ["We should", "Promote", "Reconsider", "Monitor"];
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^quadrantChart\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var title = line.match(/^title\s+(.+)$/i);
      if (title) {
        graph.title = title[1];
        continue;
      }
      var xa = line.match(/^x-axis\s+(.+?)\s+-->\s+(.+)$/i);
      if (xa) {
        graph.extras.xaxis = [xa[1].trim(), xa[2].trim()];
        continue;
      }
      var ya = line.match(/^y-axis\s+(.+?)\s+-->\s+(.+)$/i);
      if (ya) {
        graph.extras.yaxis = [ya[1].trim(), ya[2].trim()];
        continue;
      }
      var q = line.match(/^quadrant-([1-4])\s+(.+)$/i);
      if (q) {
        graph.extras.quadrants[Number(q[1]) - 1] = q[2];
        continue;
      }
      var pt = line.match(/^(.+?)\s*:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]$/);
      if (pt) {
        graph.nodes.push({
          id: "p" + graph.nodes.length,
          label: pt[1].trim(),
          x: Number(pt[2]),
          y: Number(pt[3]),
          shape: "circle",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeQuadrant(graph) {
    var ex = graph.extras || {};
    var xa = ex.xaxis || ["Low", "High"];
    var ya = ex.yaxis || ["Low", "High"];
    var qs = ex.quadrants || ["We should", "Promote", "Reconsider", "Monitor"];
    var lines = ["quadrantChart"];
    if (graph.title) {
      lines.push("  title " + graph.title);
    }
    lines.push("  x-axis " + xa[0] + " --> " + xa[1]);
    lines.push("  y-axis " + ya[0] + " --> " + ya[1]);
    lines.push("  quadrant-1 " + qs[0]);
    lines.push("  quadrant-2 " + qs[1]);
    lines.push("  quadrant-3 " + qs[2]);
    lines.push("  quadrant-4 " + qs[3]);
    var n = 0;
    while (n < (graph.nodes || []).length) {
      var node = graph.nodes[n];
      var x = node.x != null ? node.x : 0.5;
      var y = node.y != null ? node.y : 0.5;
      lines.push("  " + node.label + ": [" + x + ", " + y + "]");
      n += 1;
    }
    return lines.join("\n");
  }

  function parseGit(src) {
    var graph = emptyGraph("git");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^gitGraph\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      graph.nodes.push({
        id: "g" + graph.nodes.length,
        label: line,
        extra: line,
        shape: "rect",
      });
    }
    return seen ? graph : null;
  }

  function serializeGit(graph) {
    var lines = ["gitGraph"];
    var n = 0;
    while (n < (graph.nodes || []).length) {
      lines.push("  " + (graph.nodes[n].extra || graph.nodes[n].label || "commit"));
      n += 1;
    }
    return lines.join("\n");
  }

  function parseMindmap(src) {
    var graph = emptyGraph("mindmap");
    var lines = normalize(src).split("\n");
    var seen = false;
    var i = 0;
    var stack = [];
    while (i < lines.length) {
      var raw = lines[i].replace(/\t/g, "  ");
      var line = raw.trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^mindmap\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var indent = raw.match(/^\s*/)[0].length;
      var ident = line.match(/^([A-Za-z][\w-]*)\(\((.+)\)\)$/);
      var id = "m" + graph.nodes.length;
      var label = line;
      var shape = "rect";
      if (ident) {
        id = ident[1];
        label = ident[2];
        shape = "circle";
      } else {
        var mm = line.match(/^([A-Za-z][\w-]*)\[(.+)\]$/);
        if (mm) {
          id = mm[1];
          label = mm[2];
        } else if (line.indexOf("((") === 0) {
          label = line.replace(/^\(\(/, "").replace(/\)\)$/, "");
          shape = "circle";
        }
      }
      while (stack.length && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      var parent = stack.length ? stack[stack.length - 1].id : "";
      graph.nodes.push({
        id: id,
        label: label,
        parent: parent,
        shape: shape,
      });
      stack.push({ indent: indent, id: id });
    }
    return seen ? graph : null;
  }

  function serializeMindmap(graph) {
    var lines = ["mindmap"];
    function kids(parentId) {
      var out = [];
      var n = 0;
      while (n < (graph.nodes || []).length) {
        if ((graph.nodes[n].parent || "") === parentId) {
          out.push(graph.nodes[n]);
        }
        n += 1;
      }
      return out;
    }
    function walk(node, depth) {
      var pad = "";
      var d = 0;
      while (d < depth) {
        pad += "  ";
        d += 1;
      }
      var text = node.label || node.id;
      if (depth === 0 || node.shape === "circle") {
        lines.push(pad + node.id + "((" + text + "))");
      } else {
        lines.push(pad + text);
      }
      var children = kids(node.id);
      var c = 0;
      while (c < children.length) {
        walk(children[c], depth + 1);
        c += 1;
      }
    }
    var roots = kids("");
    if (roots.length === 0 && graph.nodes && graph.nodes[0]) {
      roots = [graph.nodes[0]];
    }
    var r = 0;
    while (r < roots.length) {
      walk(roots[r], 1);
      r += 1;
    }
    return lines.join("\n");
  }

  function parseKanban(src) {
    var graph = emptyGraph("kanban");
    var lines = normalize(src).split("\n");
    var seen = false;
    var column = "Todo";
    var i = 0;
    while (i < lines.length) {
      var raw = lines[i];
      var line = raw.trim();
      i += 1;
      if (line === "" || line.indexOf("%%") === 0) {
        continue;
      }
      if (!seen) {
        if (!/^kanban\b/i.test(line)) {
          return null;
        }
        seen = true;
        continue;
      }
      var indent = raw.match(/^\s*/)[0].length;
      if (indent === 0 || indent < 2) {
        column = line.replace(/^\[[^\]]+\]\s*/, "");
        if (!graph.extras.columns) {
          graph.extras.columns = [];
        }
        if (graph.extras.columns.indexOf(column) < 0) {
          graph.extras.columns.push(column);
        }
      } else {
        graph.nodes.push({
          id: "k" + graph.nodes.length,
          label: line.replace(/^\[[^\]]+\]\s*/, ""),
          section: column,
          shape: "rect",
        });
      }
    }
    return seen ? graph : null;
  }

  function serializeKanban(graph) {
    var lines = ["kanban"];
    var cols = (graph.extras && graph.extras.columns) || [];
    if (cols.length === 0) {
      var seenCol = {};
      var n = 0;
      while (n < (graph.nodes || []).length) {
        var sec = graph.nodes[n].section || "Todo";
        if (!seenCol[sec]) {
          cols.push(sec);
          seenCol[sec] = true;
        }
        n += 1;
      }
    }
    if (cols.length === 0) {
      cols = ["Todo"];
    }
    var c = 0;
    while (c < cols.length) {
      lines.push("  " + cols[c]);
      var k = 0;
      while (k < (graph.nodes || []).length) {
        if ((graph.nodes[k].section || "Todo") === cols[c]) {
          lines.push("    " + graph.nodes[k].label);
        }
        k += 1;
      }
      c += 1;
    }
    return lines.join("\n");
  }

  var PARSERS = {
    flowchart: parseFlowchart,
    sequence: parseSequence,
    class: parseClass,
    state: parseState,
    er: parseEr,
    c4context: function (src) {
      return parseC4(src, "c4context");
    },
    c4container: function (src) {
      return parseC4(src, "c4container");
    },
    c4component: function (src) {
      return parseC4(src, "c4component");
    },
    c4dynamic: function (src) {
      return parseC4(src, "c4dynamic");
    },
    pie: parsePie,
    gantt: parseGantt,
    timeline: parseTimeline,
    journey: parseJourney,
    quadrant: parseQuadrant,
    git: parseGit,
    mindmap: parseMindmap,
    kanban: parseKanban,
  };

  var SERIALIZERS = {
    flowchart: serializeFlowchart,
    sequence: serializeSequence,
    class: serializeClass,
    state: serializeState,
    er: serializeEr,
    c4context: serializeC4,
    c4container: serializeC4,
    c4component: serializeC4,
    c4dynamic: serializeC4,
    pie: serializePie,
    gantt: serializeGantt,
    timeline: serializeTimeline,
    journey: serializeJourney,
    quadrant: serializeQuadrant,
    git: serializeGit,
    mindmap: serializeMindmap,
    kanban: serializeKanban,
  };

  function parseKind(kind, src) {
    var fn = PARSERS[kind];
    if (!fn) {
      return null;
    }
    return fn(src);
  }

  function parseDocument(src) {
    var kind = detectKind(src);
    if (!kind) {
      return null;
    }
    var graph = parseKind(kind, src);
    if (!graph) {
      graph = parseKind(kind, template(kind));
    }
    if (graph) {
      graph.kind = kind;
    }
    return graph;
  }

  function serialize(graph) {
    var kind = (graph && graph.kind) || "flowchart";
    var fn = SERIALIZERS[kind] || serializeFlowchart;
    return fn(graph);
  }

  var api = {
    KIND_IDS: KIND_IDS,
    CLASS_RELS: CLASS_RELS,
    detectKind: detectKind,
    isGraphKind: isGraphKind,
    supportsDirection: supportsDirection,
    normalizeDir: normalizeDir,
    template: template,
    parseDocument: parseDocument,
    parseKind: parseKind,
    serialize: serialize,
    parseFlowchart: parseFlowchart,
    serializeFlowchart: serializeFlowchart,
  };
  root.MermaidKinds = api;
  root.MermaidFlow = {
    parseFlowchart: parseFlowchart,
    serializeFlowchart: serializeFlowchart,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

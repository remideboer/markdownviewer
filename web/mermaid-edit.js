(function (root) {
  var Kinds = root.MermaidKinds;
  if (!Kinds && typeof require !== "undefined") {
    Kinds = require("./mermaid-kinds.js");
    root.MermaidKinds = Kinds;
  }
  root.MermaidFlow = {
    parseFlowchart: Kinds.parseFlowchart,
    serializeFlowchart: Kinds.serializeFlowchart,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Kinds;
  }
  if (typeof document === "undefined") {
    return;
  }

  var hooks = {
    scheduleNotify: function () {},
    renderWidget: function () {
      return Promise.resolve();
    },
  };
  var active = null;

  function tr() {
    var nl = document.documentElement.lang === "nl";
    return {
      node: "Node",
      actor: nl ? "Actor" : "Actor",
      cls: nl ? "Klasse" : "Class",
      state: nl ? "Toestand" : "State",
      entity: nl ? "Entiteit" : "Entity",
      person: "Person",
      system: "System",
      container: "Container",
      component: "Component",
      slice: nl ? "Schijf" : "Slice",
      task: "Task",
      step: nl ? "Stap" : "Step",
      point: nl ? "Punt" : "Point",
      commit: "Commit",
      branch: "Branch",
      merge: "Merge",
      child: nl ? "Kind" : "Child",
      card: nl ? "Kaart" : "Card",
      column: nl ? "Kolom" : "Column",
      edge: nl ? "Pijl" : "Arrow",
      del: nl ? "Verwijderen" : "Delete",
      done: nl ? "Klaar" : "Done",
      hint: nl
        ? "Dubbelklik om tekst te wijzigen. Sleep om te schikken."
        : "Double-click to rename. Drag to arrange.",
      connect: nl ? "Klik de bron, daarna het doel." : "Click the source, then the target.",
      editTitle: nl ? "Dubbelklik om te bewerken" : "Double-click to edit",
      newLabel: "Node",
    };
  }

  function addBtn(bar, act, label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-act", act);
    btn.textContent = label;
    bar.appendChild(btn);
    return btn;
  }

  function nextNodeId(nodes, prefix) {
    var used = {};
    var i = 0;
    while (i < nodes.length) {
      used[nodes[i].id] = true;
      i += 1;
    }
    var n = 1;
    var pre = prefix || "n";
    while (used[pre + n]) {
      n += 1;
    }
    return pre + n;
  }

  function persist(session) {
    var src = Kinds.serialize(session.graph);
    session.widget.setAttribute("data-mermaid", encodeURIComponent(src));
    session.dirty = true;
    hooks.scheduleNotify();
  }

  function layoutGraph(graph) {
    if (graph.kind === "sequence") {
      var i = 0;
      while (i < graph.nodes.length) {
        graph.nodes[i].x = 24 + i * 180;
        graph.nodes[i].y = 24;
        i += 1;
      }
      return;
    }
    var indeg = {};
    var outgoing = {};
    i = 0;
    while (i < graph.nodes.length) {
      indeg[graph.nodes[i].id] = 0;
      outgoing[graph.nodes[i].id] = [];
      i += 1;
    }
    i = 0;
    while (i < graph.edges.length) {
      var edge = graph.edges[i];
      if (indeg[edge.to] !== undefined) {
        indeg[edge.to] += 1;
      }
      if (outgoing[edge.from]) {
        outgoing[edge.from].push(edge.to);
      }
      i += 1;
    }
    var layer = {};
    var queue = [];
    i = 0;
    while (i < graph.nodes.length) {
      var id = graph.nodes[i].id;
      if (indeg[id] === 0) {
        queue.push(id);
        layer[id] = 0;
      }
      i += 1;
    }
    var q = 0;
    while (q < queue.length) {
      var cur = queue[q];
      q += 1;
      var outs = outgoing[cur] || [];
      var o = 0;
      while (o < outs.length) {
        var nxt = outs[o];
        var cand = (layer[cur] || 0) + 1;
        if (layer[nxt] === undefined || cand > layer[nxt]) {
          layer[nxt] = cand;
        }
        indeg[nxt] -= 1;
        if (indeg[nxt] === 0) {
          queue.push(nxt);
        }
        o += 1;
      }
    }
    var buckets = {};
    i = 0;
    while (i < graph.nodes.length) {
      var node = graph.nodes[i];
      var ly = layer[node.id];
      if (ly === undefined) {
        ly = 0;
      }
      if (!buckets[ly]) {
        buckets[ly] = [];
      }
      buckets[ly].push(node);
      i += 1;
    }
    var vertical = graph.dir === "TD" || graph.dir === "BT" || graph.kind === "class" || graph.kind === "state";
    Object.keys(buckets).forEach(function (key) {
      var list = buckets[key];
      var idx = 0;
      while (idx < list.length) {
        var item = list[idx];
        var L = parseInt(key, 10);
        if (vertical) {
          item.x = 24 + idx * 200;
          item.y = 24 + L * 110;
        } else {
          item.x = 24 + L * 190;
          item.y = 24 + idx * 90;
        }
        idx += 1;
      }
    });
  }

  function defaultC4Type(kind) {
    if (kind === "c4container") {
      return "Container";
    }
    if (kind === "c4component") {
      return "Component";
    }
    return "System";
  }

  function nodeButtonLabel(kind, strings) {
    if (kind === "sequence") {
      return strings.actor;
    }
    if (kind === "class") {
      return strings.cls;
    }
    if (kind === "state") {
      return strings.state;
    }
    if (kind === "er") {
      return strings.entity;
    }
    if (kind === "c4context") {
      return strings.person;
    }
    if (kind === "c4container") {
      return strings.container;
    }
    if (kind === "c4component") {
      return strings.component;
    }
    if (kind === "c4dynamic") {
      return strings.system;
    }
    return strings.node;
  }

  function extraText(node) {
    if (node.members) {
      return node.members;
    }
    if (node.desc) {
      return node.desc;
    }
    if (node.c4type) {
      return node.c4type;
    }
    return "";
  }

  function drawEdges(session) {
    var svg = session.svg;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    var marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "mmd-arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("orient", "auto");
    var tip = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tip.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    tip.setAttribute("fill", "#5c5346");
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);
    var i = 0;
    while (i < session.graph.edges.length) {
      var edge = session.graph.edges[i];
      var fromEl = session.nodeEls[edge.from];
      var toEl = session.nodeEls[edge.to];
      if (fromEl && toEl) {
        var x1 = fromEl.offsetLeft + fromEl.offsetWidth / 2;
        var y1 = fromEl.offsetTop + fromEl.offsetHeight / 2;
        var x2 = toEl.offsetLeft + toEl.offsetWidth / 2;
        var y2 = toEl.offsetTop + toEl.offsetHeight / 2;
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
        line.setAttribute("stroke", session.selectedEdge === i ? "#0b57d0" : "#5c5346");
        line.setAttribute("stroke-width", session.selectedEdge === i ? "3" : "2");
        line.setAttribute("marker-end", "url(#mmd-arrow)");
        line.setAttribute("class", "mmd-edge");
        line.addEventListener(
          "mousedown",
          (function (index) {
            return function (event) {
              event.preventDefault();
              event.stopPropagation();
              session.selectedEdge = index;
              session.selectedId = null;
              drawEdges(session);
              syncSelection(session);
            };
          })(i)
        );
        svg.appendChild(line);
        var caption = edge.label || edge.arrow || "";
        if (caption) {
          var tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
          tx.setAttribute("x", String((x1 + x2) / 2));
          tx.setAttribute("y", String((y1 + y2) / 2 - 6));
          tx.setAttribute("text-anchor", "middle");
          tx.setAttribute("class", "mmd-edge-label");
          tx.textContent = caption;
          svg.appendChild(tx);
        }
      }
      i += 1;
    }
    var maxX = 320;
    var maxY = 180;
    Object.keys(session.nodeEls).forEach(function (id) {
      var el = session.nodeEls[id];
      maxX = Math.max(maxX, el.offsetLeft + el.offsetWidth + 24);
      maxY = Math.max(maxY, el.offsetTop + el.offsetHeight + 24);
    });
    session.canvas.style.minWidth = maxX + "px";
    session.canvas.style.minHeight = maxY + "px";
    svg.setAttribute("width", String(maxX));
    svg.setAttribute("height", String(maxY));
  }

  function syncSelection(session) {
    Object.keys(session.nodeEls).forEach(function (id) {
      session.nodeEls[id].classList.toggle("is-selected", id === session.selectedId);
    });
  }

  function startLabelEdit(session, node, el) {
    var label = el.querySelector(".mmd-label");
    if (!label) {
      return;
    }
    label.contentEditable = "true";
    label.focus();
    function commit() {
      label.contentEditable = "false";
      node.label = (label.textContent || "").trim() || node.id;
      label.textContent = node.label;
      persist(session);
      label.removeEventListener("blur", commit);
    }
    label.addEventListener("blur", commit);
    label.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        label.blur();
      }
      event.stopPropagation();
    });
  }

  function startExtraEdit(session, node, el) {
    var extra = el.querySelector(".mmd-extra");
    if (!extra) {
      return;
    }
    extra.contentEditable = "true";
    extra.focus();
    function commit() {
      extra.contentEditable = "false";
      var text = (extra.textContent || "").replace(/\u00a0/g, " ").trim();
      if (node.c4type && !node.members) {
        node.desc = text;
      } else {
        node.members = text;
      }
      persist(session);
      extra.removeEventListener("blur", commit);
    }
    extra.addEventListener("blur", commit);
    extra.addEventListener("keydown", function (event) {
      event.stopPropagation();
    });
  }

  function bindNode(session, node, el) {
    el.addEventListener("mousedown", function (event) {
      if (event.button !== 0) {
        return;
      }
      if (event.target.isContentEditable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (session.connectFrom === "__pick__") {
        session.connectFrom = node.id;
        session.selectedId = node.id;
        session.selectedEdge = -1;
        syncSelection(session);
        return;
      }
      if (session.connectFrom) {
        if (session.connectFrom !== node.id) {
          var kind = session.graph.kind;
          var arrow = "-->";
          if (kind === "sequence") {
            arrow = "->>";
          }
          if (kind === "er") {
            arrow = "||--o{";
          }
          if (kind === "class") {
            arrow = "<|--";
          }
          if (String(kind).indexOf("c4") === 0) {
            arrow = "Rel";
          }
          session.graph.edges.push({
            from: session.connectFrom,
            to: node.id,
            label: kind === "sequence" ? "message" : "",
            arrow: arrow,
          });
          persist(session);
        }
        session.connectFrom = null;
        session.root.classList.remove("is-connecting");
        session.hint.textContent = tr().hint;
        drawEdges(session);
        return;
      }
      session.selectedId = node.id;
      session.selectedEdge = -1;
      syncSelection(session);
      drawEdges(session);
      session.drag = {
        node: node,
        el: el,
        dx: event.clientX - el.offsetLeft,
        dy: event.clientY - el.offsetTop,
      };
    });
    el.addEventListener("dblclick", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.target.classList && event.target.classList.contains("mmd-extra")) {
        startExtraEdit(session, node, el);
        return;
      }
      startLabelEdit(session, node, el);
    });
  }

  function renderNodes(session) {
    var host = session.nodeHost;
    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }
    session.nodeEls = {};
    var i = 0;
    while (i < session.graph.nodes.length) {
      var node = session.graph.nodes[i];
      var el = document.createElement("div");
      el.className = "mmd-node shape-" + (node.shape || "rect");
      if (node.c4type) {
        el.classList.add("mmd-c4");
      }
      el.style.left = (node.x || 24) + "px";
      el.style.top = (node.y || 24) + "px";
      el.setAttribute("data-id", node.id);
      var label = document.createElement("span");
      label.className = "mmd-label";
      label.textContent = node.label || node.id;
      el.appendChild(label);
      var extra = extraText(node);
      if (extra) {
        var more = document.createElement("div");
        more.className = "mmd-extra";
        more.textContent = extra;
        el.appendChild(more);
      }
      host.appendChild(el);
      session.nodeEls[node.id] = el;
      bindNode(session, node, el);
      i += 1;
    }
    drawEdges(session);
    syncSelection(session);
  }

  function addGraphNode(session) {
    var strings = tr();
    var kind = session.graph.kind;
    var id = nextNodeId(session.graph.nodes, kind === "er" ? "E" : "n");
    var node = {
      id: id,
      label: strings.newLabel,
      shape: "rect",
      x: 24 + session.graph.nodes.length * 16,
      y: 24 + session.graph.nodes.length * 16,
    };
    if (kind === "sequence") {
      node.label = "Actor";
    }
    if (kind === "class") {
      node.label = "Class";
      node.id = id;
      node.members = "+field";
    }
    if (kind === "state") {
      node.label = "State";
    }
    if (kind === "er") {
      node.id = id.toUpperCase();
      node.label = node.id;
      node.members = "string id";
    }
    if (String(kind).indexOf("c4") === 0) {
      node.c4type = kind === "c4context" ? "Person" : defaultC4Type(kind);
      node.label = node.c4type;
      node.desc = "";
      if (node.c4type.indexOf("Person") === 0) {
        node.shape = "circle";
      }
    }
    session.graph.nodes.push(node);
    session.selectedId = node.id;
    session.selectedEdge = -1;
    persist(session);
    renderNodes(session);
  }

  function deleteSelected(session) {
    if (session.mode !== "graph") {
      if (session.selectedIndex >= 0) {
        session.graph.nodes.splice(session.selectedIndex, 1);
        session.selectedIndex = -1;
        persist(session);
        session.redraw();
      }
      return;
    }
    if (session.selectedEdge >= 0) {
      session.graph.edges.splice(session.selectedEdge, 1);
      session.selectedEdge = -1;
      persist(session);
      drawEdges(session);
      return;
    }
    if (!session.selectedId) {
      return;
    }
    var id = session.selectedId;
    session.graph.nodes = session.graph.nodes.filter(function (node) {
      return node.id !== id;
    });
    session.graph.edges = session.graph.edges.filter(function (edge) {
      return edge.from !== id && edge.to !== id;
    });
    session.selectedId = null;
    persist(session);
    renderNodes(session);
  }

  function flushLabels(session) {
    if (!session.nodeEls) {
      return;
    }
    Object.keys(session.nodeEls).forEach(function (id) {
      var el = session.nodeEls[id];
      var label = el && el.querySelector(".mmd-label");
      var node = null;
      var n = 0;
      while (n < session.graph.nodes.length) {
        if (session.graph.nodes[n].id === id) {
          node = session.graph.nodes[n];
          break;
        }
        n += 1;
      }
      if (!node || !label) {
        return;
      }
      var text = (label.textContent || "").trim() || node.id;
      if (text !== node.label) {
        node.label = text;
        session.dirty = true;
      }
      var extra = el.querySelector(".mmd-extra");
      if (extra) {
        var more = (extra.textContent || "").trim();
        if (node.c4type && !node.members) {
          if (more !== (node.desc || "")) {
            node.desc = more;
            session.dirty = true;
          }
        } else if (more !== (node.members || "")) {
          node.members = more;
          session.dirty = true;
        }
      }
    });
  }

  function closeEditor(rerender) {
    if (!active) {
      return;
    }
    var session = active;
    flushLabels(session);
    active = null;
    session.widget.classList.remove("mmd-editing");
    session.widget.removeAttribute("tabindex");
    if (rerender) {
      if (session.dirty) {
        persist(session);
      }
      hooks.renderWidget(session.widget).then(function () {
        bindWidget(session.widget);
      });
    }
  }

  function shell(widget, hintText) {
    widget.classList.add("mmd-editing");
    widget.tabIndex = 0;
    widget.innerHTML = "";
    var root = document.createElement("div");
    root.className = "mmd-edit";
    var bar = document.createElement("div");
    bar.className = "mmd-edit-bar";
    var hint = document.createElement("div");
    hint.className = "mmd-edit-hint";
    hint.textContent = hintText;
    root.appendChild(bar);
    root.appendChild(hint);
    widget.appendChild(root);
    return { root: root, bar: bar, hint: hint };
  }

  function openGraphEditor(widget, graph) {
    layoutGraph(graph);
    var strings = tr();
    var ui = shell(widget, strings.hint);
    var canvas = document.createElement("div");
    canvas.className = "mmd-canvas";
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "mmd-edges");
    var nodeHost = document.createElement("div");
    nodeHost.className = "mmd-nodes";
    canvas.appendChild(svg);
    canvas.appendChild(nodeHost);
    ui.root.appendChild(canvas);
    var session = {
      mode: "graph",
      widget: widget,
      graph: graph,
      root: ui.root,
      canvas: canvas,
      svg: svg,
      nodeHost: nodeHost,
      hint: ui.hint,
      nodeEls: {},
      selectedId: null,
      selectedEdge: -1,
      selectedIndex: -1,
      connectFrom: null,
      drag: null,
      dirty: false,
      redraw: function () {
        renderNodes(session);
      },
    };
    active = session;
    var nodeBtn = addBtn(ui.bar, "node", nodeButtonLabel(graph.kind, strings));
    var edgeBtn = addBtn(ui.bar, "edge", strings.edge);
    var delBtn = addBtn(ui.bar, "del", strings.del);
    var doneBtn = addBtn(ui.bar, "done", strings.done);
    nodeBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      session.connectFrom = null;
      session.root.classList.remove("is-connecting");
      addGraphNode(session);
    });
    edgeBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!session.selectedId) {
        session.hint.textContent = strings.connect;
        session.root.classList.add("is-connecting");
        session.connectFrom = "__pick__";
        return;
      }
      session.connectFrom = session.selectedId;
      session.root.classList.add("is-connecting");
      session.hint.textContent = strings.connect;
    });
    delBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected(session);
    });
    doneBtn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeEditor(true);
    });
    canvas.addEventListener("mousedown", function () {
      widget.focus();
    });
    canvas.addEventListener("mousemove", function (event) {
      if (!session.drag) {
        return;
      }
      var x = Math.max(8, event.clientX - session.drag.dx);
      var y = Math.max(8, event.clientY - session.drag.dy);
      session.drag.node.x = x;
      session.drag.node.y = y;
      session.drag.el.style.left = x + "px";
      session.drag.el.style.top = y + "px";
      drawEdges(session);
    });
    canvas.addEventListener("mouseup", function () {
      session.drag = null;
    });
    canvas.addEventListener("mouseleave", function () {
      session.drag = null;
    });
    widget.focus();
    renderNodes(session);
  }

  function openListEditor(widget, graph, spec) {
    var strings = tr();
    var ui = shell(widget, spec.hint || strings.hint);
    var list = document.createElement("div");
    list.className = "mmd-list";
    ui.root.appendChild(list);
    var session = {
      mode: "list",
      widget: widget,
      graph: graph,
      selectedIndex: -1,
      dirty: false,
      redraw: function () {
        draw();
      },
    };
    active = session;
    function draw() {
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
      if (spec.header) {
        spec.header(list, session);
      }
      var i = 0;
      while (i < graph.nodes.length) {
        (function (index) {
          var node = graph.nodes[index];
          var row = document.createElement("div");
          row.className = "mmd-row" + (session.selectedIndex === index ? " is-selected" : "");
          spec.renderRow(row, node, function () {
            persist(session);
          });
          row.addEventListener("click", function () {
            session.selectedIndex = index;
            draw();
          });
          list.appendChild(row);
        })(i);
        i += 1;
      }
    }
    addBtn(ui.bar, "node", spec.addLabel).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      spec.add(graph);
      persist(session);
      draw();
    });
    addBtn(ui.bar, "del", strings.del).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected(session);
    });
    addBtn(ui.bar, "done", strings.done).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeEditor(true);
    });
    widget.focus();
    draw();
  }

  function openPieEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.slice,
      add: function (g) {
        g.nodes.push({ id: "s" + g.nodes.length, label: "Item", value: 10, shape: "rect" });
      },
      renderRow: function (row, node, onChange) {
        var a = document.createElement("input");
        a.type = "text";
        a.value = node.label;
        a.addEventListener("input", function () {
          node.label = a.value;
          onChange();
        });
        var b = document.createElement("input");
        b.type = "number";
        b.value = String(node.value || 0);
        b.addEventListener("input", function () {
          node.value = Number(b.value) || 0;
          onChange();
        });
        row.appendChild(a);
        row.appendChild(b);
      },
    });
  }

  function openGanttEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.task,
      add: function (g) {
        g.nodes.push({
          id: "t" + g.nodes.length,
          label: "Task",
          extra: "2026-01-01, 7d",
          section: "Work",
          shape: "rect",
        });
      },
      renderRow: function (row, node, onChange) {
        ["section", "label", "extra"].forEach(function (key) {
          var inp = document.createElement("input");
          inp.type = "text";
          inp.value = node[key] || "";
          inp.addEventListener("input", function () {
            node[key] = inp.value;
            onChange();
          });
          row.appendChild(inp);
        });
      },
    });
  }

  function openTimelineEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.step,
      add: function (g) {
        g.nodes.push({ id: "t" + g.nodes.length, label: "2026", extra: "Event", shape: "rect" });
      },
      renderRow: function (row, node, onChange) {
        var a = document.createElement("input");
        a.type = "text";
        a.value = node.label;
        a.addEventListener("input", function () {
          node.label = a.value;
          onChange();
        });
        var b = document.createElement("input");
        b.type = "text";
        b.value = node.extra || "";
        b.addEventListener("input", function () {
          node.extra = b.value;
          onChange();
        });
        row.appendChild(a);
        row.appendChild(b);
      },
    });
  }

  function openJourneyEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.step,
      add: function (g) {
        g.nodes.push({
          id: "j" + g.nodes.length,
          label: "Step",
          value: 3,
          extra: "User",
          section: "Section",
          shape: "rect",
        });
      },
      renderRow: function (row, node, onChange) {
        ["section", "label", "extra"].forEach(function (key) {
          var inp = document.createElement("input");
          inp.type = "text";
          inp.value = node[key] || "";
          inp.addEventListener("input", function () {
            node[key] = inp.value;
            onChange();
          });
          row.appendChild(inp);
        });
        var score = document.createElement("input");
        score.type = "number";
        score.min = "1";
        score.max = "5";
        score.value = String(node.value || 3);
        score.addEventListener("input", function () {
          node.value = Number(score.value) || 3;
          onChange();
        });
        row.appendChild(score);
      },
    });
  }

  function openQuadrantEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.point,
      header: function (list, session) {
        var title = document.createElement("input");
        title.type = "text";
        title.value = graph.title || "";
        title.placeholder = "title";
        title.addEventListener("input", function () {
          graph.title = title.value;
          persist(session);
        });
        list.appendChild(title);
      },
      add: function (g) {
        g.nodes.push({ id: "p" + g.nodes.length, label: "Point", x: 0.5, y: 0.5, shape: "circle" });
      },
      renderRow: function (row, node, onChange) {
        var a = document.createElement("input");
        a.type = "text";
        a.value = node.label;
        a.addEventListener("input", function () {
          node.label = a.value;
          onChange();
        });
        var x = document.createElement("input");
        x.type = "number";
        x.step = "0.1";
        x.min = "0";
        x.max = "1";
        x.value = String(node.x != null ? node.x : 0.5);
        x.addEventListener("input", function () {
          node.x = Number(x.value);
          onChange();
        });
        var y = document.createElement("input");
        y.type = "number";
        y.step = "0.1";
        y.min = "0";
        y.max = "1";
        y.value = String(node.y != null ? node.y : 0.5);
        y.addEventListener("input", function () {
          node.y = Number(y.value);
          onChange();
        });
        row.appendChild(a);
        row.appendChild(x);
        row.appendChild(y);
      },
    });
  }

  function openGitEditor(widget, graph) {
    var strings = tr();
    var ui = shell(widget, strings.hint);
    var list = document.createElement("div");
    list.className = "mmd-list";
    ui.root.appendChild(list);
    var session = {
      mode: "list",
      widget: widget,
      graph: graph,
      selectedIndex: -1,
      dirty: false,
      redraw: function () {
        draw();
      },
    };
    active = session;
    function draw() {
      while (list.firstChild) {
        list.removeChild(list.firstChild);
      }
      var i = 0;
      while (i < graph.nodes.length) {
        (function (index) {
          var node = graph.nodes[index];
          var row = document.createElement("div");
          row.className = "mmd-row" + (session.selectedIndex === index ? " is-selected" : "");
          var inp = document.createElement("input");
          inp.type = "text";
          inp.value = node.extra || node.label;
          inp.addEventListener("input", function () {
            node.extra = inp.value;
            node.label = inp.value;
            persist(session);
          });
          row.appendChild(inp);
          row.addEventListener("click", function () {
            session.selectedIndex = index;
            draw();
          });
          list.appendChild(row);
        })(i);
        i += 1;
      }
    }
    function addLine(text) {
      graph.nodes.push({
        id: "g" + graph.nodes.length,
        label: text,
        extra: text,
        shape: "rect",
      });
      persist(session);
      draw();
    }
    addBtn(ui.bar, "commit", strings.commit).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      addLine('commit id: "' + nextNodeId(graph.nodes, "c") + '"');
    });
    addBtn(ui.bar, "branch", strings.branch).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var name = nextNodeId(graph.nodes, "br");
      addLine("branch " + name);
      addLine("checkout " + name);
    });
    addBtn(ui.bar, "merge", strings.merge).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      addLine("checkout main");
      addLine("merge develop");
    });
    addBtn(ui.bar, "del", strings.del).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected(session);
    });
    addBtn(ui.bar, "done", strings.done).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeEditor(true);
    });
    widget.focus();
    draw();
  }

  function openMindmapEditor(widget, graph) {
    var strings = tr();
    openListEditor(widget, graph, {
      addLabel: strings.child,
      add: function (g) {
        var parent = g.nodes.length ? g.nodes[0].id : "";
        var id = nextNodeId(g.nodes, "m");
        g.nodes.push({ id: id, label: "Idea", parent: parent, shape: "rect" });
      },
      renderRow: function (row, node, onChange) {
        var a = document.createElement("input");
        a.type = "text";
        a.value = node.label;
        a.addEventListener("input", function () {
          node.label = a.value;
          onChange();
        });
        row.appendChild(a);
      },
    });
  }

  function openKanbanEditor(widget, graph) {
    var strings = tr();
    if (!graph.extras.columns || graph.extras.columns.length === 0) {
      graph.extras.columns = ["Todo", "Doing", "Done"];
    }
    var ui = shell(widget, strings.hint);
    var board = document.createElement("div");
    board.className = "mmd-kanban";
    ui.root.appendChild(board);
    var session = {
      mode: "list",
      widget: widget,
      graph: graph,
      selectedIndex: -1,
      dirty: false,
      redraw: function () {
        draw();
      },
    };
    active = session;
    function draw() {
      while (board.firstChild) {
        board.removeChild(board.firstChild);
      }
      var cols = graph.extras.columns;
      var c = 0;
      while (c < cols.length) {
        (function (col) {
          var colEl = document.createElement("div");
          colEl.className = "mmd-kanban-col";
          var head = document.createElement("input");
          head.type = "text";
          head.value = col;
          head.addEventListener("change", function () {
            var old = col;
            var next = head.value || old;
            var i = 0;
            while (i < graph.nodes.length) {
              if (graph.nodes[i].section === old) {
                graph.nodes[i].section = next;
              }
              i += 1;
            }
            var idx = graph.extras.columns.indexOf(old);
            if (idx >= 0) {
              graph.extras.columns[idx] = next;
            }
            persist(session);
            draw();
          });
          colEl.appendChild(head);
          var i = 0;
          while (i < graph.nodes.length) {
            if (graph.nodes[i].section === col) {
              (function (index) {
                var card = document.createElement("input");
                card.type = "text";
                card.className = "mmd-kanban-card";
                card.value = graph.nodes[index].label;
                card.addEventListener("input", function () {
                  graph.nodes[index].label = card.value;
                  persist(session);
                });
                card.addEventListener("focus", function () {
                  session.selectedIndex = index;
                });
                colEl.appendChild(card);
              })(i);
            }
            i += 1;
          }
          board.appendChild(colEl);
        })(cols[c]);
        c += 1;
      }
    }
    addBtn(ui.bar, "card", strings.card).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      graph.nodes.push({
        id: "k" + graph.nodes.length,
        label: "Card",
        section: graph.extras.columns[0] || "Todo",
        shape: "rect",
      });
      persist(session);
      draw();
    });
    addBtn(ui.bar, "column", strings.column).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      graph.extras.columns.push("Column");
      persist(session);
      draw();
    });
    addBtn(ui.bar, "del", strings.del).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected(session);
      draw();
    });
    addBtn(ui.bar, "done", strings.done).addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeEditor(true);
    });
    widget.focus();
    draw();
  }

  function openEditor(widget) {
    var src = decodeURIComponent(widget.getAttribute("data-mermaid") || "");
    var graph = Kinds.parseDocument(src);
    if (!graph) {
      graph = Kinds.parseDocument(Kinds.template("flowchart"));
    }
    if (active && active.widget !== widget) {
      closeEditor(true);
    }
    var kind = graph.kind;
    if (Kinds.isGraphKind(kind)) {
      openGraphEditor(widget, graph);
      return;
    }
    if (kind === "pie") {
      openPieEditor(widget, graph);
      return;
    }
    if (kind === "gantt") {
      openGanttEditor(widget, graph);
      return;
    }
    if (kind === "timeline") {
      openTimelineEditor(widget, graph);
      return;
    }
    if (kind === "journey") {
      openJourneyEditor(widget, graph);
      return;
    }
    if (kind === "quadrant") {
      openQuadrantEditor(widget, graph);
      return;
    }
    if (kind === "git") {
      openGitEditor(widget, graph);
      return;
    }
    if (kind === "mindmap") {
      openMindmapEditor(widget, graph);
      return;
    }
    if (kind === "kanban") {
      openKanbanEditor(widget, graph);
      return;
    }
    openGraphEditor(widget, graph);
  }

  function onEditorKey(event) {
    if (!active || active.widget !== event.currentTarget) {
      return;
    }
    var editing = event.target && event.target.isContentEditable;
    if (editing || (event.target && event.target.tagName === "INPUT")) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected(active);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeEditor(true);
    }
  }

  function bindWidget(widget) {
    if (widget.getAttribute("data-mmd-bound") === "1") {
      return;
    }
    widget.setAttribute("data-mmd-bound", "1");
    widget.title = tr().editTitle;
    widget.addEventListener("keydown", onEditorKey);
    widget.addEventListener("dblclick", function (event) {
      if (widget.classList.contains("mmd-editing")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openEditor(widget);
    });
  }

  function bindAll(root) {
    if (!root) {
      return;
    }
    if (root.classList && root.classList.contains("mermaid-widget")) {
      bindWidget(root);
      return;
    }
    if (!root.querySelectorAll) {
      return;
    }
    var nodes = root.querySelectorAll(".mermaid-widget");
    var i = 0;
    while (i < nodes.length) {
      bindWidget(nodes[i]);
      i += 1;
    }
  }

  function insertAtCaret(el) {
    var article = document.getElementById("doc");
    article.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && article.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      var host = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (host && host.closest(".mermaid-widget")) {
        article.appendChild(el);
        return;
      }
      range.deleteContents();
      range.insertNode(el);
      return;
    }
    article.appendChild(el);
  }

  function insertKind(kindId) {
    var src = Kinds.template(kindId || "flowchart");
    var widget = document.createElement("div");
    widget.className = "mermaid-widget";
    widget.contentEditable = "false";
    widget.setAttribute("data-mermaid", encodeURIComponent(src));
    insertAtCaret(widget);
    hooks.scheduleNotify();
    hooks.renderWidget(widget).then(function () {
      bindWidget(widget);
      openEditor(widget);
    });
  }

  document.addEventListener(
    "mousedown",
    function (event) {
      if (!active) {
        return;
      }
      if (active.widget.contains(event.target)) {
        return;
      }
      closeEditor(true);
    },
    true
  );

  root.MermaidEdit = {
    attach: function (next) {
      if (next.scheduleNotify) {
        hooks.scheduleNotify = next.scheduleNotify;
      }
      if (next.renderWidget) {
        hooks.renderWidget = next.renderWidget;
      }
    },
    bind: bindAll,
    insert: insertKind,
    open: openEditor,
  };
})(typeof window !== "undefined" ? window : globalThis);

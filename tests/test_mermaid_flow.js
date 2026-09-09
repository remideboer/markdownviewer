var path = require("path");
var kinds = require(path.join(__dirname, "..", "web", "mermaid-kinds.js"));

var failed = 0;

function assertTrue(name, cond) {
  if (!cond) {
    failed += 1;
    console.log("FAIL " + name);
  } else {
    console.log("PASS " + name);
  }
}

function ids(graph) {
  return graph.nodes
    .map(function (n) {
      return n.id;
    })
    .join(",");
}

function edgePairs(graph) {
  return graph.edges
    .map(function (e) {
      return e.from + "->" + e.to + (e.label ? ":" + e.label : "");
    })
    .join(",");
}

function roundtrip(kind, src) {
  var g = kinds.parseKind(kind, src) || kinds.parseDocument(src);
  var out = kinds.serialize(g);
  var g2 = kinds.parseDocument(out);
  return g && g2 && g2.kind === kind;
}

console.log("=== mermaid kinds ===");

assertTrue("rejects empty", kinds.parseFlowchart("") === null);
assertTrue("detect sequence", kinds.detectKind("sequenceDiagram\nA->>B: hi") === "sequence");
assertTrue("flowchart skips subgraph", kinds.parseFlowchart("flowchart LR\nsubgraph s\nA --> B\nend") !== null);

var empty = kinds.parseFlowchart("flowchart LR");
assertTrue("empty header", empty !== null && empty.nodes.length === 0 && empty.dir === "LR");

var demo = [
  "flowchart LR",
  "  start((start)) --> open[Open markdown]",
  "  open --> render[Toon tekst en mermaid]",
  "  render --> edit[Wijzig gerenderde tekst]",
  "  edit --> save[Sla markdown op]",
].join("\n");

var g = kinds.parseFlowchart(demo);
assertTrue("demo parses", g !== null);
assertTrue("demo dir", g.dir === "LR");
assertTrue("demo nodes", ids(g) === "start,open,render,edit,save");
assertTrue("demo edges", edgePairs(g) === "start->open,open->render,render->edit,edit->save");
assertTrue("start is circle", g.nodes[0].shape === "circle" && g.nodes[0].label === "start");
assertTrue("open label", g.nodes[1].shape === "rect" && g.nodes[1].label === "Open markdown");

var out = kinds.serializeFlowchart(g);
var g2 = kinds.parseFlowchart(out);
assertTrue("roundtrip nodes", ids(g2) === ids(g));
assertTrue("roundtrip edges", edgePairs(g2) === edgePairs(g));
assertTrue("roundtrip start shape", g2.nodes[0].shape === "circle");

var td = kinds.parseFlowchart("graph TB\n  a(A) --> b{B}");
assertTrue("graph TB is TD", td !== null && td.dir === "TD");
assertTrue("round shape", td.nodes[0].shape === "round" && td.nodes[0].label === "A");
assertTrue("diamond shape", td.nodes[1].shape === "diamond" && td.nodes[1].label === "B");

var labeled = kinds.parseFlowchart("flowchart LR\n  a[A] -->|yes| b[B]");
assertTrue("edge label", labeled !== null && labeled.edges[0].label === "yes");
assertTrue("quoted label", kinds.parseFlowchart('flowchart LR\n  a["x[y]"] --> b[z]').nodes[0].label === "x[y]");
assertTrue("chain edges", edgePairs(kinds.parseFlowchart("flowchart LR\n  a[A] --> b[B] --> c[C]")) === "a->b,b->c");
assertTrue("end as node id", ids(kinds.parseFlowchart("flowchart LR\n  start --> end")) === "start,end");

var seq = kinds.parseDocument(kinds.template("sequence"));
assertTrue("sequence template", seq && seq.kind === "sequence" && seq.nodes.length === 2 && seq.edges.length === 1);
assertTrue("sequence roundtrip", roundtrip("sequence", kinds.template("sequence")));

var cls = kinds.parseDocument(kinds.template("class"));
assertTrue("class template", cls && cls.kind === "class" && cls.nodes.length >= 2);
assertTrue("class members", (cls.nodes[0].members || "").indexOf("name") >= 0);
assertTrue("class roundtrip", roundtrip("class", kinds.template("class")));

var st = kinds.parseDocument(kinds.template("state"));
assertTrue("state template", st && st.kind === "state" && st.edges.length >= 2);
assertTrue("state roundtrip", roundtrip("state", kinds.template("state")));

var er = kinds.parseDocument(kinds.template("er"));
assertTrue("er template", er && er.kind === "er" && er.edges.length === 1);
assertTrue("er roundtrip", roundtrip("er", kinds.template("er")));

var c4 = kinds.parseDocument(kinds.template("c4context"));
assertTrue("c4 template", c4 && c4.kind === "c4context" && c4.nodes.length === 2 && c4.edges.length === 1);
assertTrue("c4 person", c4.nodes[0].c4type === "Person");
assertTrue("c4 roundtrip", roundtrip("c4context", kinds.template("c4context")));
assertTrue("c4 container", kinds.parseDocument(kinds.template("c4container")).kind === "c4container");
assertTrue("c4 component", kinds.parseDocument(kinds.template("c4component")).kind === "c4component");
assertTrue("c4 dynamic", kinds.parseDocument(kinds.template("c4dynamic")).kind === "c4dynamic");

var pie = kinds.parseDocument(kinds.template("pie"));
assertTrue("pie template", pie && pie.nodes.length === 3 && pie.nodes[0].value === 40);
assertTrue("pie roundtrip", roundtrip("pie", kinds.template("pie")));

assertTrue("gantt roundtrip", roundtrip("gantt", kinds.template("gantt")));
assertTrue("timeline roundtrip", roundtrip("timeline", kinds.template("timeline")));
assertTrue("journey roundtrip", roundtrip("journey", kinds.template("journey")));
assertTrue("quadrant roundtrip", roundtrip("quadrant", kinds.template("quadrant")));
assertTrue("git roundtrip", roundtrip("git", kinds.template("git")));
assertTrue("mindmap roundtrip", roundtrip("mindmap", kinds.template("mindmap")));
assertTrue("kanban roundtrip", roundtrip("kanban", kinds.template("kanban")));

assertTrue("picker count", kinds.KIND_IDS.length === 17);
assertTrue("graph kind sequence", kinds.isGraphKind("sequence"));
assertTrue("not graph pie", !kinds.isGraphKind("pie"));

console.log("=== mermaid kinds done ===");
if (failed > 0) {
  process.exit(1);
}

var path = require("path");
var extra = require(path.join(__dirname, "..", "web", "md-extra.js"));

var failed = 0;

function assertTrue(name, cond) {
  if (!cond) {
    failed += 1;
    console.log("FAIL " + name);
  } else {
    console.log("PASS " + name);
  }
}

console.log("=== markdown extra ===");

assertTrue("split header", extra.escapedSplit("| a | b |").join(",") === "a,b");
assertTrue("split no edges", extra.escapedSplit("a | b").join(",") === "a,b");
assertTrue("split escaped pipe", extra.escapedSplit("| a \\| b | c |").join(",") === "a | b,c");
assertTrue("sep row", extra.isSeparatorRow("| --- | :---: | ---: |"));
assertTrue("not sep", !extra.isSeparatorRow("| a | b |"));

function fakeTable(rows) {
  return {
    rows: rows.map(function (cells) {
      return {
        cells: cells.map(function (text) {
          return {
            textContent: text,
            getAttribute: function () {
              return "";
            },
          };
        }),
      };
    }),
  };
}

var mdTable = extra.tableToMarkdown(
  fakeTable([
    ["Name", "Role"],
    ["Ada", "Engineer"],
  ])
);
assertTrue("table header", mdTable.indexOf("| Name | Role |") >= 0);
assertTrue("table sep", mdTable.indexOf("| --- | --- |") >= 0);
assertTrue("table body", mdTable.indexOf("| Ada | Engineer |") >= 0);

function fakeDl(pairs) {
  var children = [];
  var i = 0;
  while (i < pairs.length) {
    children.push({ nodeName: "DT", textContent: pairs[i][0] });
    children.push({ nodeName: "DD", textContent: pairs[i][1] });
    i += 1;
  }
  return { children: children };
}

var dl = extra.deflistToMarkdown(fakeDl([["CPU", "Processor"]]));
assertTrue("deflist term", dl.indexOf("CPU") >= 0);
assertTrue("deflist def", dl.indexOf(": Processor") >= 0);

var markdownit = null;
try {
  markdownit = require(path.join(__dirname, "..", "web", "vendor", "markdown-it.min.js"));
} catch (err) {
  markdownit = null;
}

if (typeof markdownit === "function") {
  var md = markdownit({ html: false, linkify: true, breaks: false });
  extra.install(md, null);
  var tableHtml = md.render("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
  assertTrue("render table", tableHtml.indexOf("<table>") >= 0 && tableHtml.indexOf("<th>") >= 0);
  var strikeHtml = md.render("~~gone~~");
  assertTrue("render strike", strikeHtml.indexOf("<del>") >= 0);
  var defHtml = md.render("Term\n: Meaning\n");
  assertTrue("render deflist", defHtml.indexOf("<dl>") >= 0 && defHtml.indexOf("<dt>") >= 0);
} else {
  console.log("SKIP markdown-it render (browser bundle)");
}

if (failed > 0) {
  console.log("=== markdown extra FAILED " + failed + " ===");
  process.exit(1);
}
console.log("=== markdown extra done ===");

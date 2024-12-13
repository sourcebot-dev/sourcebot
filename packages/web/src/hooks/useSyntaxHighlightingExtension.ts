'use client';

import { EditorView } from "@codemirror/view";
import { useExtensionWithDependency } from "./useExtensionWithDependency";
import { StreamLanguage } from "@codemirror/language";

// CodeMirror 6 languages

import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { csharp } from "@replit/codemirror-lang-csharp";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { less } from "@codemirror/lang-less";
import { liquid } from "@codemirror/lang-liquid";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { sql } from "@codemirror/lang-sql";
import { vue } from "@codemirror/lang-vue";
import { xml } from "@codemirror/lang-xml"
import { yaml } from "@codemirror/lang-yaml";

// Legacy CodeMirror 5 modes
// https://codemirror.net/5/mode/
import { apl } from "@codemirror/legacy-modes/mode/apl";
// import { asn1 } from "@codemirror/legacy-modes/mode/asn1"; // this seems to be broken
import { ceylon } from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { coffeeScript } from "@codemirror/legacy-modes/mode/coffeescript";
import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { crystal } from "@codemirror/legacy-modes/mode/crystal";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { d } from "@codemirror/legacy-modes/mode/d";
import { dart } from "@codemirror/legacy-modes/mode/clike";
// import { django } from "@codemirror/legacy-modes/mode/django"; // not present anymore
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { fortran } from "@codemirror/legacy-modes/mode/fortran";
import { gherkin } from "@codemirror/legacy-modes/mode/gherkin";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { idl } from "@codemirror/legacy-modes/mode/idl";
import { jinja2 } from "@codemirror/legacy-modes/mode/jinja2";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { liveScript } from "@codemirror/legacy-modes/mode/livescript";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { nesC } from "@codemirror/legacy-modes/mode/clike";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { objectiveC } from "@codemirror/legacy-modes/mode/clike";
import { objectiveCpp } from "@codemirror/legacy-modes/mode/clike";
import { octave } from "@codemirror/legacy-modes/mode/octave";
import { pascal } from "@codemirror/legacy-modes/mode/pascal";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import { puppet } from "@codemirror/legacy-modes/mode/puppet";
import { r } from "@codemirror/legacy-modes/mode/r";
import { rpmSpec } from "@codemirror/legacy-modes/mode/rpm";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { scala } from "@codemirror/legacy-modes/mode/clike";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
import { shader } from "@codemirror/legacy-modes/mode/clike";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { squirrel } from "@codemirror/legacy-modes/mode/clike";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { tcl } from "@codemirror/legacy-modes/mode/tcl";
import { textile } from "@codemirror/legacy-modes/mode/textile";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
// import { twig } from "@codemirror/legacy-modes/mode/twig"; // not present anymore
import { vb } from "@codemirror/legacy-modes/mode/vb";
import { vbScript } from "@codemirror/legacy-modes/mode/vbscript";
import { velocity } from "@codemirror/legacy-modes/mode/velocity";
// import { vue } from "@codemirror/legacy-modes/mode/vue"; // not present anymore
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { wast } from "@codemirror/legacy-modes/mode/wast"; // webassembly
import { yacas } from "@codemirror/legacy-modes/mode/yacas";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";

export const useSyntaxHighlightingExtension = (language: string, view: EditorView | undefined) => {
    const extension = useExtensionWithDependency(
        view ?? null,
        () => {
            return getSyntaxHighlightingExtension(language);
        },
        [language]
    );

    return extension;
}

export const getSyntaxHighlightingExtension = (language: string) => {
    // maps linguist language defs to CodeMirror 6 language extensions
    // and legacy CodeMirror 5 modes
    switch (language.toLowerCase()) {
        // CodeMirror 6 languages
        case "css":
            return css();
        case "c":
        case "c++":
            return cpp();
        case "c#":
            return csharp();
        case "go":
            return go();
        case "html":
            return html();
        case "java":
            return java();
        case "jsx":
        case "tsx":
        case "typescript":
        case "javascript":
            return javascript({
                jsx: true,
                typescript: true,
            });
        case "json":
        case "oasv2-json":
        case "oasv3-json":
        case "jupyter notebook":
            return json();
        case "less":
            return less();
        case "liquid":
            return liquid();
        case "markdown":
            return markdown();
        case "php":
            return php();
        case "python":
            return python();
        case "rust":
            return rust();
        case "sass":
            return sass();
        case "sql":
            return sql();
        case "vue":
            return vue();
        case "xml":
            return xml();
        case "yaml":
        case "oasv2-yaml":
        case "oasv3-yaml":
            return yaml();

        // Legacy CodeMirror 5 modes
        case "apl":
            return StreamLanguage.define(apl);
        // case "asn.1":
        //     return StreamLanguage.define(asn1);
        case "ceylon":
            return StreamLanguage.define(ceylon);
        case "clojure":
            return StreamLanguage.define(clojure);
        case "cmake":
            return StreamLanguage.define(cmake);
        case "cobol":
            return StreamLanguage.define(cobol);
        case "coffeescript":
            return StreamLanguage.define(coffeeScript);
        case "common lisp":
            return StreamLanguage.define(commonLisp);
        case "crystal":
            return StreamLanguage.define(crystal);
        case "cypher":
            return StreamLanguage.define(cypher);
        case "d":
            return StreamLanguage.define(d);
        case "dart":
            return StreamLanguage.define(dart);
        case "dockerfile":
            return StreamLanguage.define(dockerFile);
        case "diff":
            return StreamLanguage.define(diff);
        case "elm":
            return StreamLanguage.define(elm);
        case "erlang":
            return StreamLanguage.define(erlang);
        case "fortran":
            return StreamLanguage.define(fortran);
        case "gherkin":
            return StreamLanguage.define(gherkin);
        case "groovy":
            return StreamLanguage.define(groovy);
        case "haskell":
            return StreamLanguage.define(haskell);
        case "idl":
            return StreamLanguage.define(idl);
        case "jinja":
            return StreamLanguage.define(jinja2);
        case "julia":
            return StreamLanguage.define(julia);
        case "kotlin":
            return StreamLanguage.define(kotlin);
        case "livescript":
            return StreamLanguage.define(liveScript);
        case "lua":
            return StreamLanguage.define(lua);
        case "nesc":
            return StreamLanguage.define(nesC);
        case "nginx":
            return StreamLanguage.define(nginx);
        case "objective-c":
            return StreamLanguage.define(objectiveC);
        case "objective-c++":
            return StreamLanguage.define(objectiveCpp);
        case "octave":
            return StreamLanguage.define(octave);
        case "pascal":
            return StreamLanguage.define(pascal);
        case "perl":
            return StreamLanguage.define(perl);
        case "powershell":
            return StreamLanguage.define(powerShell);
        case "protocol buffer":
            return StreamLanguage.define(protobuf);
        case "pug":
            return StreamLanguage.define(pug);
        case "puppet":
            return StreamLanguage.define(puppet);
        case "r":
            return StreamLanguage.define(r);
        case "rpm spec":
            return StreamLanguage.define(rpmSpec);
        case "ruby":
            return StreamLanguage.define(ruby);
        case "scala":
            return StreamLanguage.define(scala);
        case "scheme":
            return StreamLanguage.define(scheme);
        case "shader":
            return StreamLanguage.define(shader);
        case "shell":
            return StreamLanguage.define(shell);
        case "squirrel":
            return StreamLanguage.define(squirrel);
        case "swift":
            return StreamLanguage.define(swift);
        case "tcl":
            return StreamLanguage.define(tcl);
        case "textile":
            return StreamLanguage.define(textile);
        case "stex":
            return StreamLanguage.define(stex);
        case "toml":
            return StreamLanguage.define(toml);
        case "turtle":
            return StreamLanguage.define(turtle);
        case "vb":
            return StreamLanguage.define(vb);
        case "vbscript":
            return StreamLanguage.define(vbScript);
        case "velocity":
            return StreamLanguage.define(velocity);
        case "verilog":
            return StreamLanguage.define(verilog);
        case "vhdl":
            return StreamLanguage.define(vhdl);
        case "wast":
            return StreamLanguage.define(wast);
        case "yacas":
            return StreamLanguage.define(yacas);
        case "xquery":
            return StreamLanguage.define(xQuery);
        // plain text
        default:
            return [];
    }
}

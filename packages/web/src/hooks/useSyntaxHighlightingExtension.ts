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
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { coffeeScript } from "@codemirror/legacy-modes/mode/coffeescript";
import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { d } from "@codemirror/legacy-modes/mode/d";
// import { dart } from "@codemirror/legacy-modes/mode/dart";
// import { django } from "@codemirror/legacy-modes/mode/django";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { fortran } from "@codemirror/legacy-modes/mode/fortran";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { jinja2 } from "@codemirror/legacy-modes/mode/jinja2";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { liveScript } from "@codemirror/legacy-modes/mode/livescript";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
// import { octave } from "@codemirror/legacy-modes/mode/octave";
import { pascal } from "@codemirror/legacy-modes/mode/pascal";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import { puppet } from "@codemirror/legacy-modes/mode/puppet";
import { r } from "@codemirror/legacy-modes/mode/r";
import { rpmSpec } from "@codemirror/legacy-modes/mode/rpm";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { tcl } from "@codemirror/legacy-modes/mode/tcl";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
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
    // console.log(language.toLowerCase()); // uncomment to debug
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
        case "d":
            return StreamLanguage.define(d);
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
        case "groovy":
            return StreamLanguage.define(groovy);
        case "haskell":
            return StreamLanguage.define(haskell);
        case "jinja":
            return StreamLanguage.define(jinja2);
        case "julia":
            return StreamLanguage.define(julia);
        case "livescript":
            return StreamLanguage.define(liveScript);
        case "lua":
            return StreamLanguage.define(lua);
        case "nginx":
            return StreamLanguage.define(nginx);
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
        case "scheme":
            return StreamLanguage.define(scheme);
        case "shell":
            return StreamLanguage.define(shell);
        case "swift":
            return StreamLanguage.define(swift);
        case "tcl":
            return StreamLanguage.define(tcl);
        case "toml":
            return StreamLanguage.define(toml);
        case "verilog":
            return StreamLanguage.define(verilog);
        case "vhdl":
            return StreamLanguage.define(vhdl);
        case "xquery":
            return StreamLanguage.define(xQuery);
        // plain text
        default:
            return [];
    }
}

import { StreamLanguage, LanguageSupport } from "@codemirror/language";

// CodeMirror 6 languages
import { brainfuck } from "codemirror-lang-brainfuck"; // 3rd party
import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { dot } from "@viz-js/lang-dot"; // 3rd party
import { csharp } from "@replit/codemirror-lang-csharp"; // 3rd party
import { elixir } from "codemirror-lang-elixir"; // 3rd party
import { go } from "@codemirror/lang-go";
import { graphqlLanguageSupport } from "cm6-graphql"; // 3rd party
import { handlebarsLanguage } from "@xiechao/codemirror-lang-handlebars"
import { hcl } from "codemirror-lang-hcl"; // 3rd party
import { html } from "@codemirror/lang-html";
import { j } from "codemirror-lang-j"; // 3rd party
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { jq } from "codemirror-lang-jq"; // 3rd party
import { json } from "@codemirror/lang-json";
import { jsonc } from "@shopify/lang-jsonc"; // 3rd party
import { less } from "@codemirror/lang-less";
import { liquid } from "@codemirror/lang-liquid";
import { makefile } from "codemirror-lang-makefile"; // 3rd party
import { markdown } from "@codemirror/lang-markdown";
import { mermaid } from "codemirror-lang-mermaid"; // 3rd party
import { nix } from "@replit/codemirror-lang-nix" // 3rd party
// import { perl } from "codemirror-lang-perl"; // 3rd party (not working?)
import { php } from "@codemirror/lang-php";
import { prolog } from "codemirror-lang-prolog"; // 3rd party (comments are broken)
import { python } from "@codemirror/lang-python";
// import { r } from "codemirror-lang-r" // 3rd party (not working?)
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { solidity } from "@replit/codemirror-lang-solidity"; // 3rd party
import { sparql } from "codemirror-lang-sparql"; // 3rd party
import { spreadsheet } from "codemirror-lang-spreadsheet"; // 3rd party
import { sql } from "@codemirror/lang-sql";
import { svelte } from "@replit/codemirror-lang-svelte"; // 3rd party
import { twig } from "@ssddanbrown/codemirror-lang-twig"; // 3rd party
import { vue } from "@codemirror/lang-vue";
import { wast } from "@codemirror/lang-wast";
import { wgsl } from "@iizukak/codemirror-lang-wgsl"; // 3rd party
import { xml } from "@codemirror/lang-xml"
import { yaml } from "@codemirror/lang-yaml";
import { zig } from "codemirror-lang-zig"; // 3rd party

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
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
// import { wast } from "@codemirror/legacy-modes/mode/wast"; // available in CodeMirror 6
import { webIDL } from "@codemirror/legacy-modes/mode/webidl";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import { languageMetadataMap } from "@/lib/languageMetadata";


export type CodeMirrorLanguageKey = keyof typeof codemirrorLanguageMap;

export const getCodemirrorLanguage = (linguistLanguage: string): StreamLanguage<unknown> | LanguageSupport | null => {
    if (languageMetadataMap[linguistLanguage]?.codemirrorLanguage) {
        const codemirrorLanguage = languageMetadataMap[linguistLanguage].codemirrorLanguage;
        if (codemirrorLanguageMap[codemirrorLanguage]) {
            return codemirrorLanguageMap[codemirrorLanguage];
        }
    }
    return null;
}

export const codemirrorLanguageMap = {
    // CodeMirror 6 languages
    "brainfuck": brainfuck(),
    "css": css(),
    "c": cpp(),
    "c#": csharp(),
    "dot": dot(),
    "elixir": elixir(),
    "go": go(),
    "graphql": graphqlLanguageSupport(),
    "handlebars": new LanguageSupport(handlebarsLanguage),
    "hcl": hcl(),
    "html": html(),
    "j": j(),
    "java": java(),
    "jsx": javascript({ jsx: true, typescript: false }),
    "jq": jq(),
    "json": json(),
    "jsonc": jsonc(),
    "less": less(),
    "liquid": liquid(),
    "makefile": makefile(),
    "markdown": markdown(),
    "mermaid": mermaid(), // not recognized by linguist/enry
    "nix": nix(),
    //  "perl": perl(), // not working - use codemirror 5 mode
    "php": php(),
    "prolog": prolog(),
    "python": python(),
    //  "r": r(), // not working - use codemirror 5 mode
    "rust": rust(),
    "sass": sass(),
    "solidity": solidity,
    "sparql": sparql(),
    "spreadsheet": spreadsheet(),
    "sql": sql(),
    "svelte": svelte(),
    "tsx": javascript({ jsx: true, typescript: true }),
    "twig": twig(),
    "typescript": javascript({ jsx: false, typescript: true }),
    "vue": vue(),
    "wast": wast(),
    "wgsl": wgsl(),
    "xml": xml(),
    "yaml": yaml(),
    "zig": zig(),
    // Legacy CodeMirror 5 modes
    "apl": StreamLanguage.define(apl),
    "ceylon": StreamLanguage.define(ceylon),
    "clojure": StreamLanguage.define(clojure),
    "cmake": StreamLanguage.define(cmake),
    "cobol": StreamLanguage.define(cobol),
    "coffeescript": StreamLanguage.define(coffeeScript),
    "common lisp": StreamLanguage.define(commonLisp),
    "crystal": StreamLanguage.define(crystal),
    "cypher": StreamLanguage.define(cypher),
    "d": StreamLanguage.define(d),
    "dart": StreamLanguage.define(dart),
    "dockerfile": StreamLanguage.define(dockerFile),
    "diff": StreamLanguage.define(diff),
    "elm": StreamLanguage.define(elm),
    "erlang": StreamLanguage.define(erlang),
    "fortran": StreamLanguage.define(fortran),
    "gherkin": StreamLanguage.define(gherkin),
    "groovy": StreamLanguage.define(groovy),
    "haskell": StreamLanguage.define(haskell),
    "idl": StreamLanguage.define(idl),
    "jinja2": StreamLanguage.define(jinja2),
    "julia": StreamLanguage.define(julia),
    "kotlin": StreamLanguage.define(kotlin),
    "livescript": StreamLanguage.define(liveScript),
    "lua": StreamLanguage.define(lua),
    "nesc": StreamLanguage.define(nesC),
    "nginx": StreamLanguage.define(nginx),
    "objective-c": StreamLanguage.define(objectiveC),
    "objective-c++": StreamLanguage.define(objectiveCpp),
    "octave": StreamLanguage.define(octave),
    "pascal": StreamLanguage.define(pascal),
    "perl": StreamLanguage.define(perl),
    "powershell": StreamLanguage.define(powerShell),
    "protobuf": StreamLanguage.define(protobuf),
    "pug": StreamLanguage.define(pug),
    "puppet": StreamLanguage.define(puppet),
    "r": StreamLanguage.define(r),
    "rpm spec": StreamLanguage.define(rpmSpec),
    "ruby": StreamLanguage.define(ruby),
    "scala": StreamLanguage.define(scala),
    "scheme": StreamLanguage.define(scheme),
    "shader": StreamLanguage.define(shader),
    "shell": StreamLanguage.define(shell),
    "squirrel": StreamLanguage.define(squirrel),
    "swift": StreamLanguage.define(swift),
    "tcl": StreamLanguage.define(tcl),
    "textile": StreamLanguage.define(textile),
    "stex": StreamLanguage.define(stex),
    "toml": StreamLanguage.define(toml),
    "turtle": StreamLanguage.define(turtle),
    "vb": StreamLanguage.define(vb),
    "vbscript": StreamLanguage.define(vbScript),
    "velocity": StreamLanguage.define(velocity),
    "verilog": StreamLanguage.define(verilog),
    "vhdl": StreamLanguage.define(vhdl),
   //  "wast": StreamLanguage.define(wast), // available in CodeMirror 6
    "webidl": StreamLanguage.define(webIDL),
    "xquery": StreamLanguage.define(xQuery),
};

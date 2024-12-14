import { CodeMirrorLanguageKey } from "@/lib/codemirrorLanguage";

type LanguageMetadataMap = { [key: string]: LanguageMetadata };

type LanguageMetadata = {
   iconify: string | null;
   codemirrorLanguage: CodeMirrorLanguageKey | null;
};

// Languages:
// https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml
// Icons:
// https://icon-sets.iconify.design/?&list=icons
export const languageMetadataMap: LanguageMetadataMap = {
   "1C Enterprise": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "2-Dimensional Array": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "4D": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ABAP": {
      "iconify": "file-icons:abap",
      "codemirrorLanguage": null,
   },
   "ABAP CDS": {
      "iconify": "file-icons:abap",
      "codemirrorLanguage": null,
   },
   "ABNF": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "AGS Script": {
      "iconify": "vscode-icons:file-type-c3",
      "codemirrorLanguage": "c",
   },
   "AIDL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "AL": {
      "iconify": "vscode-icons:file-type-al",
      "codemirrorLanguage": null,
   },
   "AMPL": {
      "iconify": "file-icons:ampl",
      "codemirrorLanguage": null,
   },
   "ANTLR": {
      "iconify": "vscode-icons:file-type-antlr",
      "codemirrorLanguage": null,
   },
   "API Blueprint": {
      "iconify": "vscode-icons:file-type-apib",
      "codemirrorLanguage": null,
   },
   "APL": {
      "iconify": "vscode-icons:file-type-apl",
      "codemirrorLanguage": "apl",
   },
   "ASL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ASN.1": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ASP.NET": {
      "iconify": "vscode-icons:file-type-asp",
      "codemirrorLanguage": null,
   },
   "ATS": {
      "iconify": "vscode-icons:file-type-ats",
      "codemirrorLanguage": null,
   },
   "ActionScript": {
      "iconify": "vscode-icons:file-type-actionscript",
      "codemirrorLanguage": null,
   },
   "Ada": {
      "iconify": "vscode-icons:file-type-ada",
      "codemirrorLanguage": null,
   },
   "Adblock Filter List": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Adobe Font Metrics": {
      "iconify": "simple-icons:adobefonts",
      "codemirrorLanguage": null,
   },
   "Agda": {
      "iconify": "file-icons:agda",
      "codemirrorLanguage": null,
   },
   "Alloy": {
      "iconify": "file-icons:alloy",
      "codemirrorLanguage": null,
   },
   "Alpine Abuild": {
      "iconify": "file-icons:alpine-linux",
      "codemirrorLanguage": "shell",
   },
   "Altium Designer": {
      "iconify": "simple-icons:altiumdesigner",
      "codemirrorLanguage": null,
   },
   "AngelScript": {
      "iconify": "file-icons:angelscript",
      "codemirrorLanguage": "c",
   },
   "Ant Build System": {
      "iconify": "file-icons:apache-ant",
      "codemirrorLanguage": "xml",
   },
   "Antlers": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ApacheConf": {
      "iconify": "vscode-icons:file-type-apache",
      "codemirrorLanguage": null,
   },
   "Apex": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": "java",
   },
   "Apollo Guidance Computer": {
      "iconify": "file-icons:assembly-generic",
      "codemirrorLanguage": null,
   },
   "AppleScript": {
      "iconify": "vscode-icons:file-type-applescript",
      "codemirrorLanguage": null,
   },
   "Arc": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "AsciiDoc": {
      "iconify": "vscode-icons:file-type-asciidoc",
      "codemirrorLanguage": null,
   },
   "AspectJ": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Assembly": {
      "iconify": "file-icons:assembly-generic",
      "codemirrorLanguage": null,
   },
   "Astro": {
      "iconify": "vscode-icons:file-type-astro",
      "codemirrorLanguage": "tsx",
   },
   "Asymptote": {
      "iconify": "file-icons:asymptote",
      "codemirrorLanguage": "kotlin",
   },
   "Augeas": {
      "iconify": "file-icons:augeas",
      "codemirrorLanguage": null,
   },
   "AutoHotkey": {
      "iconify": "file-icons:autohotkey",
      "codemirrorLanguage": null,
   },
   "AutoIt": {
      "iconify": "file-icons:autoit",
      "codemirrorLanguage": null,
   },
   "Avro IDL": {
      "iconify": "vscode-icons:file-type-apache",
      "codemirrorLanguage": null,
   },
   "Awk": {
      "iconify": "vscode-icons:file-type-awk",
      "codemirrorLanguage": null,
   },
   "B4X": {
      "iconify": null,
      "codemirrorLanguage": "vb",
   },
   "BASIC": {
      "iconify": "devicon:visualbasic",
      "codemirrorLanguage": null,
   },
   "BQN": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Ballerina": {
      "iconify": "vscode-icons:file-type-ballerina",
      "codemirrorLanguage": null,
   },
   "Batchfile": {
      "iconify": "vscode-icons:file-type-bat",
      "codemirrorLanguage": null,
   },
   "Beef": {
      "iconify": null,
      "codemirrorLanguage": "c#",
   },
   "Befunge": {
      "iconify": "vscode-icons:file-type-befunge",
      "codemirrorLanguage": null,
   },
   "Berry": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "BibTeX": {
      "iconify": "file-icons:bibtex",
      "codemirrorLanguage": "stex",
   },
   "Bicep": {
      "iconify": "vscode-icons:file-type-bicep",
      "codemirrorLanguage": null,
   },
   "Bikeshed": {
      "iconify": "file-icons:bikeshed",
      "codemirrorLanguage": null,
   },
   "Bison": {
      "iconify": "file-icons:bison",
      "codemirrorLanguage": null,
   },
   "BitBake": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Blade": {
      "iconify": "vscode-icons:file-type-blade",
      "codemirrorLanguage": null,
   },
   "BlitzBasic": {
      "iconify": "vscode-icons:file-type-blitzbasic",
      "codemirrorLanguage": null,
   },
   "BlitzMax": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Bluespec": {
      "iconify": "file-icons:bluespec",
      "codemirrorLanguage": "verilog",
   },
   "Bluespec BH": {
      "iconify": "file-icons:bluespec",
      "codemirrorLanguage": "haskell",
   },
   "Boo": {
      "iconify": "file-icons:boo",
      "codemirrorLanguage": null,
   },
   "Boogie": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Brainfuck": {
      "iconify": "file-icons:brainfuck",
      "codemirrorLanguage": "brainfuck",
   },
   "BrighterScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Brightscript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Browserslist": {
      "iconify": "file-icons:browserslist",
      "codemirrorLanguage": null,
   },
   "C": {
      "iconify": "vscode-icons:file-type-c",
      "codemirrorLanguage": "c",
   },
   "C#": {
      "iconify": "vscode-icons:file-type-csharp",
      "codemirrorLanguage": "c#",
   },
   "C++": {
      "iconify": "vscode-icons:file-type-cpp",
      "codemirrorLanguage": "c",
   },
   "C-ObjDump": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "C2hs Haskell": {
      "iconify": "vscode-icons:file-type-haskell",
      "codemirrorLanguage": "haskell",
   },
   "CAP CDS": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "CIL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "CLIPS": {
      "iconify": "file-icons:clips",
      "codemirrorLanguage": null,
   },
   "CMake": {
      "iconify": "vscode-icons:file-type-cmake",
      "codemirrorLanguage": "cmake",
   },
   "COBOL": {
      "iconify": "vscode-icons:file-type-cobol",
      "codemirrorLanguage": "cobol",
   },
   "CODEOWNERS": {
      "iconify": "vscode-icons:file-type-codeowners",
      "codemirrorLanguage": null,
   },
   "COLLADA": {
      "iconify": null,
      "codemirrorLanguage": "xml",
   },
   "CSON": {
      "iconify": "file-icons:config-coffeescript",
      "codemirrorLanguage": "coffeescript",
   },
   "CSS": {
      "iconify": "vscode-icons:file-type-css",
      "codemirrorLanguage": "css",
   },
   "CSV": {
      "iconify": "vscode-icons:file-type-excel",
      "codemirrorLanguage": "spreadsheet",
   },
   "CUE": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "CWeb": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cabal Config": {
      "iconify": "vscode-icons:file-type-cabal",
      "codemirrorLanguage": "haskell",
   },
   "Caddyfile": {
      "iconify": "vscode-icons:file-type-caddy",
      "codemirrorLanguage": null,
   },
   "Cadence": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cairo": {
      "iconify": "file-icons:cairo",
      "codemirrorLanguage": null,
   },
   "Cairo Zero": {
      "iconify": "file-icons:cairo",
      "codemirrorLanguage": null,
   },
   "CameLIGO": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cap'n Proto": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Carbon": {
      "iconify": "devicon:carbon",
      "codemirrorLanguage": null,
   },
   "CartoCSS": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Ceylon": {
      "iconify": "vscode-icons:file-type-ceylon",
      "codemirrorLanguage": "ceylon",
   },
   "Chapel": {
      "iconify": "file-icons:chapel",
      "codemirrorLanguage": null,
   },
   "Charity": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Checksums": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ChucK": {
      "iconify": "file-icons:chuck",
      "codemirrorLanguage": "java",
   },
   "Circom": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cirru": {
      "iconify": "file-icons:cirru",
      "codemirrorLanguage": null,
   },
   "Clarion": {
      "iconify": "file-icons:clarion",
      "codemirrorLanguage": null,
   },
   "Clarity": {
      "iconify": "devicon:clarity",
      "codemirrorLanguage": "common lisp",
   },
   "Classic ASP": {
      "iconify": "vscode-icons:file-type-asp",
      "codemirrorLanguage": null,
   },
   "Clean": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Click": {
      "iconify": "file-icons:click",
      "codemirrorLanguage": null,
   },
   "Clojure": {
      "iconify": "vscode-icons:file-type-clojure",
      "codemirrorLanguage": "clojure",
   },
   "Closure Templates": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cloud Firestore Security Rules": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "CoNLL-U": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "CodeQL": {
      "iconify": "vscode-icons:file-type-codeql",
      "codemirrorLanguage": null,
   },
   "CoffeeScript": {
      "iconify": "vscode-icons:file-type-coffeescript",
      "codemirrorLanguage": "coffeescript",
   },
   "ColdFusion": {
      "iconify": "file-icons:coldfusion",
      "codemirrorLanguage": null,
   },
   "ColdFusion CFC": {
      "iconify": "file-icons:coldfusion",
      "codemirrorLanguage": null,
   },
   "Common Lisp": {
      "iconify": "file-icons:common-lisp",
      "codemirrorLanguage": "common lisp",
   },
   "Common Workflow Language": {
      "iconify": "file-icons:cwl",
      "codemirrorLanguage": "yaml",
   },
   "Component Pascal": {
      "iconify": "file-icons:component-pascal",
      "codemirrorLanguage": "pascal",
   },
   "Cool": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Coq": {
      "iconify": "file-icons:coq",
      "codemirrorLanguage": null,
   },
   "Cpp-ObjDump": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Creole": {
      "iconify": "file-icons:creole",
      "codemirrorLanguage": null,
   },
   "Crystal": {
      "iconify": "vscode-icons:file-type-crystal",
      "codemirrorLanguage": "crystal",
   },
   "Csound": {
      "iconify": "file-icons:csound",
      "codemirrorLanguage": null,
   },
   "Csound Document": {
      "iconify": "file-icons:csound",
      "codemirrorLanguage": null,
   },
   "Csound Score": {
      "iconify": "file-icons:csound",
      "codemirrorLanguage": null,
   },
   "Cuda": {
      "iconify": "vscode-icons:file-type-cuda",
      "codemirrorLanguage": "shader",
   },
   "Cue Sheet": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Curry": {
      "iconify": "file-icons:curry",
      "codemirrorLanguage": "haskell",
   },
   "Cycript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cylc": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Cypher": {
      "iconify": null,
      "codemirrorLanguage": "cypher",
   },
   "Cython": {
      "iconify": "file-icons:cython",
      "codemirrorLanguage": "python",
   },
   "D": {
      "iconify": "vscode-icons:file-type-dlang",
      "codemirrorLanguage": "d",
   },
   "D-ObjDump": {
      "iconify": "vscode-icons:file-type-dlang",
      "codemirrorLanguage": null,
   },
   "D2": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "DIGITAL Command Language": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "DM": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "DNS Zone": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "DTrace": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "Dafny": {
      "iconify": "file-icons:dafny",
      "codemirrorLanguage": null,
   },
   "Darcs Patch": {
      "iconify": "file-icons:darcs-patch",
      "codemirrorLanguage": null,
   },
   "Dart": {
      "iconify": "vscode-icons:file-type-dartlang",
      "codemirrorLanguage": "dart",
   },
   "DataWeave": {
      "iconify": "file-icons:dataweave",
      "codemirrorLanguage": null,
   },
   "Debian Package Control File": {
      "iconify": "vscode-icons:file-type-debian",
      "codemirrorLanguage": null,
   },
   "DenizenScript": {
      "iconify": null,
      "codemirrorLanguage": "yaml",
   },
   "Dhall": {
      "iconify": "vscode-icons:file-type-dhall",
      "codemirrorLanguage": "haskell",
   },
   "Diff": {
      "iconify": "vscode-icons:file-type-diff",
      "codemirrorLanguage": "diff",
   },
   "DirectX 3D File": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Dockerfile": {
      "iconify": "vscode-icons:file-type-docker",
      "codemirrorLanguage": "dockerfile",
   },
   "Dogescript": {
      "iconify": "file-icons:dogescript",
      "codemirrorLanguage": null,
   },
   "Dotenv": {
      "iconify": "vscode-icons:file-type-dotenv",
      "codemirrorLanguage": null,
   },
   "Dune": {
      "iconify": null,
      "codemirrorLanguage": "common lisp",
   },
   "Dylan": {
      "iconify": "vscode-icons:file-type-dylan",
      "codemirrorLanguage": null,
   },
   "E": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "E-mail": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "EBNF": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ECL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ECLiPSe": {
      "iconify": "devicon:eclipse",
      "codemirrorLanguage": null,
   },
   "EJS": {
      "iconify": "vscode-icons:file-type-ejs",
      "codemirrorLanguage": null,
   },
   "EQ": {
      "iconify": "file-icons:eq",
      "codemirrorLanguage": "c#",
   },
   "Eagle": {
      "iconify": "file-icons:eagle",
      "codemirrorLanguage": "xml",
   },
   "Earthly": {
      "iconify": "vscode-icons:file-type-earthly",
      "codemirrorLanguage": null,
   },
   "Easybuild": {
      "iconify": "file-icons:easybuild",
      "codemirrorLanguage": "python",
   },
   "Ecere Projects": {
      "iconify": "file-icons:ecere",
      "codemirrorLanguage": "jsx",
   },
   "Ecmarkup": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Edge": {
      "iconify": "file-icons:edge",
      "codemirrorLanguage": null,
   },
   "EdgeQL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "EditorConfig": {
      "iconify": "file-icons:editorconfig",
      "codemirrorLanguage": null,
   },
   "Edje Data Collection": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "Eiffel": {
      "iconify": "file-icons:eiffel",
      "codemirrorLanguage": null,
   },
   "Elixir": {
      "iconify": "vscode-icons:file-type-elixir",
      "codemirrorLanguage": "elixir",
   },
   "Elm": {
      "iconify": "vscode-icons:file-type-elm",
      "codemirrorLanguage": "elm",
   },
   "Elvish": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Elvish Transcript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Emacs Lisp": {
      "iconify": "file-icons:emacs",
      "codemirrorLanguage": "common lisp",
   },
   "EmberScript": {
      "iconify": "file-icons:emberscript",
      "codemirrorLanguage": null,
   },
   "Erlang": {
      "iconify": "vscode-icons:file-type-erlang",
      "codemirrorLanguage": "erlang",
   },
   "Euphoria": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "F#": {
      "iconify": "vscode-icons:file-type-fsharp",
      "codemirrorLanguage": null,
   },
   "F*": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "FIGlet Font": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "FIRRTL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "FLUX": {
      "iconify": "file-icons:flux",
      "codemirrorLanguage": null,
   },
   "Factor": {
      "iconify": "file-icons:factor",
      "codemirrorLanguage": null,
   },
   "Fancy": {
      "iconify": "file-icons:fancy",
      "codemirrorLanguage": null,
   },
   "Fantom": {
      "iconify": "file-icons:fantom",
      "codemirrorLanguage": null,
   },
   "Faust": {
      "iconify": "file-icons:faust",
      "codemirrorLanguage": null,
   },
   "Fennel": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Filebench WML": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Filterscript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Fluent": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Formatted": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Forth": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Fortran": {
      "iconify": "vscode-icons:file-type-fortran",
      "codemirrorLanguage": "fortran",
   },
   "Fortran Free Form": {
      "iconify": "vscode-icons:file-type-fortran",
      "codemirrorLanguage": "fortran",
   },
   "FreeBASIC": {
      "iconify": null,
      "codemirrorLanguage": "vb",
   },
   "FreeMarker": {
      "iconify": "vscode-icons:file-type-freemarker",
      "codemirrorLanguage": null,
   },
   "Frege": {
      "iconify": "file-icons:frege",
      "codemirrorLanguage": "haskell",
   },
   "Futhark": {
      "iconify": "file-icons:futhark",
      "codemirrorLanguage": null,
   },
   "G-code": {
      "iconify": "vscode-icons:file-type-gcode",
      "codemirrorLanguage": null,
   },
   "GAML": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "GAMS": {
      "iconify": "file-icons:gams",
      "codemirrorLanguage": null,
   },
   "GAP": {
      "iconify": "file-icons:gap",
      "codemirrorLanguage": null,
   },
   "GCC Machine Description": {
      "iconify": "devicon:gcc",
      "codemirrorLanguage": "common lisp",
   },
   "GDB": {
      "iconify": "file-icons:gdb",
      "codemirrorLanguage": null,
   },
   "GDScript": {
      "iconify": "file-icons:gdb",
      "codemirrorLanguage": null,
   },
   "GEDCOM": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "GLSL": {
      "iconify": "vscode-icons:file-type-glsl",
      "codemirrorLanguage": "shader",
   },
   "GN": {
      "iconify": "vscode-icons:file-type-python",
      "codemirrorLanguage": "python",
   },
   "GSC": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "Game Maker Language": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "Gemfile.lock": {
      "iconify": "file-icons:rubygems",
      "codemirrorLanguage": null,
   },
   "Gemini": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Genero 4gl": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Genero per": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Genie": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Genshi": {
      "iconify": "file-icons:genshi",
      "codemirrorLanguage": "xml",
   },
   "Gentoo Ebuild": {
      "iconify": "file-icons:gentoo",
      "codemirrorLanguage": "shell",
   },
   "Gentoo Eclass": {
      "iconify": "file-icons:gentoo",
      "codemirrorLanguage": "shell",
   },
   "Gerber Image": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Gettext Catalog": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Gherkin": {
      "iconify": null,
      "codemirrorLanguage": "gherkin",
   },
   "Git Attributes": {
      "iconify": "vscode-icons:file-type-git",
      "codemirrorLanguage": "shell",
   },
   "Git Config": {
      "iconify": "vscode-icons:file-type-git",
      "codemirrorLanguage": null,
   },
   "Git Revision List": {
      "iconify": "vscode-icons:file-type-git",
      "codemirrorLanguage": null,
   },
   "Gleam": {
      "iconify": "vscode-icons:file-type-gleam",
      "codemirrorLanguage": null,
   },
   "Glimmer JS": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Glimmer TS": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Glyph": {
      "iconify": "file-icons:glyphs",
      "codemirrorLanguage": null,
   },
   "Glyph Bitmap Distribution Format": {
      "iconify": "file-icons:glyphs",
      "codemirrorLanguage": null,
   },
   "Gnuplot": {
      "iconify": "vscode-icons:file-type-gnuplot",
      "codemirrorLanguage": null,
   },
   "Go": {
      "iconify": "vscode-icons:file-type-go",
      "codemirrorLanguage": "go",
   },
   "Go Checksums": {
      "iconify": "vscode-icons:file-type-go",
      "codemirrorLanguage": null,
   },
   "Go Module": {
      "iconify": "vscode-icons:file-type-go",
      "codemirrorLanguage": null,
   },
   "Go Workspace": {
      "iconify": "vscode-icons:file-type-go",
      "codemirrorLanguage": null,
   },
   "Godot Resource": {
      "iconify": "vscode-icons:file-type-godot",
      "codemirrorLanguage": null,
   },
   "Golo": {
      "iconify": "file-icons:golo",
      "codemirrorLanguage": null,
   },
   "Gosu": {
      "iconify": "file-icons:gosu",
      "codemirrorLanguage": null,
   },
   "Grace": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Gradle": {
      "iconify": "vscode-icons:file-type-gradle",
      "codemirrorLanguage": null,
   },
   "Gradle Kotlin DSL": {
      "iconify": "vscode-icons:file-type-gradle",
      "codemirrorLanguage": null,
   },
   "Grammatical Framework": {
      "iconify": null,
      "codemirrorLanguage": "haskell",
   },
   "Graph Modeling Language": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "GraphQL": {
      "iconify": "vscode-icons:file-type-graphql",
      "codemirrorLanguage": "graphql",
   },
   "Graphviz (DOT)": {
      "iconify": "file-icons:graphviz",
      "codemirrorLanguage": "dot",
   },
   "Groovy": {
      "iconify": "vscode-icons:file-type-groovy",
      "codemirrorLanguage": "groovy",
   },
   "Groovy Server Pages": {
      "iconify": "vscode-icons:file-type-groovy",
      "codemirrorLanguage": null,
   },
   "HAProxy": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "HCL": {
      "iconify": "simple-icons:hcl",
      "codemirrorLanguage": "hcl",
   },
   "HLSL": {
      "iconify": "vscode-icons:file-type-hlsl",
      "codemirrorLanguage": null,
   },
   "HOCON": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "HTML": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTML+ECR": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTML+EEX": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTML+ERB": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTML+PHP": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTML+Razor": {
      "iconify": "vscode-icons:file-type-html",
      "codemirrorLanguage": "html",
   },
   "HTTP": {
      "iconify": "vscode-icons:file-type-http",
      "codemirrorLanguage": null,
   },
   "HXML": {
      "iconify": null,
      "codemirrorLanguage": "xml",
   },
   "Hack": {
      "iconify": "file-icons:hack",
      "codemirrorLanguage": "php",
   },
   "Haml": {
      "iconify": "vscode-icons:file-type-haml",
      "codemirrorLanguage": null,
   },
   "Handlebars": {
      "iconify": "vscode-icons:file-type-handlebars",
      "codemirrorLanguage": "handlebars",
   },
   "Harbour": {
      "iconify": "vscode-icons:file-type-harbour",
      "codemirrorLanguage": null,
   },
   "Hare": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Haskell": {
      "iconify": "vscode-icons:file-type-haskell",
      "codemirrorLanguage": "haskell",
   },
   "Haxe": {
      "iconify": "vscode-icons:file-type-haxe",
      "codemirrorLanguage": null,
   },
   "HiveQL": {
      "iconify": "vscode-icons:file-type-apache",
      "codemirrorLanguage": "sql",
   },
   "HolyC": {
      "iconify": "file-icons:templeos",
      "codemirrorLanguage": "c",
   },
   "Hosts File": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Hy": {
      "iconify": "vscode-icons:file-type-hy",
      "codemirrorLanguage": null,
   },
   "HyPhy": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "IDL": {
      "iconify": "file-icons:idl",
      "codemirrorLanguage": "idl",
   },
   "IGOR Pro": {
      "iconify": "file-icons:igor-pro",
      "codemirrorLanguage": null,
   },
   "INI": {
      "iconify": "vscode-icons:file-type-ini",
      "codemirrorLanguage": null,
   },
   "IRC log": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Idris": {
      "iconify": "vscode-icons:file-type-idris",
      "codemirrorLanguage": null,
   },
   "Ignore List": {
      "iconify": "vscode-icons:file-type-git",
      "codemirrorLanguage": "shell",
   },
   "ImageJ Macro": {
      "iconify": "simple-icons:imagej",
      "codemirrorLanguage": null,
   },
   "Imba": {
      "iconify": "file-icons:imba",
      "codemirrorLanguage": null,
   },
   "Inform 7": {
      "iconify": "file-icons:inform7",
      "codemirrorLanguage": null,
   },
   "Ink": {
      "iconify": "vscode-icons:file-type-ink",
      "codemirrorLanguage": null,
   },
   "Inno Setup": {
      "iconify": "vscode-icons:file-type-innosetup",
      "codemirrorLanguage": null,
   },
   "Io": {
      "iconify": "vscode-icons:file-type-io",
      "codemirrorLanguage": null,
   },
   "Ioke": {
      "iconify": "file-icons:ioke",
      "codemirrorLanguage": null,
   },
   "Isabelle": {
      "iconify": "file-icons:isabelle",
      "codemirrorLanguage": null,
   },
   "Isabelle ROOT": {
      "iconify": "file-icons:isabelle",
      "codemirrorLanguage": null,
   },
   "J": {
      "iconify": "noto-v1:letter-j",
      "codemirrorLanguage": "j",
   },
   "JAR Manifest": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": null,
   },
   "JCL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "JFlex": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "JSON": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "json",
   },
   "JSON with Comments": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "jsonc",
   },
   "JSON5": {
      "iconify": "vscode-icons:file-type-json5",
      "codemirrorLanguage": "json",
   },
   "JSONLD": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "json",
   },
   "JSONiq": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "json",
   },
   "Janet": {
      "iconify": "vscode-icons:file-type-janet",
      "codemirrorLanguage": "scheme",
   },
   "Jasmin": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Java": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": "java",
   },
   "Java Properties": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": "xml",
   },
   "Java Server Pages": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": null,
   },
   "Java Template Engine": {
      "iconify": "vscode-icons:file-type-java",
      "codemirrorLanguage": null,
   },
   "JavaScript": {
      "iconify": "vscode-icons:file-type-js",
      "codemirrorLanguage": "jsx",
   },
   "JavaScript+ERB": {
      "iconify": "vscode-icons:file-type-js",
      "codemirrorLanguage": "jsx",
   },
   "Jest Snapshot": {
      "iconify": "vscode-icons:file-type-jest-snapshot",
      "codemirrorLanguage": null,
   },
   "JetBrains MPS": {
      "iconify": "logos:jetbrains-icon",
      "codemirrorLanguage": "xml",
   },
   "Jinja": {
      "iconify": "vscode-icons:file-type-jinja",
      "codemirrorLanguage": "jinja2",
   },
   "Jison": {
      "iconify": "file-icons:jison",
      "codemirrorLanguage": null,
   },
   "Jison Lex": {
      "iconify": "file-icons:jison",
      "codemirrorLanguage": null,
   },
   "Jolie": {
      "iconify": "file-icons:jolie",
      "codemirrorLanguage": null,
   },
   "Jsonnet": {
      "iconify": "vscode-icons:file-type-jsonnet",
      "codemirrorLanguage": null,
   },
   "Julia": {
      "iconify": "vscode-icons:file-type-julia",
      "codemirrorLanguage": "julia",
   },
   "Julia REPL": {
      "iconify": "vscode-icons:file-type-julia",
      "codemirrorLanguage": null,
   },
   "Jupyter Notebook": {
      "iconify": "vscode-icons:file-type-jupyter",
      "codemirrorLanguage": "json",
   },
   "Just": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "KRL": {
      "iconify": "file-icons:krl",
      "codemirrorLanguage": null,
   },
   "Kaitai Struct": {
      "iconify": "file-icons:kaitai",
      "codemirrorLanguage": "yaml",
   },
   "KakouneScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "KerboScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "KiCad Layout": {
      "iconify": "file-icons:kicad",
      "codemirrorLanguage": "common lisp",
   },
   "KiCad Legacy Layout": {
      "iconify": "file-icons:kicad",
      "codemirrorLanguage": null,
   },
   "KiCad Schematic": {
      "iconify": "file-icons:kicad",
      "codemirrorLanguage": null,
   },
   "Kickstart": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Kit": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Kotlin": {
      "iconify": "vscode-icons:file-type-kotlin",
      "codemirrorLanguage": "kotlin",
   },
   "Kusto": {
      "iconify": "vscode-icons:file-type-kusto",
      "codemirrorLanguage": null,
   },
   "LFE": {
      "iconify": "file-icons:lfe",
      "codemirrorLanguage": "common lisp",
   },
   "LLVM": {
      "iconify": "file-icons:llvm",
      "codemirrorLanguage": null,
   },
   "LOLCODE": {
      "iconify": "vscode-icons:file-type-lolcode",
      "codemirrorLanguage": null,
   },
   "LSL": {
      "iconify": "vscode-icons:file-type-lsl",
      "codemirrorLanguage": null,
   },
   "LTspice Symbol": {
      "iconify": "simple-icons:ltspice",
      "codemirrorLanguage": null,
   },
   "LabVIEW": {
      "iconify": "file-icons:labview",
      "codemirrorLanguage": "xml",
   },
   "Lark": {
      "iconify": "file-icons:lark",
      "codemirrorLanguage": null,
   },
   "Lasso": {
      "iconify": "file-icons:lasso",
      "codemirrorLanguage": null,
   },
   "Latte": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Lean": {
      "iconify": "file-icons:lean",
      "codemirrorLanguage": null,
   },
   "Lean 4": {
      "iconify": "file-icons:lean",
      "codemirrorLanguage": null,
   },
   "Less": {
      "iconify": "vscode-icons:file-type-less",
      "codemirrorLanguage": "less",
   },
   "Lex": {
      "iconify": "vscode-icons:file-type-lex",
      "codemirrorLanguage": null,
   },
   "LigoLANG": {
      "iconify": null,
      "codemirrorLanguage": "pascal",
   },
   "LilyPond": {
      "iconify": "vscode-icons:file-type-lilypond",
      "codemirrorLanguage": null,
   },
   "Limbo": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Linker Script": {
      "iconify": "vscode-icons:file-type-text",
      "codemirrorLanguage": null,
   },
   "Linux Kernel Module": {
      "iconify": "devicon:linux",
      "codemirrorLanguage": null,
   },
   "Liquid": {
      "iconify": "vscode-icons:file-type-liquid",
      "codemirrorLanguage": "liquid",
   },
   "Literate Agda": {
      "iconify": "file-icons:agda",
      "codemirrorLanguage": null,
   },
   "Literate CoffeeScript": {
      "iconify": "vscode-icons:file-type-coffeescript",
      "codemirrorLanguage": null,
   },
   "Literate Haskell": {
      "iconify": "vscode-icons:file-type-haskell",
      "codemirrorLanguage": "haskell",
   },
   "LiveCode Script": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "LiveScript": {
      "iconify": "vscode-icons:file-type-livescript",
      "codemirrorLanguage": "livescript",
   },
   "Logos": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Logtalk": {
      "iconify": "file-icons:logtalk",
      "codemirrorLanguage": null,
   },
   "LookML": {
      "iconify": "file-icons:lookml",
      "codemirrorLanguage": "yaml",
   },
   "LoomScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Lua": {
      "iconify": "vscode-icons:file-type-lua",
      "codemirrorLanguage": "lua",
   },
   "Luau": {
      "iconify": "vscode-icons:file-type-luau",
      "codemirrorLanguage": "lua",
   },
   "M": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "M4": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "M4Sugar": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MATLAB": {
      "iconify": "vscode-icons:file-type-matlab",
      "codemirrorLanguage": "octave",
   },
   "MAXScript": {
      "iconify": "vscode-icons:file-type-maxscript",
      "codemirrorLanguage": null,
   },
   "MDX": {
      "iconify": "vscode-icons:file-type-mdx",
      "codemirrorLanguage": null,
   },
   "MLIR": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MQL4": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MQL5": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MTML": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MUF": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Macaulay2": {
      "iconify": "file-icons:macaulay2",
      "codemirrorLanguage": null,
   },
   "Makefile": {
      "iconify": "vscode-icons:file-type-makefile",
      "codemirrorLanguage": "makefile",
   },
   "Mako": {
      "iconify": "file-icons:mako",
      "codemirrorLanguage": null,
   },
   "Markdown": {
      "iconify": "vscode-icons:file-type-markdown",
      "codemirrorLanguage": "markdown",
   },
   "Marko": {
      "iconify": "vscode-icons:file-type-marko",
      "codemirrorLanguage": null,
   },
   "Mask": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Mathematica": {
      "iconify": "file-icons:mathematica",
      "codemirrorLanguage": null,
   },
   "Maven POM": {
      "iconify": "vscode-icons:file-type-maven",
      "codemirrorLanguage": "xml",
   },
   "Max": {
      "iconify": "file-icons:max",
      "codemirrorLanguage": null,
   },
   "Mercury": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Mermaid": {
      "iconify": "vscode-icons:file-type-mermaid",
      "codemirrorLanguage": "mermaid",
   },
   "Meson": {
      "iconify": "vscode-icons:file-type-meson",
      "codemirrorLanguage": null,
   },
   "Metal": {
      "iconify": "file-icons:metal",
      "codemirrorLanguage": "c",
   },
   "Microsoft Developer Studio Project": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Microsoft Visual Studio Solution": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MiniD": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MiniYAML": {
      "iconify": "vscode-icons:file-type-yaml",
      "codemirrorLanguage": "yaml",
   },
   "Mint": {
      "iconify": "file-icons:mint",
      "codemirrorLanguage": null,
   },
   "Mirah": {
      "iconify": "file-icons:mirah",
      "codemirrorLanguage": "ruby",
   },
   "Modelica": {
      "iconify": "file-icons:modelica",
      "codemirrorLanguage": null,
   },
   "Modula-2": {
      "iconify": "file-icons:modula-2",
      "codemirrorLanguage": null,
   },
   "Modula-3": {
      "iconify": "file-icons:modula-3",
      "codemirrorLanguage": null,
   },
   "Module Management System": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Mojo": {
      "iconify": "vscode-icons:file-type-mojo",
      "codemirrorLanguage": "python",
   },
   "Monkey": {
      "iconify": "file-icons:monkey",
      "codemirrorLanguage": null,
   },
   "Monkey C": {
      "iconify": "file-icons:monkey",
      "codemirrorLanguage": "c",
   },
   "Moocode": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MoonBit": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "MoonScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Motoko": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Motorola 68K Assembly": {
      "iconify": "file-icons:assembly-motorola",
      "codemirrorLanguage": null,
   },
   "Move": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Muse": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Mustache": {
      "iconify": "vscode-icons:file-type-mustache",
      "codemirrorLanguage": null,
   },
   "Myghty": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "NASL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "NCL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "NEON": {
      "iconify": "file-icons:neon",
      "codemirrorLanguage": null,
   },
   "NL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "NMODL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "NPM Config": {
      "iconify": "vscode-icons:file-type-npm",
      "codemirrorLanguage": null,
   },
   "NSIS": {
      "iconify": "file-icons:nsis",
      "codemirrorLanguage": null,
   },
   "NWScript": {
      "iconify": "file-icons:nwscript",
      "codemirrorLanguage": "c",
   },
   "Nasal": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Nearley": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Nemerle": {
      "iconify": "file-icons:nemerle",
      "codemirrorLanguage": null,
   },
   "NetLinx": {
      "iconify": "file-icons:netlinx",
      "codemirrorLanguage": null,
   },
   "NetLinx+ERB": {
      "iconify": "file-icons:netlinx",
      "codemirrorLanguage": null,
   },
   "NetLogo": {
      "iconify": "file-icons:netlogo",
      "codemirrorLanguage": "common lisp",
   },
   "NewLisp": {
      "iconify": "file-icons:lisp",
      "codemirrorLanguage": "common lisp",
   },
   "Nextflow": {
      "iconify": "vscode-icons:file-type-nextflow",
      "codemirrorLanguage": null,
   },
   "Nginx": {
      "iconify": "vscode-icons:file-type-nginx",
      "codemirrorLanguage": "nginx",
   },
   "Nim": {
      "iconify": "vscode-icons:file-type-nim",
      "codemirrorLanguage": null,
   },
   "Ninja": {
      "iconify": "vscode-icons:file-type-ninja",
      "codemirrorLanguage": null,
   },
   "Nit": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Nix": {
      "iconify": "vscode-icons:file-type-nix",
      "codemirrorLanguage": "nix",
   },
   "Noir": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Nu": {
      "iconify": null,
      "codemirrorLanguage": "scheme",
   },
   "NumPy": {
      "iconify": "vscode-icons:file-type-numpy",
      "codemirrorLanguage": "python",
   },
   "Nunjucks": {
      "iconify": "vscode-icons:file-type-nunjucks",
      "codemirrorLanguage": null,
   },
   "Nushell": {
      "iconify": "vscode-icons:file-type-shell",
      "codemirrorLanguage": "shell",
   },
   "OASv2-json": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "json",
   },
   "OASv2-yaml": {
      "iconify": "vscode-icons:file-type-yaml",
      "codemirrorLanguage": "yaml",
   },
   "OASv3-json": {
      "iconify": "vscode-icons:file-type-json",
      "codemirrorLanguage": "json",
   },
   "OASv3-yaml": {
      "iconify": "vscode-icons:file-type-yaml",
      "codemirrorLanguage": "yaml",
   },
   "OCaml": {
      "iconify": "vscode-icons:file-type-ocaml",
      "codemirrorLanguage": null,
   },
   "Oberon": {
      "iconify": "file-icons:oberon",
      "codemirrorLanguage": null,
   },
   "ObjDump": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Object Data Instance Notation": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ObjectScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Objective-C": {
      "iconify": "vscode-icons:file-type-objectivec",
      "codemirrorLanguage": "objective-c",
   },
   "Objective-C++": {
      "iconify": "vscode-icons:file-type-objectivecpp",
      "codemirrorLanguage": "objective-c++",
   },
   "Objective-J": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Odin": {
      "iconify": "file-icons:odin",
      "codemirrorLanguage": null,
   },
   "Omgrofl": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Opa": {
      "iconify": "file-icons:opa",
      "codemirrorLanguage": null,
   },
   "Opal": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Open Policy Agent": {
      "iconify": "file-icons:openpolicyagent",
      "codemirrorLanguage": null,
   },
   "OpenAPI Specification v2": {
      "iconify": "file-icons:openapi",
      "codemirrorLanguage": null,
   },
   "OpenAPI Specification v3": {
      "iconify": "file-icons:openapi",
      "codemirrorLanguage": null,
   },
   "OpenCL": {
      "iconify": "vscode-icons:file-type-opencl",
      "codemirrorLanguage": "c",
   },
   "OpenEdge ABL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "OpenQASM": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "OpenRC runscript": {
      "iconify": null,
      "codemirrorLanguage": "shell",
   },
   "OpenSCAD": {
      "iconify": "vscode-icons:file-type-openscad",
      "codemirrorLanguage": null,
   },
   "OpenStep Property List": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "OpenType Feature File": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Option List": {
      "iconify": null,
      "codemirrorLanguage": "shell",
   },
   "Org": {
      "iconify": "vscode-icons:file-type-org",
      "codemirrorLanguage": null,
   },
   "Ox": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Oxygene": {
      "iconify": "file-icons:oxygene",
      "codemirrorLanguage": null,
   },
   "Oz": {
      "iconify": "file-icons:oz",
      "codemirrorLanguage": null,
   },
   "P4": {
      "iconify": "file-icons:p4",
      "codemirrorLanguage": null,
   },
   "PDDL": {
      "iconify": "vscode-icons:file-type-pddl",
      "codemirrorLanguage": null,
   },
   "PEG.js": {
      "iconify": "file-icons:pegjs",
      "codemirrorLanguage": null,
   },
   "PHP": {
      "iconify": "vscode-icons:file-type-php",
      "codemirrorLanguage": "php",
   },
   "PLSQL": {
      "iconify": "vscode-icons:file-type-plsql",
      "codemirrorLanguage": "sql",
   },
   "PLpgSQL": {
      "iconify": null,
      "codemirrorLanguage": "sql",
   },
   "POV-Ray SDL": {
      "iconify": "file-icons:pov-ray",
      "codemirrorLanguage": null,
   },
   "Pact": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pan": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Papyrus": {
      "iconify": "file-icons:papyrus",
      "codemirrorLanguage": null,
   },
   "Parrot": {
      "iconify": "file-icons:parrot",
      "codemirrorLanguage": null,
   },
   "Parrot Assembly": {
      "iconify": "file-icons:assembly-generic",
      "codemirrorLanguage": null,
   },
   "Parrot Internal Representation": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pascal": {
      "iconify": "file-icons:pascal",
      "codemirrorLanguage": "pascal",
   },
   "Pawn": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pep8": {
      "iconify": "vscode-icons:file-type-python",
      "codemirrorLanguage": null,
   },
   "Perl": {
      "iconify": "vscode-icons:file-type-perl",
      "codemirrorLanguage": "perl",
   },
   "Pic": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pickle": {
      "iconify": "file-icons:pickle",
      "codemirrorLanguage": null,
   },
   "PicoLisp": {
      "iconify": "file-icons:picolisp",
      "codemirrorLanguage": "common lisp",
   },
   "PigLatin": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pike": {
      "iconify": "file-icons:pike",
      "codemirrorLanguage": null,
   },
   "Pip Requirements": {
      "iconify": "vscode-icons:file-type-pip",
      "codemirrorLanguage": null,
   },
   "Pkl": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "PlantUML": {
      "iconify": "vscode-icons:file-type-plantuml",
      "codemirrorLanguage": null,
   },
   "Pod": {
      "iconify": "vscode-icons:file-type-perl",
      "codemirrorLanguage": "perl",
   },
   "Pod 6": {
      "iconify": "vscode-icons:file-type-perl",
      "codemirrorLanguage": "perl",
   },
   "PogoScript": {
      "iconify": "file-icons:pogoscript",
      "codemirrorLanguage": null,
   },
   "Polar": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Pony": {
      "iconify": "vscode-icons:file-type-pony",
      "codemirrorLanguage": null,
   },
   "Portugol": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "PostCSS": {
      "iconify": "vscode-icons:file-type-postcss",
      "codemirrorLanguage": null,
   },
   "PostScript": {
      "iconify": "file-icons:postscript",
      "codemirrorLanguage": null,
   },
   "PowerBuilder": {
      "iconify": "file-icons:powerbuilder",
      "codemirrorLanguage": null,
   },
   "PowerShell": {
      "iconify": "vscode-icons:file-type-powershell",
      "codemirrorLanguage": "powershell",
   },
   "Praat": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Prisma": {
      "iconify": "vscode-icons:file-type-prisma",
      "codemirrorLanguage": null,
   },
   "Processing": {
      "iconify": "vscode-icons:file-type-processinglang",
      "codemirrorLanguage": null,
   },
   "Procfile": {
      "iconify": "vscode-icons:file-type-procfile",
      "codemirrorLanguage": null,
   },
   "Proguard": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Prolog": {
      "iconify": "vscode-icons:file-type-prolog",
      "codemirrorLanguage": "prolog",
   },
   "Promela": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Propeller Spin": {
      "iconify": "file-icons:propeller",
      "codemirrorLanguage": null,
   },
   "Protocol Buffer": {
      "iconify": "vscode-icons:file-type-protobuf",
      "codemirrorLanguage": "protobuf",
   },
   "Protocol Buffer Text Format": {
      "iconify": "vscode-icons:file-type-protobuf",
      "codemirrorLanguage": null,
   },
   "Public Key": {
      "iconify": "vscode-icons:file-type-key",
      "codemirrorLanguage": null,
   },
   "Pug": {
      "iconify": "vscode-icons:file-type-pug",
      "codemirrorLanguage": "pug",
   },
   "Puppet": {
      "iconify": "vscode-icons:file-type-puppet",
      "codemirrorLanguage": "puppet",
   },
   "Pure Data": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "PureBasic": {
      "iconify": "file-icons:purebasic",
      "codemirrorLanguage": null,
   },
   "PureScript": {
      "iconify": "vscode-icons:file-type-purescript",
      "codemirrorLanguage": "haskell",
   },
   "Pyret": {
      "iconify": "vscode-icons:file-type-pyret",
      "codemirrorLanguage": "python",
   },
   "Python": {
      "iconify": "vscode-icons:file-type-python",
      "codemirrorLanguage": "python",
   },
   "Python console": {
      "iconify": "vscode-icons:file-type-python",
      "codemirrorLanguage": null,
   },
   "Python traceback": {
      "iconify": "vscode-icons:file-type-python",
      "codemirrorLanguage": null,
   },
   "Q#": {
      "iconify": "vscode-icons:file-type-qsharp",
      "codemirrorLanguage": null,
   },
   "QML": {
      "iconify": "vscode-icons:file-type-qml",
      "codemirrorLanguage": null,
   },
   "QMake": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Qt Script": {
      "iconify": "file-icons:qt",
      "codemirrorLanguage": null,
   },
   "Quake": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "QuickBASIC": {
      "iconify": null,
      "codemirrorLanguage": "vb",
   },
   "R": {
      "iconify": "vscode-icons:file-type-r",
      "codemirrorLanguage": "r",
   },
   "RAML": {
      "iconify": "vscode-icons:file-type-raml",
      "codemirrorLanguage": null,
   },
   "RBS": {
      "iconify": null,
      "codemirrorLanguage": "ruby",
   },
   "RDoc": {
      "iconify": "file-icons:rdoc",
      "codemirrorLanguage": null,
   },
   "REALbasic": {
      "iconify": "file-icons:realbasic",
      "codemirrorLanguage": null,
   },
   "REXX": {
      "iconify": "vscode-icons:file-type-rexx",
      "codemirrorLanguage": null,
   },
   "RMarkdown": {
      "iconify": "file-icons:rmarkdown",
      "codemirrorLanguage": null,
   },
   "RON": {
      "iconify": "vscode-icons:file-type-ron",
      "codemirrorLanguage": null,
   },
   "RPC": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "RPGLE": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "RPM Spec": {
      "iconify": "devicon:redhat-wordmark",
      "codemirrorLanguage": "rpm spec",
   },
   "RUNOFF": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Racket": {
      "iconify": "vscode-icons:file-type-racket",
      "codemirrorLanguage": "common lisp",
   },
   "Ragel": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Raku": {
      "iconify": "vscode-icons:file-type-raku",
      "codemirrorLanguage": "perl",
   },
   "Rascal": {
      "iconify": "file-icons:rascal",
      "codemirrorLanguage": null,
   },
   "Raw token data": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ReScript": {
      "iconify": "vscode-icons:file-type-rescript",
      "codemirrorLanguage": null,
   },
   "Readline Config": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Reason": {
      "iconify": "vscode-icons:file-type-reason",
      "codemirrorLanguage": null,
   },
   "ReasonLIGO": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Rebol": {
      "iconify": "file-icons:rebol",
      "codemirrorLanguage": null,
   },
   "Record Jar": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Red": {
      "iconify": "file-icons:red",
      "codemirrorLanguage": null,
   },
   "Redcode": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Redirect Rules": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Regular Expression": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Ren'Py": {
      "iconify": "devicon:renpy",
      "codemirrorLanguage": "python",
   },
   "RenderScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Rez": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Rich Text Format": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Ring": {
      "iconify": "file-icons:ring",
      "codemirrorLanguage": null,
   },
   "Riot": {
      "iconify": "vscode-icons:file-type-riot",
      "codemirrorLanguage": null,
   },
   "RobotFramework": {
      "iconify": "vscode-icons:file-type-robotframework",
      "codemirrorLanguage": null,
   },
   "Roc": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Roff": {
      "iconify": "file-icons:manpage",
      "codemirrorLanguage": null,
   },
   "Roff Manpage": {
      "iconify": "file-icons:manpage",
      "codemirrorLanguage": null,
   },
   "Rouge": {
      "iconify": null,
      "codemirrorLanguage": "clojure",
   },
   "RouterOS Script": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Ruby": {
      "iconify": "vscode-icons:file-type-ruby",
      "codemirrorLanguage": "ruby",
   },
   "Rust": {
      "iconify": "vscode-icons:file-type-rust",
      "codemirrorLanguage": "rust",
   },
   "SAS": {
      "iconify": "vscode-icons:file-type-sas",
      "codemirrorLanguage": null,
   },
   "SCSS": {
      "iconify": "vscode-icons:file-type-scss",
      "codemirrorLanguage": null,
   },
   "SELinux Policy": {
      "iconify": "devicon:linux",
      "codemirrorLanguage": null,
   },
   "SMT": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "SPARQL": {
      "iconify": "vscode-icons:file-type-sparql",
      "codemirrorLanguage": "sparql",
   },
   "SQF": {
      "iconify": "vscode-icons:file-type-sqf",
      "codemirrorLanguage": null,
   },
   "SQL": {
      "iconify": "vscode-icons:file-type-sql",
      "codemirrorLanguage": "sql",
   },
   "SQLPL": {
      "iconify": null,
      "codemirrorLanguage": "sql",
   },
   "SRecode Template": {
      "iconify": null,
      "codemirrorLanguage": "common lisp",
   },
   "SSH Config": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "STAR": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "STL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "STON": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "SVG": {
      "iconify": "vscode-icons:file-type-svg",
      "codemirrorLanguage": "xml",
   },
   "SWIG": {
      "iconify": "vscode-icons:file-type-swig",
      "codemirrorLanguage": "c",
   },
   "Sage": {
      "iconify": "file-icons:sage",
      "codemirrorLanguage": "python",
   },
   "SaltStack": {
      "iconify": "vscode-icons:file-type-saltstack",
      "codemirrorLanguage": null,
   },
   "Sass": {
      "iconify": "vscode-icons:file-type-sass",
      "codemirrorLanguage": "sass",
   },
   "Scala": {
      "iconify": "vscode-icons:file-type-scala",
      "codemirrorLanguage": "scala",
   },
   "Scaml": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Scenic": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Scheme": {
      "iconify": "file-icons:scheme",
      "codemirrorLanguage": "scheme",
   },
   "Scilab": {
      "iconify": "vscode-icons:file-type-scilab",
      "codemirrorLanguage": null,
   },
   "Self": {
      "iconify": "file-icons:self",
      "codemirrorLanguage": null,
   },
   "ShaderLab": {
      "iconify": "vscode-icons:file-type-shaderlab",
      "codemirrorLanguage": null,
   },
   "Shell": {
      "iconify": "vscode-icons:file-type-shell",
      "codemirrorLanguage": "shell",
   },
   "ShellCheck Config": {
      "iconify": "file-icons:shellcheck",
      "codemirrorLanguage": null,
   },
   "ShellSession": {
      "iconify": "vscode-icons:file-type-shell",
      "codemirrorLanguage": "shell",
   },
   "Shen": {
      "iconify": "file-icons:shen",
      "codemirrorLanguage": null,
   },
   "Sieve": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Simple File Verification": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Singularity": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Slash": {
      "iconify": "file-icons:slash",
      "codemirrorLanguage": null,
   },
   "Slice": {
      "iconify": "vscode-icons:file-type-slice",
      "codemirrorLanguage": null,
   },
   "Slim": {
      "iconify": "vscode-icons:file-type-slim",
      "codemirrorLanguage": null,
   },
   "Slint": {
      "iconify": "vscode-icons:file-type-slint",
      "codemirrorLanguage": null,
   },
   "SmPL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Smali": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Smalltalk": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Smarty": {
      "iconify": "vscode-icons:file-type-smarty",
      "codemirrorLanguage": null,
   },
   "Smithy": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "Snakemake": {
      "iconify": "vscode-icons:file-type-snakemake",
      "codemirrorLanguage": "python",
   },
   "Solidity": {
      "iconify": "vscode-icons:file-type-solidity",
      "codemirrorLanguage": "solidity",
   },
   "Soong": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "SourcePawn": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Spline Font Database": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Squirrel": {
      "iconify": "vscode-icons:file-type-squirrel",
      "codemirrorLanguage": "squirrel",
   },
   "Stan": {
      "iconify": "vscode-icons:file-type-stan",
      "codemirrorLanguage": null,
   },
   "Standard ML": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Starlark": {
      "iconify": "vscode-icons:file-type-bazel",
      "codemirrorLanguage": "python",
   },
   "Stata": {
      "iconify": "vscode-icons:file-type-stata",
      "codemirrorLanguage": null,
   },
   "StringTemplate": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Stylus": {
      "iconify": "vscode-icons:file-type-stylus",
      "codemirrorLanguage": null,
   },
   "SubRip Text": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "SugarSS": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "SuperCollider": {
      "iconify": "file-icons:supercollider",
      "codemirrorLanguage": null,
   },
   "Svelte": {
      "iconify": "vscode-icons:file-type-svelte",
      "codemirrorLanguage": "svelte",
   },
   "Sway": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Sweave": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Swift": {
      "iconify": "vscode-icons:file-type-swift",
      "codemirrorLanguage": "swift",
   },
   "SystemVerilog": {
      "iconify": "vscode-icons:file-type-systemverilog",
      "codemirrorLanguage": "verilog",
   },
   "TI Program": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "TL-Verilog": {
      "iconify": "vscode-icons:file-type-verilog",
      "codemirrorLanguage": "verilog",
   },
   "TLA": {
      "iconify": "file-icons:tla",
      "codemirrorLanguage": null,
   },
   "TOML": {
      "iconify": "vscode-icons:file-type-toml",
      "codemirrorLanguage": "toml",
   },
   "TSPLIB data": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "TSQL": {
      "iconify": null,
      "codemirrorLanguage": "sql",
   },
   "TSV": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "TSX": {
      "iconify": "vscode-icons:file-type-reactts",
      "codemirrorLanguage": "tsx",
   },
   "TXL": {
      "iconify": "file-icons:txl",
      "codemirrorLanguage": null,
   },
   "Tact": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Talon": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Tcl": {
      "iconify": "vscode-icons:file-type-tcl",
      "codemirrorLanguage": "tcl",
   },
   "Tcsh": {
      "iconify": null,
      "codemirrorLanguage": "shell",
   },
   "TeX": {
      "iconify": "vscode-icons:file-type-tex",
      "codemirrorLanguage": "stex",
   },
   "Tea": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Terra": {
      "iconify": null,
      "codemirrorLanguage": "lua",
   },
   "Terraform Template": {
      "iconify": "vscode-icons:file-type-terraform",
      "codemirrorLanguage": "ruby",
   },
   "Texinfo": {
      "iconify": "vscode-icons:file-type-tex",
      "codemirrorLanguage": null,
   },
   "Text": {
      "iconify": "vscode-icons:file-type-text",
      "codemirrorLanguage": null,
   },
   "TextGrid": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "TextMate Properties": {
      "iconify": "file-icons:textmate",
      "codemirrorLanguage": null,
   },
   "Textile": {
      "iconify": "vscode-icons:file-type-textile",
      "codemirrorLanguage": "textile",
   },
   "Thrift": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Toit": {
      "iconify": "vscode-icons:file-type-toit",
      "codemirrorLanguage": null,
   },
   "Turing": {
      "iconify": "file-icons:turing",
      "codemirrorLanguage": null,
   },
   "Turtle": {
      "iconify": null,
      "codemirrorLanguage": "turtle",
   },
   "Twig": {
      "iconify": "vscode-icons:file-type-twig",
      "codemirrorLanguage": "twig",
   },
   "Type Language": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "TypeScript": {
      "iconify": "vscode-icons:file-type-typescript",
      "codemirrorLanguage": "typescript",
   },
   "TypeSpec": {
      "iconify": "vscode-icons:file-type-typescript",
      "codemirrorLanguage": "typescript",
   },
   "Typst": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Unified Parallel C": {
      "iconify": "vscode-icons:file-type-c",
      "codemirrorLanguage": "c",
   },
   "Unity3D Asset": {
      "iconify": "devicon:unity",
      "codemirrorLanguage": null,
   },
   "Unix Assembly": {
      "iconify": "file-icons:assembly-generic",
      "codemirrorLanguage": null,
   },
   "Uno": {
      "iconify": "file-icons:uno",
      "codemirrorLanguage": "c#",
   },
   "UnrealScript": {
      "iconify": "file-icons:unrealscript",
      "codemirrorLanguage": "java",
   },
   "UrWeb": {
      "iconify": "file-icons:urweb",
      "codemirrorLanguage": null,
   },
   "V": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "VBA": {
      "iconify": "vscode-icons:file-type-vba",
      "codemirrorLanguage": "vb",
   },
   "VBScript": {
      "iconify": "vscode-icons:file-type-vb",
      "codemirrorLanguage": "vbscript",
   },
   "VCL": {
      "iconify": "file-icons:vcl",
      "codemirrorLanguage": null,
   },
   "VHDL": {
      "iconify": "vscode-icons:file-type-vhdl",
      "codemirrorLanguage": "vhdl",
   },
   "Vala": {
      "iconify": "vscode-icons:file-type-vala",
      "codemirrorLanguage": null,
   },
   "Valve Data Format": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Velocity Template Language": {
      "iconify": "vscode-icons:file-type-velocity",
      "codemirrorLanguage": "velocity",
   },
   "Verilog": {
      "iconify": "vscode-icons:file-type-verilog",
      "codemirrorLanguage": "verilog",
   },
   "Vim Help File": {
      "iconify": "vscode-icons:file-type-vim",
      "codemirrorLanguage": null,
   },
   "Vim Script": {
      "iconify": "vscode-icons:file-type-vim",
      "codemirrorLanguage": null,
   },
   "Vim Snippet": {
      "iconify": "vscode-icons:file-type-vim",
      "codemirrorLanguage": null,
   },
   "Visual Basic .NET": {
      "iconify": "vscode-icons:file-type-vbproj",
      "codemirrorLanguage": "vb",
   },
   "Visual Basic 6.0": {
      "iconify": "vscode-icons:file-type-vbproj",
      "codemirrorLanguage": "vb",
   },
   "Volt": {
      "iconify": "vscode-icons:file-type-volt",
      "codemirrorLanguage": null,
   },
   "Vue": {
      "iconify": "vscode-icons:file-type-vue",
      "codemirrorLanguage": "vue",
   },
   "Vyper": {
      "iconify": "vscode-icons:file-type-vyper",
      "codemirrorLanguage": null,
   },
   "WDL": {
      "iconify": "file-icons:wdl",
      "codemirrorLanguage": null,
   },
   "WGSL": {
      "iconify": "vscode-icons:file-type-wgsl",
      "codemirrorLanguage": "wgsl",
   },
   "Wavefront Material": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Wavefront Object": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Web Ontology Language": {
      "iconify": null,
      "codemirrorLanguage": "xml",
   },
   "WebAssembly": {
      "iconify": "file-icons:webassembly",
      "codemirrorLanguage": "wast",
   },
   "WebAssembly Interface Type": {
      "iconify": "file-icons:webassembly",
      "codemirrorLanguage": "webidl",
   },
   "WebIDL": {
      "iconify": null,
      "codemirrorLanguage": "webidl",
   },
   "WebVTT": {
      "iconify": "file-icons:webvtt",
      "codemirrorLanguage": null,
   },
   "Wget Config": {
      "iconify": "file-icons:wget",
      "codemirrorLanguage": null,
   },
   "Whiley": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Wikitext": {
      "iconify": "vscode-icons:file-type-wikitext",
      "codemirrorLanguage": null,
   },
   "Win32 Message File": {
      "iconify": "devicon:windows8",
      "codemirrorLanguage": null,
   },
   "Windows Registry Entries": {
      "iconify": "devicon:windows8",
      "codemirrorLanguage": null,
   },
   "Witcher Script": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Wollok": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "World of Warcraft Addon Data": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Wren": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "X BitMap": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "X Font Directory Index": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "X PixMap": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "X10": {
      "iconify": "file-icons:x10",
      "codemirrorLanguage": null,
   },
   "XC": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "XCompose": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "XML": {
      "iconify": "vscode-icons:file-type-xml",
      "codemirrorLanguage": "xml",
   },
   "XML Property List": {
      "iconify": "vscode-icons:file-type-xml",
      "codemirrorLanguage": "xml",
   },
   "XPages": {
      "iconify": "file-icons:xpages",
      "codemirrorLanguage": "xml",
   },
   "XProc": {
      "iconify": "xml",
      "codemirrorLanguage": "xml",
   },
   "XQuery": {
      "iconify": "vscode-icons:file-type-xquery",
      "codemirrorLanguage": "xquery",
   },
   "XS": {
      "iconify": null,
      "codemirrorLanguage": "c",
   },
   "XSLT": {
      "iconify": "vscode-icons:file-type-excel",
      "codemirrorLanguage": "xml",
   },
   "Xojo": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Xonsh": {
      "iconify": "emojione-monotone:spiral-shell",
      "codemirrorLanguage": "python",
   },
   "Xtend": {
      "iconify": "file-icons:xtend",
      "codemirrorLanguage": null,
   },
   "YAML": {
      "iconify": "vscode-icons:file-type-yaml",
      "codemirrorLanguage": "yaml",
   },
   "YANG": {
      "iconify": "vscode-icons:file-type-yang",
      "codemirrorLanguage": null,
   },
   "YARA": {
      "iconify": "file-icons:yara",
      "codemirrorLanguage": null,
   },
   "YASnippet": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Yacc": {
      "iconify": "vscode-icons:file-type-yacc",
      "codemirrorLanguage": null,
   },
   "Yul": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ZAP": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ZIL": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Zeek": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ZenScript": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "Zephir": {
      "iconify": "file-icons:zephir",
      "codemirrorLanguage": null,
   },
   "Zig": {
      "iconify": "vscode-icons:file-type-zig",
      "codemirrorLanguage": "zig",
   },
   "Zimpl": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "cURL Config": {
      "iconify": "file-icons:curl",
      "codemirrorLanguage": null,
   },
   "crontab": {
      "iconify": "eos-icons:cronjob",
      "codemirrorLanguage": "tcl",
   },
   "desktop": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "dircolors": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "eC": {
      "iconify": "file-icons:ec",
      "codemirrorLanguage": null,
   },
   "edn": {
      "iconify": null,
      "codemirrorLanguage": "clojure",
   },
   "fish": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "hoon": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "iCalendar": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "jq": {
      "iconify": null,
      "codemirrorLanguage": "jq",
   },
   "kvlang": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "mIRC Script": {
      "iconify": "file-icons:mirc",
      "codemirrorLanguage": null,
   },
   "mcfunction": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "mupad": {
      "iconify": "file-icons:mupad",
      "codemirrorLanguage": null,
   },
   "nanorc": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "nesC": {
      "iconify": null,
      "codemirrorLanguage": "nesc",
   },
   "omnetpp-msg": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "omnetpp-ned": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "ooc": {
      "iconify": "file-icons:ooc",
      "codemirrorLanguage": null,
   },
   "q": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "reStructuredText": {
      "iconify": "file-icons:restructuredtext",
      "codemirrorLanguage": null,
   },
   "robots.txt": {
      "iconify": "vscode-icons:file-type-text",
      "codemirrorLanguage": null,
   },
   "sed": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "templ": {
      "iconify": "vscode-icons:file-type-templ",
      "codemirrorLanguage": null,
   },
   "vCard": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
   "wisp": {
      "iconify": null,
      "codemirrorLanguage": "clojure",
   },
   "xBase": {
      "iconify": null,
      "codemirrorLanguage": null,
   },
};

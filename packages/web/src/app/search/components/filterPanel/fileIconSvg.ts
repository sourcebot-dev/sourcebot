import JavaScriptIcon from "@/public/languages/file_type_js_official.svg";
import TypeScriptIcon from "@/public/languages/file_type_typescript_official.svg";
import GoIcon from "@/public/languages/file_type_go.svg";
import MarkdownIcon from "@/public/languages/file_type_markdown.svg";
import CIcon from "@/public/languages/file_type_c3.svg";
import CppIcon from "@/public/languages/file_type_cpp3.svg";
import CSharpIcon from "@/public/languages/file_type_csharp2.svg";
import CSSIcon from "@/public/languages/file_type_css.svg";
import HTMLIcon from "@/public/languages/file_type_html.svg";
import JavaIcon from "@/public/languages/file_type_java.svg";
import JSONIcon from "@/public/languages/file_type_json.svg";
import PythonIcon from "@/public/languages/file_type_python.svg";
import RubyIcon from "@/public/languages/file_type_ruby.svg";
import RustIcon from "@/public/languages/file_type_rust.svg";
import YAMLIcon from "@/public/languages/file_type_yaml.svg";
import KotlinIcon from "@/public/languages/file_type_kotlin.svg";
import SwiftIcon from "@/public/languages/file_type_swift.svg";
import PHPIcon from "@/public/languages/file_type_php3.svg";
import RIcon from "@/public/languages/file_type_r.svg";
import MatlabIcon from "@/public/languages/file_type_matlab.svg";
import ObjectiveCIcon from "@/public/languages/file_type_objectivec.svg";
import LuaIcon from "@/public/languages/file_type_lua.svg";
import DartIcon from "@/public/languages/file_type_dartlang.svg";
import HaskellIcon from "@/public/languages/file_type_haskell.svg";
import PerlIcon from "@/public/languages/file_type_perl.svg";
import ShellIcon from "@/public/languages/file_type_shell.svg";
import ZigIcon from "@/public/languages/file_type_zig.svg";
import JuliaIcon from "@/public/languages/file_type_julia.svg";
import OcamlIcon from "@/public/languages/file_type_ocaml.svg";
import TextIcon from "@/public/languages/file_type_text.svg";
import PowershellIcon from "@/public/languages/file_type_powershell.svg";
import TexIcon from "@/public/languages/file_type_tex.svg";
import AssemblyIcon from "@/public/languages/file_type_assembly.svg";

/**
 * Get the SVG icon for a linguist language
 * https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml
 */
export const getFileIconSvg = (language: string) => {
    switch (language.toLowerCase()) {
        case "tsx":
        case "typescript":
            return TypeScriptIcon;
        case "jsx":
        case "javascript":
            return JavaScriptIcon;
        case "go":
            return GoIcon;
        case "markdown":
            return MarkdownIcon;
        case "c":
            return CIcon;
        case "c++":
            return CppIcon;
        case "python":
            return PythonIcon;
        case "c#":
            return CSharpIcon;
        case "html":
            return HTMLIcon;
        case "css":
            return CSSIcon;
        case "java":
            return JavaIcon;
        case "json with comments":
        case "json":
            return JSONIcon;
        case "ruby":
            return RubyIcon;
        case "rust":
            return RustIcon;
        case "yaml":
            return YAMLIcon;
        case "kotlin":
            return KotlinIcon;
        case "swift":
            return SwiftIcon;
        case "php":
            return PHPIcon;
        case "r":
            return RIcon;
        case "matlab":
            return MatlabIcon;
        case "objective-c":
            return ObjectiveCIcon;
        case "lua":
            return LuaIcon;
        case "dart":
            return DartIcon;
        case "haskell":
            return HaskellIcon;
        case "perl":
            return PerlIcon;
        case "shell":
            return ShellIcon;
        case "zig":
            return ZigIcon;
        case "julia":
            return JuliaIcon;
        case "ocaml":
            return OcamlIcon;
        case "text":
            return TextIcon;
        case "powershell":
            return PowershellIcon;
        case "tex":
            return TexIcon;
        case "assembly":
            return AssemblyIcon;
        default:
            return null;
    }
}

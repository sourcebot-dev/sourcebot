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
export const getFileIconSvg = (language: string): any | null => {
    const languageIconMap: { [key: string]: any } = {
        "Assembly": AssemblyIcon,
        "C": CIcon,
        "C#": CSharpIcon,
        "C++": CppIcon,
        "CSS": CSSIcon,
        "Dart": DartIcon,
        "GN": PythonIcon,
        "Go": GoIcon,
        "HTML+ECR": HTMLIcon,
        "HTML+EEX": HTMLIcon,
        "HTML+ERB": HTMLIcon,
        "HTML+PHP": HTMLIcon,
        "HTML+Razor": HTMLIcon,
        "Haskell": HaskellIcon,
        "Html": HTMLIcon,
        "JSON with Comments": JSONIcon,
        "JSON5": JSONIcon,
        "JSONLD": JSONIcon,
        "JSONiq": JSONIcon,
        "Java": JavaIcon,
        "Java Properties": JavaIcon,
        "Java Server Pages": JavaIcon,
        "Java Template Engine": JavaIcon,
        "JavaScript": JavaScriptIcon,
        "JavaScript+ERB": JavaIcon,
        "Json": JSONIcon,
        "Julia": JuliaIcon,
        "Kotlin": KotlinIcon,
        "Lua": LuaIcon,
        "MATLAB": MatlabIcon,
        "Markdown": MarkdownIcon,
        "OASv2-json": JSONIcon,
        "OASv2-yaml": YAMLIcon,
        "OASv3-json": JSONIcon,
        "OASv3-yaml": YAMLIcon,
        "OCaml": OcamlIcon,
        "Objective-C": ObjectiveCIcon,
        "PHP": PHPIcon,
        "Pep8": PythonIcon,
        "Perl": PerlIcon,
        "PowerShell": PowershellIcon,
        "Python": PythonIcon,
        "Python console": PythonIcon,
        "Python traceback": PythonIcon,
        "R": RIcon,
        "Ruby": RubyIcon,
        "Rust": RustIcon,
        "Shell": ShellIcon,
        "Swift": SwiftIcon,
        "Tex": TexIcon,
        "Text": TextIcon,
        "TypeScript": TypeScriptIcon,
        "YAML": YAMLIcon,
        "Zig": ZigIcon
    };
    if (language in languageIconMap) {
        return languageIconMap[language as keyof typeof languageIconMap];
    } else {
        return null;
    }
}

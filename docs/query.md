# Zoekt Query Language Guide

This guide explains the Zoekt query language, used for searching text within Git repositories. Zoekt queries allow combining multiple filters and expressions using logical operators, negations, and grouping. Here's how to craft queries effectively.

---

## Syntax Overview

A query is made up of expressions. An **expression** can be:
- A negation (e.g., `-`),
- A field (e.g., `repo:`).
- A grouping (e.g., parentheses `()`),

Logical `OR` operations combine multiple expressions. The **`AND` operator is implicit**, meaning multiple expressions written together will be automatically treated as `AND`.

---

## Query Components

### 1. **Fields**

Fields restrict your query to specific criteria. Here's a list of fields and their usage:

| Field        | Aliases | Values                 | Description                                                | Examples                               |
|--------------|---------|------------------------|------------------------------------------------------------|----------------------------------------|
| `archived:`  | `a:`    | `yes` or `no`          | Filters archived repositories.                             | `archived:yes`                         |
| `case:`      | `c:`    | `yes`, `no`, or `auto` | Matches case-sensitive or insensitive text.                | `case:yes content:"Foo"`               |
| `content:`   | `c:`    | Text (string or regex) | Searches content of files.                                 | `content:"search term"`                |
| `file:`      | `f:`    | Text (string or regex) | Searches file names.                                       | `file:"main.go"`                       |
| `fork:`      | `f:`    | `yes` or `no`          | Filters forked repositories.                               | `fork:no`                              |
| `lang:`      | `l:`    | Text                   | Filters by programming language.                           | `lang:python`                          |
| `public:`    |         | `yes` or `no`          | Filters public repositories.                               | `public:yes`                           |
| `regex:`     |         | Regex pattern          | Matches content using a regular expression.                | `regex:/foo.*bar/`                     |
| `repo:`      | `r:`    | Text (string or regex) | Filters repositories by name.                              | `repo:"github.com/user/project"`       |
| `sym:`       |         | Text                   | Searches for symbol names.                                 | `sym:"MyFunction"`                     |
| `branch:`    | `b:`    | Text                   | Searches within a specific branch.                         | `branch:main`                          |
| `type:`      | `t:`    | `filematch`, `filename`, `file`, or `repo` | Limits result types.                   | `type:filematch`                       |

---

### 2. **Negation**

Negate an expression using the `-` symbol.

#### Examples:
- Exclude a repository:
  ```plaintext
  -repo:"github.com/example/repo"
  ```
- Exclude a language:
  ```plaintext
  -lang:javascript
  ```

---

### 3. **Grouping**

Group queries using parentheses `()` to create complex logic.

#### Examples:
- Match either of two repositories:
  ```plaintext
  (repo:repo1 or repo:repo2)
  ```
- Find test in either python or javascript files:
  ```plaintext
  content:test (lang:python or lang:javascript)
  ```

---

### 4. **Logical Operators**

Use `or` to combine multiple expressions.

#### Examples:
- Match files in either of two languages:
  ```plaintext
  lang:go or lang:java
  ```

`and` boolean operator is applied automatically when expressions are separated by a space.

---

## Special Query Values

- **Boolean Values**:
  Use `yes` or `no` for fields like `archived:` or `fork:`.

- **Text Fields**:
  Text fields (`content:`, `repo:`, etc.) accept:
  - Strings: `"my text"`
  - Regular expressions: `/my.*regex/`

- **Escape Characters**:
  To include special characters, use backslashes (`\`).

#### Examples:
- Match the string `foo"bar`:
  ```plaintext
  content:"foo\"bar"
  ```
- Match the regex `foo.*bar`:
  ```plaintext
  content:/foo.*bar/
  ```

---

## Advanced Examples

1. **Search for content in Python files in public repositories**:
   ```plaintext
   lang:python public:yes content:"my_function"
   ```

2. **Exclude archived repositories and match a regex**:
   ```plaintext
   archived:no regex:/error.*handler/
   ```

3. **Find files named `README.md` in forks**:
   ```plaintext
   file:"README.md" fork:yes
   ```

4. **Search for a specific branch**:
   ```plaintext
   branch:main content:"TODO"
   ```

5. **Combine multiple fields**:
   ```plaintext
   (repo:"github.com/example" or repo:"github.com/test") and lang:go
   ```

---

## Tips

1. **Combine Filters**: You can combine as many fields as needed. For instance:
   ```plaintext
   repo:"github.com/example" lang:go content:"init"
   ```

2. **Use Regular Expressions**: Make complex content searches more powerful:
   ```plaintext
   content:/func\s+\w+\s*\(/
   ```

3. **Case Sensitivity**: Use `case:yes` for exact matches:
   ```plaintext
   case:yes content:"ExactMatch"
   ```

4. **Match Specific File Types**:
   ```plaintext
   file:".*\.go" content:"package main"
   ```

### EBNF Summary

```ebnf
query       = expression , { "or" , expression } ;

expression  = negation
            | grouping
            | field ;

negation    = "-" , expression ;

grouping    = "(" , query , ")" ;

field       = ( ( "archived:" | "a:" ) , boolean )
            | ( ( "case:" | "c:" ) , ("yes" | "no" | "auto") )
            | ( ( "content:" | "c:" ) , text )
            | ( ( "file:" | "f:" ) , text )
            | ( ( "fork:" | "f:" ) , boolean )
            | ( ( "lang:" | "l:" ) , text )
            | ( ( "public:" ) , boolean )
            | ( ( "regex:" ) , text )
            | ( ( "repo:" | "r:" ) , text )
            | ( ( "sym:" ) , text )
            | ( ( "branch:" | "b:" ) , text )
            | ( ( "type:" | "t:" ) , type );

boolean     = "yes" | "no" ;
text        = string | regex ;
string      = '"' , { character | escape } , '"' ;
regex       = '/' , { character | escape } , '/' ;

type        = "filematch" | "filename" | "file" | "repo" ;
```

---

### **Complex Query Examples**

1. **Search for functions in Go files with TODO comments**
   ```plaintext
   lang:go /func .* \/\/ TODO/
   ```
   Matches Go files where functions are annotated with TODO comments.

2. **Find Python test files containing the word "assert"**
   ```plaintext
   lang:python file:".*test.*\\.py" content:"assert"
   ```
   Looks for test files in Python containing assertions.

3. **Search for all README files mentioning "installation"**
   ```plaintext
   file:"README.*" content:"installation"
   ```
   Matches README files across repositories containing the word "installation."

4. **Find public repositories containing "openapi" in YAML files**
   ```plaintext
   file:".*\\.yaml$" content:"openapi"
   ```
   Matches YAML files mentioning "openapi."

5. **Search Java repositories for method signatures matching `public static`**
   ```plaintext
   lang:java /public static .*\\(/
   ```
   Finds Java methods declared as public static.

6. **Find JavaScript files importing React**
   ```plaintext
   lang:javascript content:"import React from 'react';"
   ```
   Matches JavaScript files importing React.

7. **Find all Markdown files mentioning "license" or "agreement"**
   ```plaintext
   file:".*\\.md" (content:"license" or content:"agreement")
   ```
   Targets Markdown files containing either "license" or "agreement."

8. **Find log statements in Go files**
    ```plaintext
    lang:go /"log\\.(Print|Printf|Fatal|Panic).*\\(.*\\)"/
    ```
    Matches Go log statements.

9. **Look for Python repositories containing Flask imports in their `app.py` file**
    ```plaintext
    lang:python file:"app\\.py" content:"from flask import .*"
    ```
    Matches Flask applications.

10. **Search for JSON files containing an array of objects**
    ```plaintext
    file:".*\\.json" /\\[\\s*{.*/ 
    ```
    Finds JSON files with object arrays.

11. **Search for Kubernetes YAML files containing `kind: Deployment`**
    ```plaintext
    file:".*\\.yaml" content:"kind: Deployment"
    ```
    Matches Kubernetes deployment files.

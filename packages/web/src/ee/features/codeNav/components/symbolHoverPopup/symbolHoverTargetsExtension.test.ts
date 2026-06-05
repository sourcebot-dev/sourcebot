import { describe, expect, test } from 'vitest';
import { EditorState, Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { go } from '@codemirror/lang-go';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { symbolHoverTargetsExtension } from './symbolHoverTargetsExtension';

const collectDecoratedSpans = (doc: string, language: Extension): { texts: string[]; ranges: Array<{ from: number; to: number; text: string }> } => {
    const state = EditorState.create({
        doc,
        extensions: [language, symbolHoverTargetsExtension],
    });
    const decorations = state.field(symbolHoverTargetsExtension);
    const ranges: Array<{ from: number; to: number; text: string }> = [];
    const iter = decorations.iter();
    while (iter.value) {
        ranges.push({ from: iter.from, to: iter.to, text: doc.slice(iter.from, iter.to) });
        iter.next();
    }
    return { texts: ranges.map(r => r.text), ranges };
};

const expectAllDetected = (texts: string[], expected: string[]) => {
    const found = new Set(texts);
    const missing = expected.filter(name => !found.has(name));
    expect(missing, `Expected identifiers were not detected: ${missing.join(', ')}`).toEqual([]);
};

const expectNoneDetected = (texts: string[], unexpected: string[]) => {
    const found = new Set(texts);
    const present = unexpected.filter(name => found.has(name));
    expect(present, `Unexpected identifiers were detected: ${present.join(', ')}`).toEqual([]);
};

describe('symbolHoverTargetsExtension', () => {
    test('TypeScript: detects functions, classes, props, types, and JSX', () => {
        const doc = [
            'import { useState } from "react";',
            '',
            'interface UserProps {',
            '    id: number;',
            '    name: string;',
            '}',
            '',
            'class UserCard {',
            '    private props: UserProps;',
            '    getDisplayName(): string { return this.props.name; }',
            '}',
            '',
            'function renderCard(user: UserProps) {',
            '    const [count, setCount] = useState(0);',
            '    return <UserCard data-id={user.id}>{user.name}</UserCard>;',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, javascript({ jsx: true, typescript: true }));

        expectAllDetected(texts, [
            'useState',
            'UserProps',
            'id',
            'name',
            'UserCard',
            'props',
            'getDisplayName',
            'renderCard',
            'user',
            'count',
            'setCount',
        ]);
        expectNoneDetected(texts, ['import', 'from', 'interface', 'class', 'function', 'const', 'return']);
    });

    test('Python: detects functions, classes, methods, and parameters', () => {
        const doc = [
            'from typing import List',
            '',
            'class Greeter:',
            '    def __init__(self, name: str):',
            '        self.name = name',
            '',
            '    def greet(self, others: List[str]) -> str:',
            '        return f"Hello {self.name} and {others}"',
            '',
            'def main():',
            '    greeter = Greeter("World")',
            '    print(greeter.greet(["a", "b"]))',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, python());

        expectAllDetected(texts, [
            'Greeter',
            '__init__',
            'self',
            'name',
            'greet',
            'others',
            'main',
            'greeter',
            'print',
        ]);
        expectNoneDetected(texts, ['from', 'import', 'class', 'def', 'return']);
    });

    test('Go: detects functions, types, fields, and method receivers', () => {
        const doc = [
            'package main',
            '',
            'import "fmt"',
            '',
            'type User struct {',
            '    ID   int',
            '    Name string',
            '}',
            '',
            'func (u *User) DisplayName() string {',
            '    return u.Name',
            '}',
            '',
            'func main() {',
            '    user := User{ID: 1, Name: "Alice"}',
            '    fmt.Println(user.DisplayName())',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, go());

        expectAllDetected(texts, [
            'User',
            'ID',
            'Name',
            'DisplayName',
            'main',
            'user',
            'fmt',
            'Println',
        ]);
        expectNoneDetected(texts, ['package', 'import', 'type', 'struct', 'func', 'return']);
    });

    test('Rust: detects structs, traits, functions, and bound identifiers', () => {
        const doc = [
            'use std::fmt::Display;',
            '',
            'struct Point {',
            '    x: i32,',
            '    y: i32,',
            '}',
            '',
            'trait Drawable {',
            '    fn draw(&self);',
            '}',
            '',
            'impl Drawable for Point {',
            '    fn draw(&self) {',
            '        let location = (self.x, self.y);',
            '        println!("{:?}", location);',
            '    }',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, rust());

        expectAllDetected(texts, [
            'Point',
            'x',
            'y',
            'Drawable',
            'draw',
            'location',
        ]);
        expectNoneDetected(texts, ['use', 'struct', 'trait', 'impl', 'fn', 'let']);
    });

    test('Java: detects classes, methods, fields, and parameters', () => {
        const doc = [
            'package com.example;',
            '',
            'public class Calculator {',
            '    private int total;',
            '',
            '    public Calculator(int initial) {',
            '        this.total = initial;',
            '    }',
            '',
            '    public int add(int value) {',
            '        total = total + value;',
            '        return total;',
            '    }',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, java());

        expectAllDetected(texts, [
            'Calculator',
            'total',
            'initial',
            'add',
            'value',
        ]);
        expectNoneDetected(texts, ['package', 'public', 'class', 'private', 'return']);
    });

    test('C++: detects functions, classes, namespaces, and fields', () => {
        const doc = [
            '#include <string>',
            '',
            'namespace geom {',
            '    class Shape {',
            '    public:',
            '        Shape(int sides);',
            '        int getSides() const;',
            '    private:',
            '        int sides_;',
            '    };',
            '}',
            '',
            'int main() {',
            '    geom::Shape triangle(3);',
            '    return triangle.getSides();',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, cpp());

        expectAllDetected(texts, [
            'geom',
            'Shape',
            'getSides',
            'main',
            'triangle',
        ]);
        expectNoneDetected(texts, ['namespace', 'class', 'public', 'private', 'return', 'const']);
    });

    test('PHP: detects classes, methods, properties, and variables', () => {
        const doc = [
            '<?php',
            'namespace App;',
            '',
            'class Greeter {',
            '    private string $name;',
            '',
            '    public function __construct(string $name) {',
            '        $this->name = $name;',
            '    }',
            '',
            '    public function greet(): string {',
            '        return "Hello " . $this->name;',
            '    }',
            '}',
        ].join('\n');

        const { texts } = collectDecoratedSpans(doc, php());

        expectAllDetected(texts, [
            'Greeter',
            'name',
            '__construct',
            'greet',
        ]);
        expectNoneDetected(texts, ['namespace', 'class', 'private', 'public', 'function', 'return']);
    });

    test('skips zero-width and non-identifier nodes', () => {
        const doc = 'const x = 42;';
        const { ranges } = collectDecoratedSpans(doc, javascript({ typescript: true }));

        for (const range of ranges) {
            expect(range.to).toBeGreaterThan(range.from);
        }

        expectAllDetected(ranges.map(r => r.text), ['x']);
        expectNoneDetected(ranges.map(r => r.text), ['42', 'const', '=']);
    });

    test('returns empty decoration set for plain text without a language', () => {
        const state = EditorState.create({
            doc: 'just some plain prose with no grammar attached',
            extensions: [symbolHoverTargetsExtension],
        });
        const decorations = state.field(symbolHoverTargetsExtension);
        expect(decorations.size).toBe(0);
    });
});

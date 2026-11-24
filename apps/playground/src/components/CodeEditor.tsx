"use client";

import React, { useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { Decoration, EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

const setHighlightLineEffect = StateEffect.define<number | null>();

const highlightLineField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    let updated = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHighlightLineEffect)) {
        if (effect.value === null) {
          updated = Decoration.none;
        } else {
          const lineNum = Math.max(1, Math.min(effect.value, tr.state.doc.lines));
          const line = tr.state.doc.line(lineNum);
          const lineDeco = Decoration.line({
            attributes: {
              class: "cm-diagnostic-highlight-line",
            },
          });
          updated = Decoration.set([lineDeco.range(line.from)]);
        }
      }
    }
    return updated;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface CodeEditorProps {
  value: string;
  language: "tsx" | "json";
  highlightedLine: number | null;
  onChange: (nextValue: string) => void;
}

export function CodeEditor({
  value,
  language,
  highlightedLine,
  onChange,
}: CodeEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => {
    const langExt =
      language === "tsx"
        ? javascript({ jsx: true, typescript: true })
        : json();
    return [langExt, highlightLineField, EditorView.lineWrapping];
  }, [language]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) return;

    view.dispatch({
      effects: setHighlightLineEffect.of(highlightedLine),
    });

    if (highlightedLine !== null) {
      const lineNum = Math.max(1, Math.min(highlightedLine, view.state.doc.lines));
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    }
  }, [highlightedLine, value]);

  return (
    <div className="h-full w-full overflow-auto bg-[#0B0E14] text-[13px]">
      <CodeMirror
        ref={editorRef}
        value={value}
        height="480px"
        theme="dark"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}

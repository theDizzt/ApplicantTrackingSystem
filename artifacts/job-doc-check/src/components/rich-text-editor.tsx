import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect, useRef } from "react"
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Heading2, Heading3,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

const ToolbarButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick() }}
    disabled={disabled}
    className={cn(
      "p-1.5 rounded transition-colors text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30",
      active && "bg-slate-200 text-slate-900",
    )}
  >
    {children}
  </button>
)

export function RichTextEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요...",
  className,
  minHeight = "16rem",
}: RichTextEditorProps) {
  // ── refs는 반드시 useEditor보다 먼저 선언 (hook 순서 안정화) ──────────────
  // onUpdate 콜백은 useEditor 생성 시점에 클로저로 고정되므로,
  // ref를 통해 항상 최신 onChange를 참조한다.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // 비동기로 로드된 초기값을 에디터에 딱 한 번만 세팅하기 위한 플래그
  const initializedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    // 항상 빈 콘텐츠로 시작 — 초기값은 아래 useEffect에서 1회 세팅
    content: "",
    onUpdate: ({ editor }) => {
      // ref를 통해 최신 onChange를 호출 → stale closure 완전 방지
      onChangeRef.current(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2 min-h-[inherit]",
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // 서버에서 값이 비동기로 로드됐을 때 초기 콘텐츠를 1회만 세팅
  useEffect(() => {
    if (!editor || initializedRef.current) return
    if (value && value !== "<p></p>") {
      // emitUpdate: false → onUpdate 트리거 없음 → onChange 호출 없음 → 루프 없음
      editor.commands.setContent(value, false)
      initializedRef.current = true
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      {/* ── 툴바 ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1 bg-slate-50">
        {/* 굵기 / 기울기 / 밑줄 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="굵게 (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="기울임 (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="밑줄 (Ctrl+U)"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* 제목 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="제목 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="제목 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* 목록 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="글머리 기호"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="번호 목록"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* 정렬 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="왼쪽 정렬"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="가운데 정렬"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="오른쪽 정렬"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* 구분선 */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="구분선"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* ── 에디터 본문 ── */}
      <EditorContent editor={editor} />
    </div>
  )
}

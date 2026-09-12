import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Bold, Code, Image as ImageIcon, Italic, List, ListOrdered, Loader2, Strikethrough } from 'lucide-react';
import { cn } from '@/lib/cn';
import { onImageClick } from './lightbox';

const PROSE =
  'prose prose-sm max-w-none text-text prose-p:my-1.5 prose-headings:text-text prose-strong:text-text ' +
  'prose-a:text-primary prose-code:text-text prose-code:bg-surface-sunken prose-code:px-1 prose-code:rounded ' +
  'prose-li:my-0.5 dark:prose-invert';

export function RichTextView({ html, className }: { html: string; className?: string }): React.ReactElement {
  if (!html || html === '<p></p>') {
    return <p className={cn('text-sm text-text-subtle', className)}>No description.</p>;
  }
  return (
    <div
      className={cn(PROSE, '[&_img]:cursor-zoom-in', className)}
      onClick={onImageClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface RichTextEditorProps {
  value: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: number;
  autoFocus?: boolean;
  /** enables the image toolbar button + paste/drop-to-upload; resolves to the hosted URL */
  onImageUpload?: (file: File) => Promise<string>;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Write something…',
  editable = true,
  minHeight = 80,
  autoFocus,
  onImageUpload,
}: RichTextEditorProps): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg max-h-80' } }),
    ],
    content: value || '',
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: e }) => onChange?.(e.getHTML()),
    onBlur: ({ editor: e }) => onBlur?.(e.getHTML()),
    editorProps: {
      attributes: { class: cn(PROSE, 'focus:outline-none px-3 py-2 scrollable'), style: `min-height:${minHeight}px` },
      handlePaste: onImageUpload
        ? (_view, event) => {
            const file = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
            if (!file) return false;
            void insertImage(file);
            return true;
          }
        : undefined,
      handleDrop: onImageUpload
        ? (_view, event) => {
            const file = [...(event.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
            if (!file) return false;
            event.preventDefault();
            void insertImage(file);
            return true;
          }
        : undefined,
    },
  });

  async function insertImage(file: File): Promise<void> {
    if (!onImageUpload || !editor || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // upload failures surface via the caller's own toast
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return <div style={{ minHeight }} className="rounded-lg border border-border bg-surface" />;

  return (
    <div className="rounded-lg border border-border bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
          {(
            [
              ['bold', Bold, () => editor.chain().focus().toggleBold().run()],
              ['italic', Italic, () => editor.chain().focus().toggleItalic().run()],
              ['strike', Strikethrough, () => editor.chain().focus().toggleStrike().run()],
              ['code', Code, () => editor.chain().focus().toggleCode().run()],
              ['bulletList', List, () => editor.chain().focus().toggleBulletList().run()],
              ['orderedList', ListOrdered, () => editor.chain().focus().toggleOrderedList().run()],
            ] as const
          ).map(([name, Icon, run]) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className={cn(
                'rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text',
                editor.isActive(name) && 'bg-primary-soft text-primary',
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
          {onImageUpload && (
            <>
              <div className="mx-0.5 h-4 w-px bg-border" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text"
                title="Image"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void insertImage(file);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

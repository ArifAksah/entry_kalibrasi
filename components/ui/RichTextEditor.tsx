'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { isRichTextEmpty, normalizeRichTextValue } from '../../lib/rich-text'

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeightClassName?: string
  disabled?: boolean
}

const toolbarButtons = [
  { label: 'B', command: 'bold', title: 'Bold' },
  { label: 'I', command: 'italic', title: 'Italic' },
  { label: 'U', command: 'underline', title: 'Underline' },
  { label: '• List', command: 'insertUnorderedList', title: 'Bullet List' },
  { label: '1. List', command: 'insertOrderedList', title: 'Numbered List' },
] as const

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Tulis catatan...',
  className = '',
  minHeightClassName = 'min-h-[100px]',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const normalizedValue = useMemo(() => normalizeRichTextValue(value), [value])
  const showPlaceholder = isRichTextEmpty(value)

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== normalizedValue) {
      editorRef.current.innerHTML = normalizedValue
    }
  }, [normalizedValue])

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML || '')
  }

  const applyCommand = (command: string) => {
    if (disabled) return
    focusEditor()
    document.execCommand(command)
    emitChange()
  }

  const clearFormatting = () => {
    if (disabled) return
    focusEditor()
    document.execCommand('removeFormat')
    document.execCommand('unlink')
    emitChange()
  }

  const insertLink = () => {
    if (disabled) return
    focusEditor()
    const url = window.prompt('Masukkan URL')
    if (!url) return
    document.execCommand('createLink', false, url)
    emitChange()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    const html = event.clipboardData.getData('text/html')
    const text = event.clipboardData.getData('text/plain')
    const nextValue = normalizeRichTextValue(html || text)
    document.execCommand('insertHTML', false, nextValue)
    emitChange()
  }

  return (
    <div className={`rounded-lg border border-gray-300 bg-white ${disabled ? 'opacity-70' : ''} ${className}`}>
      <div className="flex flex-wrap gap-2 border-b border-gray-200 px-3 py-2 bg-gray-50">
        {toolbarButtons.map(button => (
          <button
            key={button.command}
            type="button"
            onClick={() => applyCommand(button.command)}
            disabled={disabled}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-[#1e377c] hover:text-[#1e377c]"
            title={button.title}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          onClick={insertLink}
          disabled={disabled}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-[#1e377c] hover:text-[#1e377c]"
          title="Link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={clearFormatting}
          disabled={disabled}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-[#1e377c] hover:text-[#1e377c]"
          title="Hapus format"
        >
          Clear
        </button>
      </div>

      <div className="relative">
        {showPlaceholder && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-gray-400">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          aria-disabled={disabled}
          onInput={emitChange}
          onBlur={emitChange}
          onPaste={handlePaste}
          className={`${minHeightClassName} w-full px-3 py-3 text-sm text-gray-900 focus:outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+*]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 ${disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
        />
      </div>
    </div>
  )
}

export default RichTextEditor

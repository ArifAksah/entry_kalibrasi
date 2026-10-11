'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { isRichTextEmpty, normalizeRichTextValue } from '../../lib/rich-text'
import { Modal } from './Modal'

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

/** Header default tabel hasil pemeriksaan. */
const DEFAULT_TABLE_HEADERS = ['No.', 'Pemeriksaan', 'Keterangan']

const cellButtonClass =
  'rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-[#1e377c] hover:text-[#1e377c] disabled:opacity-40'

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Tulis catatan...',
  className = '',
  minHeightClassName = 'min-h-[100px]',
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const normalizedValue = useMemo(() => normalizeRichTextValue(value), [value])
  const showPlaceholder = isRichTextEmpty(value)

  const [dialog, setDialog] = useState<null | 'table' | 'link'>(null)
  const [tableRows, setTableRows] = useState('3')
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    // Jangan menimpa DOM saat editor sedang difokuskan — menimpa innerHTML
    // membuat kursor lompat/hilang sehingga tabel (dan teks) sulit diedit.
    // Sinkronkan hanya untuk perubahan dari luar (mis. memuat data).
    if (typeof document !== 'undefined' && document.activeElement === editor) return
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue
    }
  }, [normalizedValue])

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML || '')
  }

  const captureSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const range = savedRangeRef.current
    if (range && editor.contains(range.commonAncestorContainer)) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  const placeCaretInCell = (cell: HTMLElement | null | undefined) => {
    if (!cell) return
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }

  /** Sel (td/th) yang sedang ditempati kursor. */
  const findCell = (): HTMLTableCellElement | null => {
    const editor = editorRef.current
    let node: Node | null = window.getSelection()?.anchorNode ?? null
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        if (element.tagName === 'TD' || element.tagName === 'TH') {
          return element as HTMLTableCellElement
        }
      }
      node = node.parentNode
    }
    return null
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

  const closeDialog = () => setDialog(null)

  const openLinkDialog = () => {
    if (disabled) return
    captureSelection()
    setLinkUrl('')
    setDialog('link')
  }

  const confirmLink = () => {
    const url = linkUrl.trim()
    setDialog(null)
    if (!url) return
    restoreSelection()
    document.execCommand('createLink', false, url)
    emitChange()
  }

  const openTableDialog = () => {
    if (disabled) return
    captureSelection()
    setTableRows('3')
    setDialog('table')
  }

  const confirmTable = () => {
    const dataRows = Math.max(1, Math.min(50, parseInt(tableRows, 10) || 0))
    setDialog(null)
    if (!dataRows) return

    restoreSelection()

    let html = '<table><thead><tr>'
    DEFAULT_TABLE_HEADERS.forEach((heading) => {
      html += `<th>${heading}</th>`
    })
    html += '</tr></thead><tbody>'
    for (let r = 0; r < dataRows; r += 1) {
      html += '<tr>'
      DEFAULT_TABLE_HEADERS.forEach(() => {
        html += '<td><br></td>'
      })
      html += '</tr>'
    }
    html += '</tbody></table><p></p>'
    document.execCommand('insertHTML', false, html)
    emitChange()
  }

  const addTableRow = () => {
    if (disabled) return
    const cell = findCell()
    const row = cell?.closest('tr') as HTMLTableRowElement | null
    if (!row || !row.parentElement) return
    const newRow = document.createElement('tr')
    for (let i = 0; i < row.cells.length; i += 1) {
      const td = document.createElement('td')
      td.appendChild(document.createElement('br'))
      newRow.appendChild(td)
    }
    row.parentElement.insertBefore(newRow, row.nextSibling)
    placeCaretInCell(newRow.cells[0])
    emitChange()
  }

  const removeTableRow = () => {
    if (disabled) return
    const cell = findCell()
    const row = cell?.closest('tr') as HTMLTableRowElement | null
    const table = row?.closest('table') as HTMLTableElement | null
    if (!row || !table || table.rows.length <= 1) return
    const section = row.parentElement
    const index = Array.from(section?.children || []).indexOf(row)
    row.remove()
    if (section && section.children.length === 0) {
      section.remove()
    } else if (section) {
      const nextRow =
        (section.children[index] as HTMLTableRowElement | undefined) ||
        (section.children[index - 1] as HTMLTableRowElement | undefined)
      placeCaretInCell(nextRow?.cells?.[0] ?? null)
    }
    emitChange()
  }

  const addTableColumn = () => {
    if (disabled) return
    const cell = findCell()
    const table = cell?.closest('table') as HTMLTableElement | null
    if (!cell || !table) return
    const columnIndex = cell.cellIndex
    Array.from(table.rows).forEach((row) => {
      const ref = row.cells[columnIndex]
      const tag = ref?.tagName === 'TH' ? 'th' : 'td'
      const newCell = document.createElement(tag)
      newCell.appendChild(document.createElement('br'))
      if (ref) row.insertBefore(newCell, ref.nextSibling)
      else row.appendChild(newCell)
    })
    emitChange()
  }

  const removeTableColumn = () => {
    if (disabled) return
    const cell = findCell()
    const table = cell?.closest('table') as HTMLTableElement | null
    if (!cell || !table) return
    if ((table.rows[0]?.cells.length ?? 0) <= 1) return
    const columnIndex = cell.cellIndex
    Array.from(table.rows).forEach((row) => {
      row.cells[columnIndex]?.remove()
    })
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
    <>
      <div className={`rounded-lg border border-gray-300 bg-white ${disabled ? 'opacity-70' : ''} ${className}`}>
        <div className="flex flex-wrap gap-2 border-b border-gray-200 px-3 py-2 bg-gray-50">
          {toolbarButtons.map(button => (
            <button
              key={button.command}
              type="button"
              onClick={() => applyCommand(button.command)}
              disabled={disabled}
              className={cellButtonClass}
              title={button.title}
            >
              {button.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={openTableDialog}
            disabled={disabled}
            className={cellButtonClass}
            title="Sisipkan tabel"
          >
            Tabel
          </button>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={addTableRow}
            disabled={disabled}
            className={cellButtonClass}
            title="Tambah baris tabel (letakkan kursor di dalam tabel)"
          >
            + Baris
          </button>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={removeTableRow}
            disabled={disabled}
            className={cellButtonClass}
            title="Hapus baris tabel"
          >
            − Baris
          </button>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={addTableColumn}
            disabled={disabled}
            className={cellButtonClass}
            title="Tambah kolom tabel"
          >
            + Kolom
          </button>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={removeTableColumn}
            disabled={disabled}
            className={cellButtonClass}
            title="Hapus kolom tabel"
          >
            − Kolom
          </button>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={openLinkDialog}
            disabled={disabled}
            className={cellButtonClass}
            title="Link"
          >
            Link
          </button>
          <button
            type="button"
            onClick={clearFormatting}
            disabled={disabled}
            className={cellButtonClass}
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
            className={`${minHeightClassName} w-full px-3 py-3 text-sm text-gray-900 focus:outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+*]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:my-1 [&_th]:border [&_th]:border-gray-400 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-gray-400 [&_td]:px-2 [&_td]:py-1 ${disabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
          />
        </div>
      </div>

      <Modal isOpen={dialog === 'table'} onClose={closeDialog} title="Sisipkan Tabel">
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Header tabel:{' '}
            <span className="font-semibold text-gray-800">No. | Pemeriksaan | Keterangan</span>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Jumlah baris</span>
            <input
              type="number"
              min={1}
              max={50}
              value={tableRows}
              onChange={event => setTableRows(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/30"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmTable}
              className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90"
            >
              Sisipkan
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={dialog === 'link'} onClose={closeDialog} title="Tambah Link">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">URL</span>
            <input
              type="url"
              value={linkUrl}
              onChange={event => setLinkUrl(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1e377c] focus:outline-none focus:ring-2 focus:ring-[#1e377c]/30"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmLink}
              className="rounded-lg bg-[#1e377c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e377c]/90"
            >
              Terapkan
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default RichTextEditor

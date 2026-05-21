'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface TemplateActionsProps {
  templateId: string
  templateName: string
}

export function TemplateActions({ templateId, templateName }: TemplateActionsProps) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDuplicate = async () => {
    const newName = prompt(`Nama template baru (duplikat dari "${templateName}"):`, `${templateName} (Copy)`)
    if (!newName) return

    setDuplicating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ name: newName }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Gagal menduplikat template')
        return
      }

      router.refresh()
    } catch {
      alert('Gagal menduplikat template')
    } finally {
      setDuplicating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Hapus template "${templateName}"? Aksi ini tidak bisa dibatalkan.`)) return

    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Gagal menghapus template')
        return
      }

      router.refresh()
    } catch {
      alert('Gagal menghapus template')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/admin/templates/${templateId}/word-upload`}
        className="text-sm text-indigo-600 hover:text-indigo-800"
      >
        Upload Word
      </Link>
      <button
        onClick={handleDuplicate}
        disabled={duplicating}
        className="text-sm text-gray-600 hover:text-blue-600 disabled:opacity-50"
      >
        {duplicating ? 'Menduplikat...' : 'Duplikat'}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        {deleting ? 'Menghapus...' : 'Hapus'}
      </button>
    </div>
  )
}

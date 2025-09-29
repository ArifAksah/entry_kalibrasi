'use client'

import { useState, useEffect } from 'react'
import { Note, NoteInsert, NoteUpdate } from '../lib/supabase'

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all notes
  const fetchNotes = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/notes')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch notes')
      }

      setNotes(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Add new note
  const addNote = async (noteData: NoteInsert) => {
    try {
      setError(null)
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add note')
      }

      // Add the new note to the list
      setNotes(prev => [result.data, ...prev])
      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Update note
  const updateNote = async (id: number, noteData: NoteUpdate) => {
    try {
      setError(null)
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update note')
      }

      // Update the note in the list
      setNotes(prev => 
        prev.map(note => 
          note.id === id ? result.data : note
        )
      )
      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Delete note
  const deleteNote = async (id: number) => {
    try {
      setError(null)
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete note')
      }

      // Remove the note from the list
      setNotes(prev => prev.filter(note => note.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  // Load notes on mount
  useEffect(() => {
    fetchNotes()
  }, [])

  return {
    notes,
    loading,
    error,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
  }
}

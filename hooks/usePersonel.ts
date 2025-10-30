import { useEffect, useMemo, useRef, useState } from 'react'

export type Person = {
  id: string
  name: string
  email: string
  phone?: string
  position?: string
  nip?: string
  role?: 'admin' | 'calibrator' | 'verifikator' | 'assignor' | 'user_station' | ''
}

export type UsePersonelReturn = {
  items: Person[]
  loading: boolean
  error: string | null
  totalItems: number
  totalPages: number
  currentPage: number
  searchTerm: string
  setSearchTerm: (v: string) => void
  goToPage: (p: number) => void
  nextPage: () => void
  prevPage: () => void
  refresh: () => Promise<void>
  setRoleLocal: (user_id: string, role: Person['role']) => void
}

const usePersonel = (initialPage = 1, pageSize = 10): UsePersonelReturn => {
  const [items, setItems] = useState<Person[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [currentPage, setCurrentPage] = useState<number>(initialPage)
  const [searchTerm, setSearchTerm] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Cancel previous in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))
      if (searchTerm) params.set('search', searchTerm)

      const res = await fetch(`/api/personel?${params.toString()}`, { signal: controller.signal })
      if (!res.ok) {
        let msg = 'Failed to fetch personel'
        try {
          const j = await res.json()
          msg = j?.error || msg
        } catch {}
        throw new Error(msg)
      }

      const json = await res.json()
      let list: Person[] = Array.isArray(json) ? json : (json?.data ?? [])

      // Merge role data from /api/user-roles so roles persist across refreshes
      try {
        const rRoles = await fetch('/api/user-roles')
        if (rRoles.ok) {
          const rolesJson = await rRoles.json()
          const rows: Array<{ user_id: string; role: Person['role'] }> = Array.isArray(rolesJson) ? rolesJson : (rolesJson?.data ?? [])
          const roleMap = new Map<string, Person['role']>()
          rows.forEach(row => { if (row?.user_id) roleMap.set(row.user_id, (row.role ?? '') as any) })
          list = list.map(p => ({ ...p, role: roleMap.get(p.id) ?? p.role ?? '' }))
        }
      } catch {}
      const total = Array.isArray(json) ? list.length : (json?.total ?? list.length)
      const pages = Array.isArray(json)
        ? 1
        : (json?.totalPages ?? Math.max(1, Math.ceil(total / pageSize)))

      setItems(list)
      setTotalItems(total)
      setTotalPages(pages)
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'An error occurred'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1)
      fetchData()
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  const goToPage = (p: number) => setCurrentPage(prev => {
    const np = Math.max(1, Math.min(totalPages, p))
    return np
  })

  const nextPage = () => goToPage(currentPage + 1)
  const prevPage = () => goToPage(currentPage - 1)

  const refresh = async () => {
    await fetchData()
  }

  const setRoleLocal = (user_id: string, role: Person['role']) => {
    setItems(prev => prev.map(p => p.id === user_id ? { ...p, role } : p))
  }

  return {
    items,
    loading,
    error,
    totalItems,
    totalPages,
    currentPage,
    searchTerm,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    setRoleLocal,
  }
}

export default usePersonel

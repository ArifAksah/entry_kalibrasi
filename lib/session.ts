import { NextRequest } from 'next/server'
import { supabase } from './supabase'

export async function getSession(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return null
    }

    return {
      user,
      token
    }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function getServerSession() {
  try {
    // This is a placeholder for server-side session handling
    // In a real app, you might use cookies or other session storage
    return null
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}






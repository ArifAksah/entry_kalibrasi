import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { getSession } from '../../../lib/session'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user_id from query params if provided
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    let query = supabase.from('user_stations').select(`
      id,
      user_id,
      station_id,
      created_at,
      station:station_id(id, name)
    `)

    // Filter by user_id if provided
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching user stations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/user-stations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!userRoles || userRoles.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admin can assign stations to users' },
        { status: 403 }
      )
    }

    const { user_id, station_ids } = await request.json()

    if (!user_id || !Array.isArray(station_ids)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Start a transaction to update user stations
    const { data: existingUserStations, error: fetchError } = await supabase
      .from('user_stations')
      .select('station_id')
      .eq('user_id', user_id)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch existing user stations' },
        { status: 500 }
      )
    }

    const existingStationIds = existingUserStations?.map(us => us.station_id) || []
    
    // Stations to add (in station_ids but not in existingStationIds)
    const stationsToAdd = station_ids.filter(
      id => !existingStationIds.includes(id)
    )
    
    // Stations to remove (in existingStationIds but not in station_ids)
    const stationsToRemove = existingStationIds.filter(
      id => !station_ids.includes(id)
    )

    // Delete stations that need to be removed
    if (stationsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('user_stations')
        .delete()
        .eq('user_id', user_id)
        .in('station_id', stationsToRemove)

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to remove stations' },
          { status: 500 }
        )
      }
    }

    // Add new stations
    if (stationsToAdd.length > 0) {
      const newUserStations = stationsToAdd.map(station_id => ({
        user_id,
        station_id,
      }))

      const { error: insertError } = await supabase
        .from('user_stations')
        .insert(newUserStations)

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to add stations' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      added: stationsToAdd.length,
      removed: stationsToRemove.length,
    })
  } catch (error) {
    console.error('Error in POST /api/user-stations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
import { Router } from 'express'
import supabase from '../db/supabase.js'
import { getProfileRow, presentationFromProfile } from '../utils/profiles.js'

export const friendsRouter = Router()

const FRIENDS_NOT_CONFIGURED = 'Friends feature not yet configured. Run the friends migration.'
const VALID_PROFILES = ['personal', 'work']
const VALID_VISIBLE = ['personal', 'work', 'both']

function isTableMissingError(err) {
  if (!err) return false
  const code = err.code || err?.error?.code
  const msg = (err.message || err?.error?.message || '').toLowerCase()
  return code === '42P01' || /relation.*does not exist/.test(msg) || /friend_requests.*does not exist/.test(msg)
}

async function shareServer(userA, userB) {
  const { data: aServers } = await supabase
    .from('server_members')
    .select('server_id')
    .eq('user_id', userA)
  const { data: bServers } = await supabase
    .from('server_members')
    .select('server_id')
    .eq('user_id', userB)
  const setB = new Set((bServers || []).map((r) => r.server_id))
  return (aServers || []).some((r) => setB.has(r.server_id))
}

async function upsertFriendProfileSettings(userId, friendId, friendshipProfile, visibleProfiles) {
  const now = new Date().toISOString()
  await supabase.from('friend_profile_settings').upsert(
    {
      user_id: userId,
      friend_id: friendId,
      friendship_profile: friendshipProfile,
      visible_profiles: visibleProfiles,
      updated_at: now,
    },
    { onConflict: 'user_id,friend_id' }
  )
}

async function loadProfilesByUsers(userIds) {
  if (!userIds.length) return {}
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, profile_type, display_name, bio, avatar_url, banner_url')
    .in('user_id', userIds)
  const map = {}
  for (const p of data || []) {
    if (!map[p.user_id]) map[p.user_id] = {}
    map[p.user_id][p.profile_type] = p
  }
  return map
}

// List friends (status = accepted) — public profile names only, never login username
friendsRouter.get('/list', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('requester_id, addressee_id, requester_profile, addressee_profile')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw error
    }
    if (!rows?.length) return res.json([])

    const friendMeta = rows.map((r) => {
      const isRequester = r.requester_id === userId
      return {
        friendId: isRequester ? r.addressee_id : r.requester_id,
        // Profile of theirs that this friendship is primarily with (from our side settings later)
        theirProfile: isRequester ? (r.addressee_profile || 'personal') : (r.requester_profile || 'personal'),
        myProfile: isRequester ? (r.requester_profile || 'personal') : (r.addressee_profile || 'personal'),
      }
    })
    const friendIds = friendMeta.map((m) => m.friendId)

    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, banner_url')
      .in('id', friendIds)

    if (usersErr) throw usersErr
    const userMap = {}
    for (const u of users || []) userMap[u.id] = u

    const profilesByUser = await loadProfilesByUsers(friendIds)

    let settingsByFriend = {}
    try {
      const { data: settings } = await supabase
        .from('friend_profile_settings')
        .select('friend_id, friendship_profile, visible_profiles')
        .eq('user_id', userId)
        .in('friend_id', friendIds)
      ;(settings || []).forEach((s) => {
        settingsByFriend[s.friend_id] = s
      })
    } catch {
      settingsByFriend = {}
    }

    let presenceByUser = {}
    try {
      const { data: presence } = await supabase
        .from('user_presence')
        .select('user_id, status')
        .in('user_id', friendIds)
      ;(presence || []).forEach((p) => { presenceByUser[p.user_id] = p.status })
    } catch {
      presenceByUser = {}
    }

    return res.json(
      friendMeta.map((m) => {
        const s = settingsByFriend[m.friendId]
        const showType = s?.friendship_profile || m.theirProfile || 'personal'
        const profile = profilesByUser[m.friendId]?.[showType] || profilesByUser[m.friendId]?.personal
        const presented = presentationFromProfile(profile, userMap[m.friendId])
        return {
          id: m.friendId,
          username: presented.displayName, // legacy field name used by UI = public display name
          display_name: presented.displayName,
          bio: presented.bio,
          avatar_url: presented.avatarUrl,
          banner_url: presented.bannerUrl,
          status: presenceByUser[m.friendId] || 'offline',
          friendship_profile: s?.friendship_profile || m.myProfile || 'personal',
          visible_profiles: s?.visible_profiles || 'personal',
          their_profile: showType,
        }
      })
    )
  } catch (err) {
    console.error('Friends list error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
    }
    return res.status(500).json({ error: 'Failed to fetch friends' })
  }
})

// List pending friend requests (incoming) — show requester's public profile identity
friendsRouter.get('/requests', async (req, res) => {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('requester_id, created_at, requester_profile, addressee_profile')
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw error
    }
    if (!rows?.length) return res.json([])

    const requesterIds = rows.map((r) => r.requester_id)
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, banner_url')
      .in('id', requesterIds)

    if (usersErr) throw usersErr
    const userMap = {}
    for (const u of users || []) userMap[u.id] = u
    const profilesByUser = await loadProfilesByUsers(requesterIds)

    return res.json(
      rows.map((r) => {
        const type = r.requester_profile || 'personal'
        const profile = profilesByUser[r.requester_id]?.[type] || profilesByUser[r.requester_id]?.personal
        const presented = presentationFromProfile(profile, userMap[r.requester_id])
        return {
          requester_id: r.requester_id,
          created_at: r.created_at,
          requester_profile: type,
          addressee_profile: r.addressee_profile || 'personal',
          user: {
            id: r.requester_id,
            username: presented.displayName,
            display_name: presented.displayName,
            bio: presented.bio,
            avatar_url: presented.avatarUrl,
          },
        }
      })
    )
  } catch (err) {
    console.error('Friend requests error:', err)
    if (isTableMissingError(err)) {
      return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
    }
    return res.status(500).json({ error: 'Failed to fetch friend requests' })
  }
})

// Accept friend request (choose which of your profiles they join under)
friendsRouter.post('/accept', async (req, res) => {
  const { userId, requesterId, profile = 'personal', visibleProfiles } = req.body
  if (!userId || !requesterId) {
    return res.status(400).json({ error: 'userId and requesterId required' })
  }
  const friendshipProfile = VALID_PROFILES.includes(profile) ? profile : 'personal'
  const visible = VALID_VISIBLE.includes(visibleProfiles)
    ? visibleProfiles
    : friendshipProfile

  try {
    const { data: requestRow, error: fetchErr } = await supabase
      .from('friend_requests')
      .select('requester_profile')
      .eq('requester_id', requesterId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchErr) {
      if (isTableMissingError(fetchErr)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw fetchErr
    }
    if (!requestRow) {
      return res.status(404).json({ error: 'Friend request not found' })
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw error
    }

    const requesterProfile = VALID_PROFILES.includes(requestRow.requester_profile)
      ? requestRow.requester_profile
      : 'personal'

    // Each side stores their own association + default visibility
    try {
      await upsertFriendProfileSettings(userId, requesterId, friendshipProfile, visible)
      await upsertFriendProfileSettings(requesterId, userId, requesterProfile, requesterProfile)
    } catch (settingsErr) {
      console.warn('Friend profile settings upsert skipped:', settingsErr?.message || settingsErr)
    }

    return res.json({ success: true })
  } catch (err) {
    console.error('Accept friend error:', err)
    return res.status(500).json({ error: 'Failed to accept friend request' })
  }
})

// Decline friend request
friendsRouter.post('/decline', async (req, res) => {
  const { userId, requesterId } = req.body
  if (!userId || !requesterId) {
    return res.status(400).json({ error: 'userId and requesterId required' })
  }

  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('requester_id', requesterId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw error
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Decline friend error:', err)
    return res.status(500).json({ error: 'Failed to decline friend request' })
  }
})

// Send friend request to a specific public profile identity
// profile = which of MY profiles I'm adding from
// targetProfile = which of THEIR profiles I found / am adding
friendsRouter.post('/request', async (req, res) => {
  const { userId, targetUserId, profile = 'personal', targetProfile = 'personal' } = req.body
  if (!userId || !targetUserId) {
    return res.status(400).json({ error: 'userId and targetUserId required' })
  }
  if (userId === targetUserId) {
    return res.status(400).json({ error: 'Cannot add yourself as friend' })
  }
  const requesterProfile = VALID_PROFILES.includes(profile) ? profile : 'personal'
  const addresseeProfile = VALID_PROFILES.includes(targetProfile) ? targetProfile : 'personal'

  try {
    // Target profile must exist and be discoverable (unless already server-mates with server_members rule)
    const targetProfileRow = await getProfileRow(supabase, targetUserId, addresseeProfile)
    if (targetProfileRow && targetProfileRow.discoverable === false) {
      return res.status(403).json({ error: 'That profile is not discoverable' })
    }

    try {
      const { data: privacy } = await supabase
        .from('user_privacy_settings')
        .select('who_can_add_friend')
        .eq('user_id', targetUserId)
        .maybeSingle()
      const rule = privacy?.who_can_add_friend || 'everyone'
      if (rule === 'nobody') {
        return res.status(403).json({ error: 'This user is not accepting friend requests' })
      }
      if (rule === 'server_members') {
        const ok = await shareServer(userId, targetUserId)
        if (!ok) {
          return res.status(403).json({ error: 'This user only accepts friend requests from shared servers' })
        }
      }
    } catch {
      // Privacy table may not exist yet — allow request
    }

    const { error } = await supabase.from('friend_requests').insert({
      requester_id: userId,
      addressee_id: targetUserId,
      status: 'pending',
      requester_profile: requesterProfile,
      addressee_profile: addresseeProfile,
    })

    if (error) {
      if (isTableMissingError(error)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      if (error.code === '23505') {
        return res.json({ success: true }) // Already sent
      }
      // Older schema without profile columns
      if (/requester_profile|addressee_profile/i.test(error.message || '')) {
        const { error: retryErr } = await supabase.from('friend_requests').insert({
          requester_id: userId,
          addressee_id: targetUserId,
          status: 'pending',
        })
        if (retryErr && retryErr.code !== '23505') throw retryErr
        return res.json({ success: true })
      }
      throw error
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('Friend request error:', err)
    return res.status(500).json({ error: 'Failed to send friend request' })
  }
})

// Update how a friend can see your profiles
friendsRouter.patch('/visibility', async (req, res) => {
  const { userId, friendId, visibleProfiles, friendshipProfile } = req.body
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId and friendId required' })
  }
  if (visibleProfiles && !VALID_VISIBLE.includes(visibleProfiles)) {
    return res.status(400).json({ error: 'visibleProfiles must be personal, work, or both' })
  }
  if (friendshipProfile && !VALID_PROFILES.includes(friendshipProfile)) {
    return res.status(400).json({ error: 'friendshipProfile must be personal or work' })
  }

  try {
    const { data: friendship, error: friendErr } = await supabase
      .from('friend_requests')
      .select('requester_id, addressee_id, status')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`
      )
      .maybeSingle()

    if (friendErr) {
      if (isTableMissingError(friendErr)) {
        return res.status(501).json({ error: FRIENDS_NOT_CONFIGURED })
      }
      throw friendErr
    }
    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' })
    }

    const { data: existing } = await supabase
      .from('friend_profile_settings')
      .select('friendship_profile, visible_profiles')
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .maybeSingle()

    const next = {
      user_id: userId,
      friend_id: friendId,
      friendship_profile: friendshipProfile || existing?.friendship_profile || 'personal',
      visible_profiles: visibleProfiles || existing?.visible_profiles || 'personal',
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('friend_profile_settings')
      .upsert(next, { onConflict: 'user_id,friend_id' })
      .select()
      .single()

    if (error) throw error
    return res.json(data)
  } catch (err) {
    console.error('Friend visibility update error:', err)
    return res.status(500).json({ error: 'Failed to update friend visibility' })
  }
})

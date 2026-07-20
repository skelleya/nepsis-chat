import { Router } from 'express'
import supabase from '../db/supabase.js'
import crypto from 'crypto'

export const serversRouter = Router()

function generateInviteCode() {
  return crypto.randomBytes(4).toString('base64url').slice(0, 8)
}

async function logAudit(serverId, userId, action, details = {}) {
  try {
    await supabase.from('server_audit_log').insert({
      id: 'al-' + crypto.randomUUID(),
      server_id: serverId,
      user_id: userId,
      action,
      details,
    })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}

async function isUserBanned(serverId, userId) {
  const { data } = await supabase
    .from('server_bans')
    .select('user_id')
    .eq('server_id', serverId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

/** Owner/admin may moderate target; same rules as kick. */
async function assertCanModerateMember(serverId, actorUserId, targetUserId) {
  const { data: actor } = await supabase
    .from('server_members')
    .select('role')
    .eq('server_id', serverId)
    .eq('user_id', actorUserId)
    .single()

  if (!actor || !['owner', 'admin'].includes(actor.role)) {
    return { ok: false, status: 403, error: 'Only owner or admin can moderate members' }
  }

  const { data: target } = await supabase
    .from('server_members')
    .select('role')
    .eq('server_id', serverId)
    .eq('user_id', targetUserId)
    .single()

  if (!target) return { ok: false, status: 404, error: 'User not in server' }
  if (target.role === 'owner') return { ok: false, status: 403, error: 'Cannot moderate server owner' }
  if (actor.role === 'admin' && target.role === 'admin') {
    return { ok: false, status: 403, error: 'Admins cannot moderate other admins' }
  }
  return { ok: true, actor, target }
}

async function removeMemberFromServer(serverId, targetUserId) {
  const { error } = await supabase
    .from('server_members')
    .delete()
    .eq('server_id', serverId)
    .eq('user_id', targetUserId)
  if (error) throw error

  // Clear voice presence so they leave channel lists immediately
  try {
    await supabase
      .from('user_presence')
      .update({ status: 'offline', voice_channel_id: null })
      .eq('user_id', targetUserId)
  } catch {
    /* ignore */
  }
}

function disconnectUserVoiceSockets(voiceNs, targetUserId) {
  if (!voiceNs?.sockets) return
  for (const socket of voiceNs.sockets.values()) {
    if (socket.userId === targetUserId) {
      try {
        socket.emit('admin-disconnect-from-voice')
        if (socket.voiceChannel) {
          socket.leave(`voice:${socket.voiceChannel}`)
          socket.voiceChannel = null
        }
        socket.userId = null
        socket.username = null
      } catch {
        /* ignore */
      }
    }
  }
}

// Get servers the user is a member of. Auto-joins community servers.
serversRouter.get('/', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) return res.json([])

    const { data: memberships } = await supabase
      .from('server_members')
      .select('server_id, display_order')
      .eq('user_id', userId)

    const memberServerIds = (memberships || []).map((m) => m.server_id)
    const orderByServerId = new Map((memberships || []).map((m) => [m.server_id, m.display_order]))
    if (memberServerIds.length === 0) {
      // New and temp accounts start with no servers — user joins via invite or explore page
      return res.json([])
    }

    const { data: servers, error } = await supabase
      .from('servers')
      .select('*')
      .in('id', memberServerIds)
    if (error) throw error
    const list = servers || []
    list.sort((a, b) => {
      const orderA = orderByServerId.get(a.id)
      const orderB = orderByServerId.get(b.id)
      const aNull = orderA == null
      const bNull = orderB == null
      if (aNull && bNull) return a.name.localeCompare(b.name)
      if (aNull) return 1
      if (bNull) return -1
      return orderA - orderB
    })
    res.json(list)
  } catch (err) {
    console.error('Get servers error:', err)
    res.status(500).json({ error: 'Failed to fetch servers' })
  }
})

/** Count members (+ online) for a list of server IDs */
async function memberStatsForServers(serverIds) {
  const stats = {}
  for (const id of serverIds) stats[id] = { memberCount: 0, onlineCount: 0 }
  if (!serverIds.length) return stats

  const { data: members } = await supabase
    .from('server_members')
    .select('server_id, user_id')
    .in('server_id', serverIds)

  const userIds = [...new Set((members || []).map((m) => m.user_id))]
  let onlineIds = new Set()
  if (userIds.length) {
    const { data: presence } = await supabase
      .from('user_presence')
      .select('user_id, status')
      .in('user_id', userIds)
    onlineIds = new Set(
      (presence || [])
        .filter((p) => p.status && p.status !== 'offline')
        .map((p) => p.user_id)
    )
  }

  for (const m of members || []) {
    if (!stats[m.server_id]) stats[m.server_id] = { memberCount: 0, onlineCount: 0 }
    stats[m.server_id].memberCount += 1
    if (onlineIds.has(m.user_id)) stats[m.server_id].onlineCount += 1
  }
  return stats
}

// Get community servers (discoverable) — includes member counts for Explore UI
serversRouter.get('/community', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .eq('is_community', true)
      .order('name')
    if (error) throw error
    const list = data || []
    const stats = await memberStatsForServers(list.map((s) => s.id))

    const ownerIds = [...new Set(list.map((s) => s.owner_id).filter(Boolean))]
    const ownerNames = {}
    if (ownerIds.length) {
      const { data: owners } = await supabase
        .from('users')
        .select('id, username, display_name')
        .in('id', ownerIds)
      for (const u of owners || []) {
        ownerNames[u.id] = (u.display_name && u.display_name.trim()) || u.username || 'Unknown'
      }
    }

    res.json(
      list.map((s) => ({
        ...s,
        memberCount: stats[s.id]?.memberCount ?? 0,
        onlineCount: stats[s.id]?.onlineCount ?? 0,
        ownerName: ownerNames[s.owner_id] || null,
      }))
    )
  } catch (err) {
    console.error('Get community servers error:', err)
    res.status(500).json({ error: 'Failed to fetch community servers' })
  }
})

// Reorder user's server list (updates display_order in server_members)
serversRouter.put('/reorder', async (req, res) => {
  try {
    const { userId, updates } = req.body
    if (!userId || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'userId and updates array are required' })
    }
    for (const u of updates) {
      if (typeof u.serverId !== 'string' || typeof u.order !== 'number') continue
      await supabase
        .from('server_members')
        .update({ display_order: u.order })
        .eq('server_id', u.serverId)
        .eq('user_id', userId)
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Reorder servers error:', err)
    res.status(500).json({ error: 'Failed to reorder servers' })
  }
})

// Public preview for Explore / invite-style details (community servers only)
serversRouter.get('/:id/preview', async (req, res) => {
  try {
    const { data: server, error } = await supabase
      .from('servers')
      .select('id, name, icon_url, banner_url, owner_id, is_community, lock_channels_until_rules_accepted, rules_channel_id')
      .eq('id', req.params.id)
      .single()
    if (error || !server) return res.status(404).json({ error: 'Server not found' })
    if (!server.is_community) {
      return res.status(403).json({ error: 'Server preview is only available for community servers' })
    }

    const stats = await memberStatsForServers([server.id])
    const { data: owner } = await supabase
      .from('users')
      .select('username, display_name')
      .eq('id', server.owner_id)
      .maybeSingle()

    const { count: channelCount } = await supabase
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('server_id', server.id)

    res.json({
      id: server.id,
      name: server.name,
      iconUrl: server.icon_url,
      bannerUrl: server.banner_url,
      ownerId: server.owner_id,
      ownerName: (owner?.display_name && owner.display_name.trim()) || owner?.username || 'Unknown',
      memberCount: stats[server.id]?.memberCount ?? 0,
      onlineCount: stats[server.id]?.onlineCount ?? 0,
      channelCount: channelCount ?? 0,
      requiresRules: !!(server.lock_channels_until_rules_accepted && server.rules_channel_id),
      isCommunity: true,
    })
  } catch (err) {
    console.error('Server preview error:', err)
    res.status(500).json({ error: 'Failed to fetch server preview' })
  }
})

// Get a single server
serversRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Server not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch server' })
  }
})

// Create a new server (email users only — guests cannot create servers)
serversRouter.post('/', async (req, res) => {
  try {
    const { name, ownerId } = req.body
    if (!name || !ownerId) return res.status(400).json({ error: 'name and ownerId are required' })

    const { data: owner } = await supabase
      .from('users')
      .select('is_guest')
      .eq('id', ownerId)
      .single()

    if (owner?.is_guest) {
      return res.status(403).json({
        error: 'Server creation requires a verified email account. Sign up or sign in with email to create servers.',
      })
    }

    const serverId = 's-' + crypto.randomUUID()

    // Create the server
    const { data: server, error: serverError } = await supabase
      .from('servers')
      .insert({ id: serverId, name, owner_id: ownerId })
      .select()
      .single()
    if (serverError) throw serverError

    // Create default categories
    const textCatId = 'cat-' + crypto.randomUUID()
    const voiceCatId = 'cat-' + crypto.randomUUID()

    const { error: catError } = await supabase.from('categories').insert([
      { id: textCatId, server_id: serverId, name: 'Text Channels', order: 0 },
      { id: voiceCatId, server_id: serverId, name: 'Voice Channels', order: 1 },
    ])
    if (catError) console.error('Category creation error:', catError)

    // Create default channels
    const { error: chError } = await supabase.from('channels').insert([
      { id: 'ch-' + crypto.randomUUID(), server_id: serverId, name: 'general', type: 'text', order: 0, category_id: textCatId },
      { id: 'ch-' + crypto.randomUUID(), server_id: serverId, name: 'General', type: 'voice', order: 0, category_id: voiceCatId },
    ])
    if (chError) console.error('Channel creation error:', chError)

    // Add owner as member using their default active profile (required for Server Settings / admin UI)
    const { data: ownerUser } = await supabase
      .from('users')
      .select('active_profile')
      .eq('id', ownerId)
      .maybeSingle()
    const ownerProfile = ownerUser?.active_profile === 'work' ? 'work' : 'personal'
    let { error: ownerMemberErr } = await supabase.from('server_members').insert({
      server_id: serverId,
      user_id: ownerId,
      role: 'owner',
      profile_type: ownerProfile,
    })
    if (ownerMemberErr) {
      // Retry without profile_type for older schemas; always ensure owner membership exists
      ;({ error: ownerMemberErr } = await supabase.from('server_members').insert({
        server_id: serverId,
        user_id: ownerId,
        role: 'owner',
      }))
    }
    if (ownerMemberErr) {
      console.error('Owner membership insert failed:', ownerMemberErr)
      // Roll back orphan server so the client does not land in a broken owner-less state
      await supabase.from('channels').delete().eq('server_id', serverId)
      await supabase.from('categories').delete().eq('server_id', serverId)
      await supabase.from('servers').delete().eq('id', serverId)
      return res.status(500).json({ error: 'Failed to create server (owner membership)' })
    }

    res.status(201).json(server)
  } catch (err) {
    console.error('Create server error:', err)
    res.status(500).json({ error: 'Failed to create server' })
  }
})

// Update a server
serversRouter.patch('/:id', async (req, res) => {
  try {
    const { name, icon_url, banner_url, rules_channel_id, lock_channels_until_rules_accepted, rules_accept_emoji, updatedBy } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (icon_url !== undefined) updates.icon_url = icon_url
    if (banner_url !== undefined) updates.banner_url = banner_url

    // Rules settings: only owner/admin can update
    const rulesFields = { rules_channel_id, lock_channels_until_rules_accepted, rules_accept_emoji }
    const hasRulesUpdate = Object.values(rulesFields).some((v) => v !== undefined)
    if (hasRulesUpdate) {
      if (!updatedBy) return res.status(400).json({ error: 'updatedBy required for rules settings' })
      const { data: member } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', req.params.id)
        .eq('user_id', updatedBy)
        .single()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Only owner or admin can configure rules channel' })
      }
      if (rules_channel_id !== undefined) updates.rules_channel_id = rules_channel_id || null
      if (lock_channels_until_rules_accepted !== undefined) updates.lock_channels_until_rules_accepted = !!lock_channels_until_rules_accepted
      if (rules_accept_emoji !== undefined) updates.rules_accept_emoji = String(rules_accept_emoji).slice(0, 32) || '👍'
    }

    const { data, error } = await supabase
      .from('servers')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) {
      console.error('Server update error:', error)
      return res.status(500).json({ error: error.message || 'Failed to update server' })
    }
    res.json(data)
  } catch (err) {
    console.error('Failed to update server:', err)
    res.status(500).json({ error: err.message || 'Failed to update server' })
  }
})

// Delete a server
serversRouter.delete('/:id', async (req, res) => {
  try {
    // Delete in order: messages -> channels -> categories -> server_members -> server
    const { data: channels } = await supabase.from('channels').select('id').eq('server_id', req.params.id)
    if (channels && channels.length > 0) {
      const channelIds = channels.map((c) => c.id)
      await supabase.from('messages').delete().in('channel_id', channelIds)
      await supabase.from('channels').delete().eq('server_id', req.params.id)
    }
    await supabase.from('categories').delete().eq('server_id', req.params.id)
    await supabase.from('server_members').delete().eq('server_id', req.params.id)
    const { error } = await supabase.from('servers').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Delete server error:', err)
    res.status(500).json({ error: 'Failed to delete server' })
  }
})

// Get channels for a server
serversRouter.get('/:id/channels', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', req.params.id)
      .order('order')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' })
  }
})

// Create a channel
serversRouter.post('/:id/channels', async (req, res) => {
  try {
    const { name, type, categoryId, createdBy } = req.body
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' })
    const validTypes = ['text', 'voice', 'rules']
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'type must be text, voice, or rules' })

    // Rules channel: only owner/admin can create
    if (type === 'rules') {
      if (!createdBy) return res.status(400).json({ error: 'createdBy required for rules channel' })
      const { data: member } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', req.params.id)
        .eq('user_id', createdBy)
        .single()
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Only owner or admin can create a rules channel' })
      }
    }

    const channelId = 'ch-' + crypto.randomUUID()
    const insert = {
      id: channelId,
      server_id: req.params.id,
      name,
      type,
      order: 0,
    }
    if (categoryId) insert.category_id = categoryId

    const { data, error } = await supabase
      .from('channels')
      .insert(insert)
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    console.error('Create channel error:', err)
    res.status(500).json({ error: 'Failed to create channel' })
  }
})

// Reorder channels (bulk update — pass array of { id, order })
// Must be defined before /:channelId so "reorder" is not captured as channelId
serversRouter.put('/:serverId/channels/reorder', async (req, res) => {
  try {
    const { updates } = req.body
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' })
    }

    for (const { id, order } of updates) {
      if (!id || typeof order !== 'number') continue
      await supabase
        .from('channels')
        .update({ order })
        .eq('id', id)
        .eq('server_id', req.params.serverId)
    }
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', req.params.serverId)
      .order('order')
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder channels' })
  }
})

// Update a channel (reorder, rename, move category)
serversRouter.patch('/:serverId/channels/:channelId', async (req, res) => {
  try {
    const { order, name, categoryId } = req.body
    const updates = {}
    if (typeof order === 'number') updates.order = order
    if (name !== undefined) updates.name = name
    if (categoryId !== undefined) updates.category_id = categoryId

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }

    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', req.params.channelId)
      .eq('server_id', req.params.serverId)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Channel not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update channel' })
  }
})

// Delete a channel
serversRouter.delete('/:serverId/channels/:channelId', async (req, res) => {
  try {
    await supabase.from('messages').delete().eq('channel_id', req.params.channelId)
    const { error } = await supabase.from('channels').delete().eq('id', req.params.channelId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete channel' })
  }
})

// Get categories for a server
serversRouter.get('/:id/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('server_id', req.params.id)
      .order('order')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

// Create a category
serversRouter.post('/:id/categories', async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const catId = 'cat-' + crypto.randomUUID()
    const { data, error } = await supabase
      .from('categories')
      .insert({ id: catId, server_id: req.params.id, name, order: 0 })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' })
  }
})

// Reorder categories (bulk update — must be before /:catId to avoid "reorder" as catId)
serversRouter.put('/:serverId/categories/reorder', async (req, res) => {
  try {
    const { updates } = req.body
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' })
    }
    for (const { id, order } of updates) {
      if (!id || typeof order !== 'number') continue
      await supabase
        .from('categories')
        .update({ order })
        .eq('id', id)
        .eq('server_id', req.params.serverId)
    }
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('server_id', req.params.serverId)
      .order('order')
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder categories' })
  }
})

// Update a category (name, order)
serversRouter.patch('/:serverId/categories/:catId', async (req, res) => {
  try {
    const { name, order } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (typeof order === 'number') updates.order = order
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', req.params.catId)
      .eq('server_id', req.params.serverId)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Category not found' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' })
  }
})

// Delete a category
serversRouter.delete('/:serverId/categories/:catId', async (req, res) => {
  try {
    // Unlink channels from this category (set category_id to null)
    await supabase.from('channels').update({ category_id: null }).eq('category_id', req.params.catId)
    const { error } = await supabase.from('categories').delete().eq('id', req.params.catId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' })
  }
})

// Join server (add self as member) — uses default active_profile unless profileType provided
serversRouter.post('/:id/join', async (req, res) => {
  try {
    const { userId, profileType } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    if (await isUserBanned(req.params.id, userId)) {
      return res.status(403).json({ error: 'You are banned from this server' })
    }

    let profile = profileType === 'work' ? 'work' : profileType === 'personal' ? 'personal' : null
    if (!profile) {
      const { data: userRow } = await supabase
        .from('users')
        .select('active_profile')
        .eq('id', userId)
        .maybeSingle()
      profile = userRow?.active_profile === 'work' ? 'work' : 'personal'
    }

    const { error } = await supabase
      .from('server_members')
      .upsert(
        { server_id: req.params.id, user_id: userId, role: 'member', profile_type: profile },
        { onConflict: 'server_id,user_id' }
      )

    if (error) {
      // Older schema without profile_type
      if (/profile_type/i.test(error.message || '')) {
        const { error: retryErr } = await supabase
          .from('server_members')
          .upsert({ server_id: req.params.id, user_id: userId, role: 'member' }, { onConflict: 'server_id,user_id' })
        if (retryErr) throw retryErr
        return res.json({ success: true, profile_type: profile })
      }
      throw error
    }
    res.json({ success: true, profile_type: profile })
  } catch (err) {
    console.error('Join server error:', err)
    res.status(500).json({ error: 'Failed to join server' })
  }
})

// Check if user has accepted server rules (for channel lock)
serversRouter.get('/:id/rules-acceptance', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) return res.status(400).json({ error: 'userId query required' })

    const { data, error } = await supabase
      .from('rules_acceptances')
      .select('accepted_at')
      .eq('server_id', req.params.id)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    res.json({ accepted: !!data })
  } catch (err) {
    console.error('Rules acceptance check error:', err)
    res.status(500).json({ error: 'Failed to check rules acceptance' })
  }
})

// Get server members (with roles and presence) — public profile presentation only
serversRouter.get('/:id/members', async (req, res) => {
  try {
    let members
    let error
    ;({ data: members, error } = await supabase
      .from('server_members')
      .select('user_id, role, joined_at, profile_type, users(id, username, display_name, avatar_url, banner_url)')
      .eq('server_id', req.params.id))

    if (error && /profile_type/i.test(error.message || '')) {
      ;({ data: members, error } = await supabase
        .from('server_members')
        .select('user_id, role, joined_at, users(id, username, display_name, avatar_url, banner_url)')
        .eq('server_id', req.params.id))
    }
    if (error) throw error

    const userIds = (members || []).map((m) => m.user_id)
    const { data: presence } = await supabase
      .from('user_presence')
      .select('user_id, status, voice_channel_id')
      .in('user_id', userIds.length ? userIds : ['__none__'])

    const presenceByUser = {}
    ;(presence || []).forEach((p) => { presenceByUser[p.user_id] = p })

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, profile_type, display_name, avatar_url, banner_url, bio')
      .in('user_id', userIds.length ? userIds : ['__none__'])
    const profileMap = {}
    for (const p of profiles || []) {
      if (!profileMap[p.user_id]) profileMap[p.user_id] = {}
      profileMap[p.user_id][p.profile_type] = p
    }

    const result = (members || []).map((m) => {
      const type = m.profile_type === 'work' ? 'work' : 'personal'
      const profile = profileMap[m.user_id]?.[type] || profileMap[m.user_id]?.personal
      // Prefer profile → users.display_name → users.username (never blank "Unknown" for real accounts)
      const displayName =
        (profile?.display_name && profile.display_name.trim()) ||
        (m.users?.display_name && m.users.display_name.trim()) ||
        (m.users?.username && String(m.users.username).trim()) ||
        'Unknown'
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        username: displayName,
        displayName,
        avatarUrl: profile?.avatar_url || m.users?.avatar_url,
        bannerUrl: profile?.banner_url || m.users?.banner_url,
        bio: profile?.bio || '',
        profileType: type,
        status: presenceByUser[m.user_id]?.status || 'offline',
        voiceChannelId: presenceByUser[m.user_id]?.voice_channel_id,
      }
    })
    res.json(result)
  } catch (err) {
    console.error('Get members error:', err)
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

// Set which profile you use on this server (per-server preset)
serversRouter.patch('/:id/members/:userId/profile', async (req, res) => {
  try {
    const { id: serverId, userId } = req.params
    const { profileType, actorUserId } = req.body
    if (!['personal', 'work'].includes(profileType)) {
      return res.status(400).json({ error: 'profileType must be personal or work' })
    }
    if (actorUserId && actorUserId !== userId) {
      return res.status(403).json({ error: 'You can only change your own server profile' })
    }

    const { data, error } = await supabase
      .from('server_members')
      .update({ profile_type: profileType })
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .select('user_id, profile_type')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Membership not found' })
    res.json(data)
  } catch (err) {
    console.error('Set member profile error:', err)
    res.status(500).json({ error: 'Failed to update server profile' })
  }
})

// Change member role (owner only) — admin | member
serversRouter.patch('/:id/members/:userId/role', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const { adminUserId, role } = req.body || {}
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' })
  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or member' })
  }

  try {
    const { data: actor } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', adminUserId)
      .single()

    if (!actor || actor.role !== 'owner') {
      return res.status(403).json({ error: 'Only the server owner can change roles' })
    }
    if (adminUserId === targetUserId) {
      return res.status(400).json({ error: 'Cannot change your own role' })
    }

    const { data: target } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .single()

    if (!target) return res.status(404).json({ error: 'User not in server' })
    if (target.role === 'owner') {
      return res.status(403).json({ error: 'Cannot change the owner role' })
    }

    const { data, error } = await supabase
      .from('server_members')
      .update({ role })
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .select('user_id, role')
      .single()

    if (error) throw error
    await logAudit(serverId, adminUserId, 'member_role_changed', { targetUserId, role })
    res.json(data)
  } catch (err) {
    console.error('Set member role error:', err)
    res.status(500).json({ error: 'Failed to update role' })
  }
})

// Mute user in voice (owner/admin only, target must be in voice on this server)
serversRouter.post('/:id/members/:userId/mute-voice', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const { adminUserId } = req.body
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' })

  try {
    const { data: admin } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', adminUserId)
      .single()

    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      return res.status(403).json({ error: 'Only owner or admin can mute users' })
    }

    const { data: target } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .single()

    if (!target) return res.status(404).json({ error: 'User not in server' })
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot mute server owner' })
    if (admin.role === 'admin' && target.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot mute other admins' })
    }

    const voiceNs = req.app.get('voiceNamespace')
    if (voiceNs) {
      for (const [, socket] of voiceNs.sockets) {
        if (socket.userId === targetUserId) {
          socket.emit('admin-mute')
          break
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Mute voice error:', err)
    res.status(500).json({ error: 'Failed to mute user' })
  }
})

// Server-deafen user in voice (owner/admin only)
serversRouter.post('/:id/members/:userId/deafen-voice', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const { adminUserId } = req.body
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' })

  try {
    const { data: admin } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', adminUserId)
      .single()

    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      return res.status(403).json({ error: 'Only owner or admin can deafen users' })
    }

    const { data: target } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .single()

    if (!target) return res.status(404).json({ error: 'User not in server' })
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot deafen server owner' })
    if (admin.role === 'admin' && target.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot deafen other admins' })
    }

    const voiceNs = req.app.get('voiceNamespace')
    if (voiceNs) {
      for (const [, socket] of voiceNs.sockets) {
        if (socket.userId === targetUserId) {
          socket.emit('admin-deafen')
          break
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Deafen voice error:', err)
    res.status(500).json({ error: 'Failed to deafen user' })
  }
})

// Disconnect user from voice (owner/admin only, target must be in voice on this server)
serversRouter.post('/:id/members/:userId/disconnect-voice', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const { adminUserId } = req.body
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' })

  try {
    const { data: admin } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', adminUserId)
      .single()

    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      return res.status(403).json({ error: 'Only owner or admin can disconnect users' })
    }

    const { data: target } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .single()

    if (!target) return res.status(404).json({ error: 'User not in server' })
    if (target.role === 'owner') return res.status(403).json({ error: 'Cannot disconnect server owner' })
    if (admin.role === 'admin' && target.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot disconnect other admins' })
    }

    await supabase
      .from('user_presence')
      .upsert(
        { user_id: targetUserId, status: 'online', voice_channel_id: null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    const voiceNs = req.app.get('voiceNamespace')
    if (voiceNs) {
      for (const [, socket] of voiceNs.sockets) {
        if (socket.userId === targetUserId) {
          socket.emit('admin-disconnect-from-voice')
          break
        }
      }
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Disconnect voice error:', err)
    res.status(500).json({ error: 'Failed to disconnect user' })
  }
})

// Move user to another voice channel (owner/admin only, target must be in voice)
serversRouter.post('/:id/members/:userId/move-voice', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const { targetChannelId, adminUserId } = req.body
  if (!targetChannelId || !adminUserId) {
    return res.status(400).json({ error: 'targetChannelId and adminUserId required' })
  }

  try {
    const { data: admin } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', adminUserId)
      .single()

    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      return res.status(403).json({ error: 'Only owner or admin can move users' })
    }

    const { data: target } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', targetUserId)
      .single()

    if (!target) return res.status(404).json({ error: 'User not in server' })

    const { data: ch } = await supabase
      .from('channels')
      .select('id, name, type')
      .eq('id', targetChannelId)
      .eq('server_id', serverId)
      .single()

    if (!ch || ch.type !== 'voice') {
      return res.status(400).json({ error: 'Target must be a voice channel in this server' })
    }

    await supabase
      .from('user_presence')
      .upsert(
        { user_id: targetUserId, status: 'in-voice', voice_channel_id: targetChannelId, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    // Notify target user's client to switch voice channel (if they're connected)
    const voiceNs = req.app.get('voiceNamespace')
    if (voiceNs) {
      for (const [, socket] of voiceNs.sockets) {
        if (socket.userId === targetUserId) {
          socket.emit('admin-move-to-channel', { channelId: targetChannelId, channelName: ch.name })
          break
        }
      }
    }

    res.json({ success: true, channelId: targetChannelId, channelName: ch.name })
  } catch (err) {
    console.error('Move voice error:', err)
    res.status(500).json({ error: 'Failed to move user' })
  }
})

// Kick user (owner/admin only) — removes from server; they can rejoin via invite
serversRouter.delete('/:id/members/:userId', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const kickerUserId = req.query.kickerUserId
  if (!kickerUserId) return res.status(400).json({ error: 'kickerUserId required' })

  try {
    const gate = await assertCanModerateMember(serverId, kickerUserId, targetUserId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    await removeMemberFromServer(serverId, targetUserId)
    disconnectUserVoiceSockets(req.app.get('voiceNamespace'), targetUserId)
    await logAudit(serverId, kickerUserId, 'member_kicked', { targetUserId })
    res.json({ success: true })
  } catch (err) {
    console.error('Kick user error:', err)
    res.status(500).json({ error: 'Failed to kick user' })
  }
})

// Ban user (owner/admin only) — kick + block rejoin
serversRouter.post('/:id/members/:userId/ban', async (req, res) => {
  const { id: serverId, userId: targetUserId } = req.params
  const adminUserId = req.body?.adminUserId || req.query.adminUserId
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null
  if (!adminUserId) return res.status(400).json({ error: 'adminUserId required' })

  try {
    const gate = await assertCanModerateMember(serverId, adminUserId, targetUserId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const { error: banErr } = await supabase.from('server_bans').upsert(
      {
        server_id: serverId,
        user_id: targetUserId,
        banned_by: adminUserId,
        reason,
      },
      { onConflict: 'server_id,user_id' }
    )
    if (banErr) throw banErr

    await removeMemberFromServer(serverId, targetUserId)
    disconnectUserVoiceSockets(req.app.get('voiceNamespace'), targetUserId)
    await logAudit(serverId, adminUserId, 'member_banned', { targetUserId, reason })
    res.json({ success: true })
  } catch (err) {
    console.error('Ban user error:', err)
    res.status(500).json({ error: 'Failed to ban user' })
  }
})

// ─── Invites ───────────────────────────────────────────

serversRouter.post('/:id/invites', async (req, res) => {
  try {
    const { createdBy } = req.body
    if (!createdBy) return res.status(400).json({ error: 'createdBy required' })

    const { data: member } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', createdBy)
      .single()

    if (!member || !['owner', 'admin', 'member'].includes(member.role)) {
      return res.status(403).json({ error: 'Must be a server member to create invites' })
    }

    let code = generateInviteCode()
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase.from('server_invites').select('code').eq('code', code).single()
      if (!existing) break
      code = generateInviteCode()
    }

    const { data, error } = await supabase
      .from('server_invites')
      .insert({ code, server_id: req.params.id, created_by: createdBy })
      .select()
      .single()

    if (error) throw error
    await logAudit(req.params.id, createdBy, 'invite_created', { code })
    res.status(201).json(data)
  } catch (err) {
    console.error('Create invite error:', err)
    const msg = (err?.code === '42P01' || /relation.*does not exist/i.test(err?.message || ''))
      ? 'server_invites table missing — run migration 20250211000004_server_invites_audit.sql'
      : (err?.message || 'Failed to create invite')
    res.status(500).json({ error: msg })
  }
})

serversRouter.get('/:id/invites', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('server_invites')
      .select('code, created_by, expires_at, max_uses, use_count, created_at')
      .eq('server_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('List invites error:', err)
    res.status(500).json({ error: 'Failed to fetch invites' })
  }
})

serversRouter.delete('/:id/invites/:code', async (req, res) => {
  try {
    const revokedBy = req.query.revokedBy
    const { data, error } = await supabase
      .from('server_invites')
      .delete()
      .eq('server_id', req.params.id)
      .eq('code', req.params.code)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Invite not found' })
    if (revokedBy) await logAudit(req.params.id, revokedBy, 'invite_revoked', { code: req.params.code })
    res.json({ success: true })
  } catch (err) {
    console.error('Delete invite error:', err)
    res.status(500).json({ error: 'Failed to delete invite' })
  }
})

// ─── Audit log ──────────────────────────────────────────

serversRouter.get('/:id/audit-log', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('server_audit_log')
      .select('id, user_id, action, details, created_at')
      .eq('server_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    const userIds = [...new Set((rows || []).map((r) => r.user_id))]
    const usernames = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username, display_name').in('id', userIds)
      ;(users || []).forEach((u) => { usernames[u.id] = (u.display_name && u.display_name.trim()) || u.username })
    }
    const result = (rows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: usernames[r.user_id] || 'Unknown',
      action: r.action,
      details: r.details || {},
      createdAt: r.created_at,
    }))
    res.json(result)
  } catch (err) {
    console.error('Audit log error:', err)
    res.status(500).json({ error: 'Failed to fetch audit log' })
  }
})

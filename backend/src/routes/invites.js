import { Router } from 'express'
import crypto from 'crypto'
import supabase from '../db/supabase.js'

export const invitesRouter = Router()

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

// Generate short invite code (Discord-style: 8 chars)
function generateCode() {
  return crypto.randomBytes(4).toString('base64url').slice(0, 8)
}

// Get invite details (public — for join page)
invitesRouter.get('/:code', async (req, res) => {
  try {
    const { data: invite, error } = await supabase
      .from('server_invites')
      .select('code, server_id, created_by, expires_at, max_uses, use_count')
      .eq('code', req.params.code)
      .single()

    if (error || !invite) return res.status(404).json({ error: 'Invite not found or expired' })

    const now = new Date()
    if (invite.expires_at && new Date(invite.expires_at) < now) {
      return res.status(404).json({ error: 'Invite expired' })
    }
    if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
      return res.status(404).json({ error: 'Invite has reached max uses' })
    }

    const { data: server, error: serverErr } = await supabase
      .from('servers')
      .select('id, name, icon_url, banner_url')
      .eq('id', invite.server_id)
      .single()

    if (serverErr || !server) return res.status(404).json({ error: 'Server not found' })

    const { data: creator } = await supabase
      .from('users')
      .select('username')
      .eq('id', invite.created_by)
      .single()

    res.json({
      code: invite.code,
      server: { id: server.id, name: server.name, iconUrl: server.icon_url, bannerUrl: server.banner_url },
      inviter: creator?.username || 'Unknown',
      expiresAt: invite.expires_at,
      maxUses: invite.max_uses,
      useCount: invite.use_count,
    })
  } catch (err) {
    console.error('Get invite error:', err)
    res.status(500).json({ error: 'Failed to fetch invite' })
  }
})

// Join server via invite code
invitesRouter.post('/:code/join', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const { data: invite, error: invErr } = await supabase
      .from('server_invites')
      .select('code, server_id, expires_at, max_uses, use_count')
      .eq('code', req.params.code)
      .single()

    if (invErr || !invite) return res.status(404).json({ error: 'Invite not found or expired' })

    const now = new Date()
    if (invite.expires_at && new Date(invite.expires_at) < now) {
      return res.status(404).json({ error: 'Invite expired' })
    }
    if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
      return res.status(404).json({ error: 'Invite has reached max uses' })
    }

    const { error: joinErr } = await supabase
      .from('server_members')
      .upsert({ server_id: invite.server_id, user_id: userId, role: 'member' }, { onConflict: 'server_id,user_id' })

    if (joinErr) throw joinErr

    await supabase
      .from('server_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('code', req.params.code)

    await logAudit(invite.server_id, userId, 'member_joined', { via: 'invite', code: req.params.code })
    res.json({ success: true, serverId: invite.server_id })
  } catch (err) {
    console.error('Join via invite error:', err)
    res.status(500).json({ error: 'Failed to join server' })
  }
})

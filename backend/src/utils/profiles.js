/**
 * Resolve how a user should appear publicly (never expose login username).
 */
export function presentationFromProfile(profile, fallbackUser) {
  const displayName =
    (profile?.display_name && String(profile.display_name).trim()) ||
    (fallbackUser?.display_name && String(fallbackUser.display_name).trim()) ||
    'Unknown'
  return {
    displayName,
    avatarUrl: profile?.avatar_url || fallbackUser?.avatar_url || null,
    bannerUrl: profile?.banner_url || fallbackUser?.banner_url || null,
    bio: profile?.bio || '',
    profileType: profile?.profile_type || 'personal',
  }
}

export async function getUserActiveProfileType(supabase, userId) {
  const { data } = await supabase
    .from('users')
    .select('active_profile')
    .eq('id', userId)
    .maybeSingle()
  return data?.active_profile === 'work' ? 'work' : 'personal'
}

export async function getProfileRow(supabase, userId, profileType) {
  const type = profileType === 'work' ? 'work' : 'personal'
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('profile_type', type)
    .maybeSingle()
  return data
}

export async function resolveMemberPresentation(supabase, userId, profileType, userFallback) {
  const profile = await getProfileRow(supabase, userId, profileType)
  return presentationFromProfile(profile, userFallback)
}

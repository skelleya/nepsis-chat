/**
 * Regression: voice answerers must buffer trickle ICE that arrives before the
 * peer connection (or remote description) exists. Dropping those candidates
 * left both sides silent after join.
 *
 * Mirrors the queue policy in frontend/src/services/webrtc.ts.
 */

function shouldBufferIceCandidate(hasPeer, hasRemoteDescription) {
  return !hasPeer || !hasRemoteDescription
}

function queueIceCandidate(pending, from, candidate) {
  const buf = pending.get(from) || []
  buf.push(candidate)
  pending.set(from, buf)
}

function flushCandidates(pending, peerId) {
  const queued = pending.get(peerId) || []
  pending.delete(peerId)
  return queued
}

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('ok:', msg)
  }
}

// Answerer: candidates arrive before PC exists → must buffer (old bug: drop)
assert(shouldBufferIceCandidate(false, false) === true, 'buffer when peer PC missing')
assert(shouldBufferIceCandidate(true, false) === true, 'buffer when remote description missing')
assert(shouldBufferIceCandidate(true, true) === false, 'apply immediately when PC ready')

const pending = new Map()
queueIceCandidate(pending, 'peer-a', { candidate: 'a1' })
queueIceCandidate(pending, 'peer-a', { candidate: 'a2' })
queueIceCandidate(pending, 'peer-b', { candidate: 'b1' })
assert(pending.get('peer-a')?.length === 2, 'queues multiple candidates per peer')
assert(flushCandidates(pending, 'peer-a').map((c) => c.candidate).join(',') === 'a1,a2', 'flush returns queued order')
assert(!pending.has('peer-a'), 'flush clears peer queue')
assert(pending.get('peer-b')?.length === 1, 'other peer queues untouched')

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll ice-candidate queue checks passed')

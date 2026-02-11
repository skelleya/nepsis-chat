/**
 * Signaling interface - abstracts WebRTC signaling.
 * Frontend-only: uses BroadcastChannel for 2-tab testing.
 * Will be replaced with Socket.io when backend is ready.
 */

export type SignalingMessage =
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'join'; userId: string; channelId: string }
  | { type: 'leave'; userId: string; channelId: string }

const CHANNEL_PREFIX = 'nepsis-signaling-'

export function createBroadcastSignaling(channelId: string, userId: string) {
  const bc = new BroadcastChannel(`${CHANNEL_PREFIX}${channelId}`)

  const sendOffer = (to: string, sdp: RTCSessionDescriptionInit) => {
    bc.postMessage({ type: 'offer', from: userId, to, sdp } satisfies SignalingMessage)
  }

  const sendAnswer = (to: string, sdp: RTCSessionDescriptionInit) => {
    bc.postMessage({ type: 'answer', from: userId, to, sdp } satisfies SignalingMessage)
  }

  const sendIceCandidate = (to: string, candidate: RTCIceCandidateInit) => {
    bc.postMessage({ type: 'ice-candidate', from: userId, to, candidate } satisfies SignalingMessage)
  }

  const onMessage = (handler: (msg: SignalingMessage) => void) => {
    const fn = (e: MessageEvent<SignalingMessage>) => handler(e.data)
    bc.addEventListener('message', fn)
    return () => bc.removeEventListener('message', fn)
  }

  const join = () => {
    bc.postMessage({ type: 'join', userId, channelId } satisfies SignalingMessage)
  }

  const leave = () => {
    bc.postMessage({ type: 'leave', userId, channelId } satisfies SignalingMessage)
  }

  const close = () => bc.close()

  return { sendOffer, sendAnswer, sendIceCandidate, onMessage, join, leave, close }
}

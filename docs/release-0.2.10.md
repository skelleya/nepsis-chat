# Desktop 0.2.10

## Highlights

- Fix silent server voice both ways: buffer trickle ICE that arrived before the answerer’s peer connection existed.
- Answerer prepares its peer connection on join so offers only need SDP + flush of queued candidates.
- Unit check: `frontend/scripts/test-ice-candidate-queue.mjs` (via `npm run test:unit`).

## Tag

`v0.2.10` → Desktop Release workflow builds Windows/macOS installers.

export const SESSION_CAPABILITIES = Object.freeze(["PERSISTENT_WITH_RECONCILIATION", "RECONSTRUCTIBLE_SESSION", "EPHEMERAL_SESSION"]);
export function decideSessionRecovery(capability, state = {}) {
  if (!SESSION_CAPABILITIES.includes(capability)) throw new TypeError(`unsupported session capability: ${capability}`);
  if (capability === "PERSISTENT_WITH_RECONCILIATION") {
    if (state.session_available === true) return { action: "RESUME_AND_RECONCILE", fail_closed: false };
    if (state.reconstruction_inputs_available === true) return { action: "RECONSTRUCT_AND_VERIFY", fail_closed: false };
    return { action: "FAIL_CLOSED_SESSION_LOST", fail_closed: true };
  }
  if (capability === "RECONSTRUCTIBLE_SESSION") return state.reconstruction_inputs_available === true ? { action: "RECONSTRUCT_AND_VERIFY", fail_closed: false } : { action: "FAIL_CLOSED_MISSING_RECONSTRUCTION_INPUTS", fail_closed: true };
  return { action: "FAIL_CLOSED_EPHEMERAL_SESSION", fail_closed: true };
}

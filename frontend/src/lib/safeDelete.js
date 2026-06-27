/** On failed delete (or related action), send the user to the homepage instead of breaking the app. */
export function redirectHome(navigate) {
  if (typeof navigate === "function") {
    navigate("/", { replace: true });
    return;
  }
  window.location.replace("/");
}

export async function runDeleteAction(action, navigate) {
  try {
    await action();
  } catch {
    redirectHome(navigate);
  }
}

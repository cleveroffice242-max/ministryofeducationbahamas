import { getUser } from "@netlify/identity";
import { error } from "./http.js";

// Staff who may change content. Assign one of these roles to a user in the
// Netlify Identity dashboard; it applies from their next sign-in.
export const EDITOR_ROLES = ["editor", "admin"];

export async function isEditor(): Promise<boolean> {
  try {
    const user = await getUser();
    return !!user && user.roles.some((r) => EDITOR_ROLES.includes(r));
  } catch {
    return false;
  }
}

// Returns an error response when the caller isn't a signed-in editor, otherwise null.
export async function requireEditor(): Promise<Response | null> {
  try {
    const user = await getUser();
    if (!user) return error("Please sign in as Ministry staff to make changes.", 401);
    if (!user.roles.some((r) => EDITOR_ROLES.includes(r))) {
      return error("Your account doesn't have editor access. Ask an administrator to grant the editor role.", 403);
    }
    return null;
  } catch {
    return error("Sign-in could not be verified. Please sign in again.", 401);
  }
}

// Public VAPID key shared by the app and the ClerkMe reminder Worker.
// The matching private key is stored only as a Cloudflare Worker secret.
export const PUSH_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BOmGKXo7G7bdhAbeMMHds5rpr8PDmrsh_QMVZ3LI8lvIwaWrXYYqF7XrYfzuM47_depI8abDrFN98UrWtqec_ek";

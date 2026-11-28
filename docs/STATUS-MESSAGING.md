# ClerkMe Connect: chats, status and profile

## Product flow
- Chats reuses ClerkMe's verified student account and session. Students search by name or university and begin a private one-to-one conversation.
- Status shares short text, photo or video updates for exactly 24 hours. The audience can be all verified students, students with an existing ClerkMe conversation, or the owner only.
- Profile shows student identity, links to the existing account editor, and controls status privacy and push notifications.
- Replies to active statuses open the normal private conversation and are linked to the original status.

## Status storage and authorization
- `status_posts` stores the text, audience, media key, owner and expiry timestamp.
- `status_views` stores one view per status / viewer pair.
- `status_media_uploads` is a short-lived upload-intent record. An upload can only be attached by the same owner within one hour.
- `status_preferences` stores the default audience, whether a user opts out of other people's viewer lists, and whether replies are allowed.
- `status_replies` links a private message to the status that prompted it.
- Status media objects are stored in the private Cloudflare R2 `STATUS_MEDIA` binding. The HTTP media endpoint requires a signed-in ClerkMe session and checks current audience permissions before streaming the object. No public bucket URL is generated.
- Posts become invisible at the 24-hour expiry boundary. The feed removes expired rows and their media objects in bounded batches when it is opened. A scheduled cleanup trigger should be added for guaranteed physical reclamation even when the feed is unused.
- Photos: JPEG, PNG, WebP or GIF up to 8 MB. Short videos: MP4 or WebM up to 25 MB. Text is limited to 500 characters.

## Reply validation
The Durable Object checks that the referenced status belongs to the other member of the conversation, is still active, is not owner-only and allows replies. The message is saved in the existing direct-message table; `status_replies` preserves the association. This means status replies inherit the chat's delivery and read receipts.

## Background notifications
- The existing service worker handles Web Push and notification clicks.
- Profile requests notification permission, registers `/sw.js`, subscribes with the public VAPID key and persists the endpoint using `/api/push/subscriptions`.
- The chat Worker sends a generic push alert even if a WebSocket remains connected, because a connected tab can be hidden in the background. The service worker suppresses the system notification when a ClerkMe window is visibly open.
- Push delivery requires the matching private VAPID key and the chat Worker's `PUSH_SERVICE` binding plus shared `CRON_TOKEN` to be configured. Delivery is best-effort; the D1 chat history remains the source of truth. Push payloads do not include message content.

## Preview resources and release boundary
- Preview D1 migration: `0016_status_updates.sql` on `clerkme-preview`.
- Preview R2 bucket: `clerkme-status-preview`, Pages preview binding `STATUS_MEDIA`.
- The production `clerkme` D1 database and `clerkme-source-materials` bucket have not been migrated or changed for Status.
- Before a production release: create and bind a dedicated production `clerkme-status` bucket, apply migrations `0015` and `0016` to production, deploy the chat Worker with the matching Durable Object and push configuration, then run a two-account test.

## Security and known limitations
- Messages remain application-readable in D1; this is not end-to-end encryption.
- The current audience called “Students I have chatted with” is based on an existing one-to-one conversation, not a separate contacts/friends list.
- A visible browser window suppresses OS push to prevent duplicates; in-app notifications and live updates remain available.
- Expired media is cleaned in bounded batches when the feed is fetched. For high volume, add a scheduled cleanup worker and alert on deletion failures.
- Range requests for video media and a dedicated status media moderation/report workflow are not included in this first release.

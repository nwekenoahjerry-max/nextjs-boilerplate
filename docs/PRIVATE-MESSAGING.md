# ClerkMe private one-to-one messaging

## Architecture

- The existing ClerkMe session cookie remains the identity source. Every HTTP endpoint calls `requireUser`; the chat Worker independently verifies the same hashed session token before accepting a WebSocket.
- Cloudflare D1 stores the two-person conversation, membership, message history, read cursors, blocks and reports.
- A separate Cloudflare Worker exports the SQLite-backed `ConversationRoom` Durable Object. Each conversation ID maps to one room. The room handles WebSocket delivery, typing events, heartbeats and read receipts.
- Pages Functions provide authenticated inbox, user search, history, read, block, report, presence and WebSocket-proxy endpoints.
- Existing ClerkMe notification records are reused for offline messages. The chat Worker can hand off an OS push notification to the existing reminder Worker; message text is deliberately not included in the push payload.

## Data model

- `direct_conversations`: a stable ID and unique, sorted participant-pair key.
- `direct_conversation_members`: exactly two participant rows for conversations created by the API; each row has an independent read cursor and archive timestamp.
- `direct_messages`: durable message content, sender, client idempotency key, timestamps and delivery/edit/delete fields.
- `direct_message_blocks`: directional block relationship. Either direction makes the conversation unavailable to both users.
- `direct_message_reports`: user-submitted safety reports for review.

Message history is loaded newest-first with a 50-message cursor. The browser uses a UUID client message ID so reconnecting or retrying does not create a duplicate.

## Message states

- **Sending**: optimistic message held by the sender while the socket sends it.
- **Sent**: the Worker has persisted the message to D1 and acknowledged it to connected clients.
- **Delivered**: the recipient has an active connection to that conversation and the room delivered the event to that connection.
- **Read**: the recipient's last-read message cursor has reached this message.

A closed/idle browser is not considered delivered merely because a message is saved. It receives an in-app notification and, when the Web Push service is configured, a generic push alert.

## Local development and migrations

The migration is `migrations/0015_private_messaging.sql`.

Use the preview database for development:

```sh
npx wrangler d1 migrations apply clerkme-preview --remote
```

The same migration must be applied to the production `clerkme` database before enabling the production chat Worker:

```sh
npx wrangler d1 migrations apply clerkme --remote
```

Do not run the production migration until the reviewed feature is being released.

Deploy the preview Durable Object Worker:

```sh
npx wrangler deploy --config workers/chat/wrangler.toml --env preview
```

Deploy its production environment only after production D1 migration and the required Worker secrets have been configured:

```sh
npx wrangler deploy --config workers/chat/wrangler.toml
```

The preview Pages configuration binds to `clerkme-chat-preview`; production binds to `clerkme-chat`. The chat Worker uses the `DB` D1 binding and exports `ConversationRoom`.

## Push notification secrets

The existing reminder Worker must have its VAPID public/private keys configured. For offline direct-message push, the chat Worker and reminder Worker must also share the same `CRON_TOKEN` secret. Never place that value in `wrangler.jsonc`, source code, browser JavaScript or this document.

## Security notes and known limits

- Messages are visible only to authenticated conversation members through the API. IDs are not treated as authorization.
- The WebSocket handshake checks the request origin, the secure session, participant membership and block state. The room rechecks the session and membership on messages.
- The API validates same-origin writes, parameterizes SQL, limits messages to 4,000 characters and rate-limits sends to 30 per minute per sender.
- Browser sessions remain HTTP-only, Secure and SameSite=Lax. WebSocket traffic is WSS on the production domain.
- Message bodies are stored as application-readable text in D1. Transport security and Cloudflare-managed storage protection are not end-to-end encryption. Do not describe this release as E2EE. A true end-to-end encrypted mode would require client-held keys, device key management, recovery and a new encrypted-message payload format.
- No group chats, attachments, voice/video calls, message editing/deletion UI or message search are included in this first version.
- Reports are stored for moderation review; an admin review screen and moderation workflow still need to be added before opening messaging to a large community.
- Web Push is best-effort. In-app history remains the source of truth if a device is offline or a push subscription expires.

## Preview verification checklist

1. Sign in with two different verified test accounts.
2. Search for the other student by name or university, then start a conversation from either account.
3. Send in both directions and confirm the message appears once after reconnecting.
4. Close one browser and send from the other; confirm the offline in-app notification appears.
5. Reopen the recipient and confirm history loads, the sender sees Delivered and then Read.
6. Confirm presence, last seen and typing indicators update.
7. Block from one side; confirm the conversation disappears for both sides and new sends/history are denied.
8. Submit a report and confirm one `direct_message_reports` row is created.
9. Test mobile viewport, keyboard send, long-message wrapping, dark theme, and offline reconnect.

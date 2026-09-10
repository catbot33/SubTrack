# Gmail new-email monitoring

SubTrack stores a Gmail history cursor and sends every new Inbox message except
messages labeled Promotions through the same Gemini subscription classifier.
This includes transactional emails that Gmail categorizes as Personal rather
than Updates. Qualified trials and subscriptions enter **Needs review** and are
only copied into `Subscription` after the user confirms them.

## Google Cloud setup

1. Create a Pub/Sub topic in the same Google Cloud project as the Gmail OAuth client.
2. Grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role on that topic.
3. Set `GMAIL_PUBSUB_TOPIC` in `.env` to the full topic name:
   `projects/PROJECT_ID/topics/TOPIC_NAME`.
4. Deploy SubTrack to a public HTTPS URL. Pub/Sub cannot push to localhost.
5. Create a Pub/Sub push subscription whose endpoint is:
   `https://YOUR_HOST/api/webhooks/gmail?token=GMAIL_WEBHOOK_TOKEN`
6. Restart SubTrack and reconnect Gmail once. This registers the mailbox watch
   and stores its starting history cursor.

The server renews watches that expire within 24 hours and also reconciles Gmail
history every 15 minutes in case a push notification is delayed or dropped.
Pub/Sub events are stored before processing, retried up to five times, and
de-duplicated by Pub/Sub message ID. If Gmail expires an old history cursor,
SubTrack safely rechecks the most recent seven days before resuming incremental sync.

For local development without a public Pub/Sub endpoint, SubTrack falls back to
Gmail history polling once per minute. This is configured with
`GMAIL_FALLBACK_INTERVAL_MS=60000` and starts after Gmail is connected.

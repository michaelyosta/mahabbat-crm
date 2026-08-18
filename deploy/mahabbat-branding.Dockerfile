# Thin deployment overlay for the pinned Twenty v2.29.0 image.
# The App SDK does not own document/OG/PWA metadata. This overlay keeps the
# exact upstream runtime and database behavior while changing only the
# deployment-facing product title and share metadata to MAHABBAT.
#
# The overlay script is fail-closed: any missing replacement target aborts the
# build so a silently unbranded image can never be produced.
FROM twentycrm/twenty:v2.29.0

COPY deploy/branding-overlay.mjs /deploy/branding-overlay.mjs
RUN node /deploy/branding-overlay.mjs
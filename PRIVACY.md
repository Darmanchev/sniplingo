# SnipLingo Privacy Policy

Effective date: July 22, 2026

SnipLingo recognizes text in screenshots locally and sends text for translation
only after the user clicks **Translate**.

## Data processed on the device

- The selected screenshot and OCR model stay in the browser on the user's
  device.
- Recognized and translated text is displayed in the current tab. SnipLingo
  does not save this text to browser storage.
- Browser storage contains only the selected target language and result-panel
  layout.

## Data sent for translation

When the user clicks **Translate**, SnipLingo sends only the text visible in the
Original field and the selected target language over HTTPS to the SnipLingo
translation server. The server forwards them to DeepL to produce the
translation. Screenshots are never sent to either service.

Do not translate passwords, authentication secrets, payment-card data, health
records, or other sensitive personal information unless you are authorized to
send that information to DeepL. DeepL processes requests under its own
[privacy policy](https://www.deepl.com/en/privacy).

## Abuse prevention and operational data

The server temporarily processes the client IP address to enforce per-client
request and character limits and to block abusive sources. In-memory rate-limit
identifiers are salted hashes, are not written to application logs, and are
deleted when their limit window expires or the server restarts.

Per-request application logging is disabled for the public service. Aggregate
daily character-budget logs contain only totals and never contain translated
text, screenshots, IP addresses, URLs, or browser identifiers. The service is
deployed using Coolify. The hosting infrastructure and reverse proxy may
process standard network and service metadata, such as IP addresses, request
times, and response status codes, as necessary to route traffic, provide TLS,
maintain security, and operate the service. SnipLingo does not intentionally
configure them to record screenshots, translation request bodies, or
translation response bodies.

SnipLingo does not sell data, use translation text for advertising, or use it
to train models.

## Retention and deletion

The SnipLingo server keeps translation request and response bodies only in
memory while the request is being processed. It does not store them in a
database or application logs. Rate-limit records expire after one minute or 24
hours, depending on the limit. Aggregate daily budget counters reset after 24
hours.

## Contact and changes

Questions and privacy requests can be submitted through the
[SnipLingo GitHub repository](https://github.com/Darmanchev/sniplingo/issues).
Material changes will be published in this file with a new effective date.

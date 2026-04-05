# Gmail Query Patterns for Attachments

Use these query patterns with `gog gmail messages search`.

- All attachments from a sender domain:
  - `from:(@nubank.com.br) has:attachment`
- CSV attachments from a domain:
  - `from:(@nubank.com.br) has:attachment filename:csv`
- Restrict to recent period:
  - `from:(@nubank.com.br) has:attachment newer_than:90d`
- Subject-based filtering:
  - `subject:(invoice OR extrato) has:attachment`
- Include sent-to filter:
  - `to:me from:(billing@vendor.com) has:attachment`

Combine filters in one query string and pass it unchanged to `--query`.

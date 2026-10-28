# Website contact endpoint

The endpoint behind the contact form on [cofy.cloud](https://cofy.cloud/contact/): a
[Scaleway serverless function](https://www.scaleway.com/en/serverless-functions/) that emails
each message on through
[Scaleway Transactional Email](https://www.scaleway.com/en/transactional-email-tem/). The
recipient lives only in the function's configuration, never in the website, and visitors'
messages never leave European infrastructure.

[handler.py](handler.py) is the whole function, using only the standard library. It takes the
form as JSON, checks it, drops what fills the hidden `website` field (only bots see it), and
sends the message with the visitor's address as `Reply-To`, so answering is just replying.

## Setting it up

1. In Transactional Email, add and verify `cofy.cloud` as a sending domain.
2. Create an API key that may send email in that project.
3. Create a Python function from [handler.py](handler.py) with handler `handler.handle`, and
   configure:

   | Variable | Value |
   | --- | --- |
   | `CONTACT_TO` | Where messages go, e.g. the team's inbox |
   | `CONTACT_FROM` | A sender on the verified domain, e.g. `website@cofy.cloud` |
   | `ALLOWED_ORIGIN` | The website's origin, `https://cofy.cloud` |
   | `TEM_PROJECT_ID` | The Scaleway project the domain is in |
   | `TEM_SECRET_KEY` | The API key's secret, as a *secret* environment variable |

4. Build the website with the function's URL in `PUBLIC_CONTACT_ENDPOINT`.

## Development

```sh
uv run poe test
uv run poe lint
```

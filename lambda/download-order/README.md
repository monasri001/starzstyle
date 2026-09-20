# StarzStyle Lambda receipt download

Create a Lambda function named `starzstyle-download-order` in `ap-south-1`.

- Runtime: Node.js 22.x
- Architecture: x86_64
- Execution role: basic Lambda permissions only
- Handler file: copy `index.mjs` into the Lambda code editor

Create a Function URL with:

- Auth type: `NONE` for this classroom demo
- CORS allow origin: `*`
- CORS allow method: `POST`
- CORS allow header: `content-type`

Copy the Function URL into `.env.local` before building the website:

```text
NEXT_PUBLIC_DOWNLOAD_ORDER_URL=https://YOUR-ID.lambda-url.ap-south-1.on.aws/
```

Then run `npm run build`. The value is embedded in the static website during the build.

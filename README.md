# StarzStyle

StarzStyle is a responsive demo dress shop built with Next.js. It includes a campaign hero, category filters, favourites, product search, an editable shopping bag, a name-and-address checkout flow, and original fashion imagery.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If `S3_BUCKET` is not set, the startup uploader is skipped and the website continues using its local images.

`npm run dev` previews the frontend. To test RDS checkout locally, configure
the `DB_*` variables, run `npm run build`, and then run `npm start`.

## Automatic S3 image upload

All files under `public/images` are uploaded automatically before both `npm run dev` and `npm start`.

The uploader uses these variables:

```env
S3_BUCKET=starzstyle-dress-shop-CHANGE-ME
S3_REGION=ap-south-1
S3_PREFIX=images
```

On EC2, attach an IAM role to the instance instead of storing AWS access keys. The AWS SDK automatically obtains temporary credentials from that role.

To upload without starting the website:

```bash
npm run s3:upload
```

To intentionally disable uploads:

```bash
export SKIP_S3_UPLOAD=true
```

See [AWS-SETUP.md](./AWS-SETUP.md) for the complete classroom setup.

## Production build

```bash
npm run build
npm start
```

`npm run build` creates a static deployment in `out/`. The generated `out/`
folder is committed for the classroom EC2 demo, so the small EC2 instance does
not need to compile Next.js. On EC2, clone the repository, install dependencies,
set the S3 and RDS variables, and run `npm start`. The prestart uploader copies
the images to S3, then `server.mjs` serves the website and the order API on
`PORT` (8080 by default).

## RDS order storage

The checkout sends each completed order to `POST /api/orders`. The EC2 Node
server validates products and prices, creates the `orders` and `order_items`
tables when necessary, and saves the order in PostgreSQL RDS. Database
credentials are read only by `server.mjs`; do not prefix them with
`NEXT_PUBLIC_`.

Required runtime variables:

```env
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=starzstyle
DB_USER=postgres
DB_PASS=your-password
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

The database named by `DB_NAME` must already exist. Tables and indexes are
created automatically. A readable copy of the schema is in `db/schema.sql`.

Check both the website and database connection with:

```bash
curl http://localhost:8080/api/health
```

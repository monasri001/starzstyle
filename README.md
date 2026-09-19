# StarzStyle

StarzStyle is a responsive demo dress shop built with Next.js. It includes a campaign hero, category filters, favourites, product search, an editable shopping bag, a name-and-address checkout flow, and original fashion imagery.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If `S3_BUCKET` is not set, the startup uploader is skipped and the website continues using its local images.

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

The current version is a front-end demonstration. The RDS variables in `.env.example` are reserved for a future product/order backend and are not currently read by the site.

Orders are demo-only and remain in browser memory; submitting the checkout does not charge a customer or write an order to RDS.

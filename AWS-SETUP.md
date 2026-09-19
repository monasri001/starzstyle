# StarzStyle AWS classroom setup

The EC2 startup process automatically uploads every image from `public/images` to S3 before starting the website. You do not need to upload images manually during class.

## 1. Resource names

Use the following names, replacing the bucket suffix with a unique number:

```text
Shop: StarzStyle
Repository: StarzStyle
S3 bucket: starzstyle-dress-shop-987654
EC2 IAM role: StarzStyleEC2Role
RDS identifier: starzstyle-db
Database name: starzstyle
Region: ap-south-1
```

## 2. Public-read S3 bucket policy

This policy makes uploaded product images readable but does not allow public uploads or deletion:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadStarzStyleImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::starzstyle-dress-shop-987654/*"
    }
  ]
}
```

Replace the example bucket name with your actual globally unique bucket name.

## 3. EC2 IAM role policy

Create an IAM role trusted by EC2 and attach this least-privilege policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::starzstyle-dress-shop-987654"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::starzstyle-dress-shop-987654/*"
    }
  ]
}
```

Attach `StarzStyleEC2Role` from **EC2 → Instances → Actions → Security → Modify IAM role**. Do not create `S3_ACCESS_KEY` or `S3_SECRET_KEY` variables on EC2.

## 4. EC2 security group

```text
SSH         TCP 22     Your IP only
Custom TCP  TCP 8080   Your IP for classroom testing
HTTP        TCP 80     0.0.0.0/0 if you later configure Nginx
HTTPS       TCP 443    0.0.0.0/0 if you later configure HTTPS
```

## 5. EC2 terminal commands

```bash
sudo dnf update -y
sudo dnf install -y git nodejs20 python3

git clone https://github.com/monasri001/starzstyle.git
cd starzstyle

export SHOP_NAME="StarzStyle"
export S3_BUCKET="starzstyle-dress-shop-987654"
export S3_REGION="ap-south-1"
export S3_PREFIX="images"
export NODE_ENV="production"
export PORT="8080"

npm ci
npm start
```

The static website is already compiled in the committed `out/` directory, so
do not run `npm run build` on the 1 GiB EC2 classroom instance.

When `npm start` runs, npm automatically invokes `prestart`, which executes `scripts/upload-s3-assets.mjs`. Each file in `public/images` is uploaded to:

```text
s3://starzstyle-dress-shop-987654/images/
```

The website then starts on port 3000.

## 6. Verify the upload

The terminal prints one line per uploaded image followed by the public S3 prefix. You can also run the uploader independently:

```bash
npm run s3:upload
```

Check the application locally on EC2:

```bash
curl http://localhost:3000
```

Then open:

```text
http://YOUR_EC2_PUBLIC_IP:8080
```

## 7. RDS note

The current classroom website is a front-end demo. It does not yet query PostgreSQL, so RDS is optional for this version. Keep an RDS PostgreSQL instance private, in the same VPC as EC2, and allow port 5432 only from the EC2 security group when the backend is added.

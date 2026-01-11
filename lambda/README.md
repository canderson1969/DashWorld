# DashWorld Video Processor - AWS Lambda

This Lambda function processes uploaded videos, generating multiple quality versions (240p, 360p, 480p, 720p, 1080p) using FFmpeg.

## Architecture

```
R2 (originals/) → Lambda (FFmpeg) → R2 (videos/)
                       ↓
              Backend Webhook
```

## Prerequisites

1. AWS Account with Lambda access
2. Cloudflare R2 bucket configured
3. FFmpeg Lambda Layer (see below)

## Setup Instructions

### 1. Create FFmpeg Lambda Layer

You need an FFmpeg layer for Lambda. Options:

**Option A: Use existing public layer (easiest)**
```
arn:aws:lambda:us-east-1:678705203957:layer:ffmpeg:1
```

**Option B: Build your own**
```bash
# On Amazon Linux 2 or similar
mkdir -p layer/bin
cd layer
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar xf ffmpeg-release-amd64-static.tar.xz
cp ffmpeg-*-amd64-static/ffmpeg bin/
zip -r ../ffmpeg-layer.zip .
# Upload to Lambda as a layer
```

### 2. Deploy Lambda Function

```bash
cd lambda

# Install dependencies
npm install

# Create deployment package
zip -r function.zip index.mjs package.json node_modules

# Create function via AWS CLI
aws lambda create-function \
  --function-name dashworld-video-processor \
  --runtime nodejs24.x \
  --role arn:aws:iam::canderson1969:role/lambda-video-processor-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 900 \
  --memory-size 3008 \
  --ephemeral-storage Size=10240 \
  --layers arn:aws:lambda:us-east-1:337975222308:layer:ffmpeg_layer:1

# Or update existing function
aws lambda update-function-code \
  --function-name dashworld-video-processor \
  --zip-file fileb://function.zip
```

### 3. Configure Environment Variables

In AWS Console → Lambda → Configuration → Environment variables:

```
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=dashworld-uploads
BACKEND_WEBHOOK_URL=https://api.dashworld.net/api/webhooks/lambda/video-processed
WEBHOOK_SECRET=your-secure-webhook-secret
```

### 4. Create IAM Role

Create a role with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

Note: R2 access is handled via environment variables (S3-compatible API), not IAM.

### 5. Configure Backend

Add to your backend `.env`:

```
LAMBDA_FUNCTION_NAME=dashworld-video-processor
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
WEBHOOK_SECRET=your-secure-webhook-secret
```

## Lambda Configuration

| Setting | Recommended Value |
|---------|------------------|
| Runtime | Node.js 18.x |
| Memory | 3008 MB |
| Timeout | 15 minutes (900s) |
| Ephemeral Storage | 10 GB |

## Testing

### Invoke manually via AWS CLI:

```bash
aws lambda invoke \
  --function-name dashworld-video-processor \
  --payload '{"footageId": 1, "originalR2Key": "originals/2026/01/11/1/video.mp4", "outputBasePath": "2026/01/11/1"}' \
  --cli-binary-format raw-in-base64-out \
  response.json
```

### Test webhook locally:

```bash
curl -X POST http://localhost:5000/api/webhooks/lambda/video-processed \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "footageId": 1,
    "status": "completed",
    "mainFilename": "2026/01/11/1/720p-123456.mp4",
    "filename_240p": "2026/01/11/1/240p-123456.mp4",
    "filename_360p": "2026/01/11/1/360p-123456.mp4",
    "filename_480p": "2026/01/11/1/480p-123456.mp4",
    "filename_720p": "2026/01/11/1/720p-123456.mp4",
    "filename_1080p": "2026/01/11/1/1080p-123456.mp4"
  }'
```

## Cost Estimation

Per video (assuming 1 minute, 250MB):
- Lambda compute: ~$0.05-0.10 (3GB RAM, ~5 min processing)
- R2 storage: ~$0.015/GB/month
- R2 operations: Negligible

## Troubleshooting

### Lambda times out
- Increase timeout (max 15 minutes)
- Increase memory (more memory = faster CPU)
- Consider processing fewer qualities

### FFmpeg not found
- Verify FFmpeg layer is attached
- Check layer path: `/opt/bin/ffmpeg`

### R2 connection fails
- Verify R2 credentials in environment variables
- Check R2 bucket permissions (must allow Lambda IP ranges)

### Webhook not received
- Verify `BACKEND_WEBHOOK_URL` is publicly accessible
- Check backend logs for incoming requests
- Verify `WEBHOOK_SECRET` matches on both sides

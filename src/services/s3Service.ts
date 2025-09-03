// src/services/s3Service.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const BUCKET = process.env.AWS_BUCKET_NAME;
if (!BUCKET) throw new Error("AWS_BUCKET_NAME not set in env");

const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
if (!ACCESS_KEY || !SECRET_KEY) throw new Error("AWS credentials not set in env");

function buildS3Client(region: string) {
  const forcePathStyle = (process.env.AWS_S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true";
  const endpoint = `https://s3.${region}.amazonaws.com`;

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: ACCESS_KEY!,
      secretAccessKey: SECRET_KEY!,
    },
  });
}

let currentRegion = DEFAULT_REGION;
let s3Client = buildS3Client(currentRegion);

async function ensureClientMatchesBucketRegion(): Promise<void> {
  try {
    const cmd = new GetBucketLocationCommand({ Bucket: BUCKET });
    const resp = await s3Client.send(cmd);
    let bucketRegion = (resp?.LocationConstraint as string) || "";
    if (!bucketRegion) bucketRegion = "us-east-1";

    if (bucketRegion !== currentRegion) {
      currentRegion = bucketRegion;
      s3Client = buildS3Client(currentRegion);
      console.info(`S3 client reconfigured for bucket region: ${currentRegion}`);
    }
  } catch (err) {
    console.warn("Unable to determine bucket region; continuing with configured region", err);
  }
}

export async function uploadFileToS3(
  key: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  await ensureClientMatchesBucketRegion();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

export async function deleteFilesFromS3(keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) return;

  await ensureClientMatchesBucketRegion();

  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: chunk.map((k) => ({ Key: k })),
          Quiet: true,
        },
      })
    );
  }
}

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Cloudflare R2 environment variables are not fully set. Missing one of: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.");
}

export const r2 = new S3Client({
  region: "auto", // Required for Cloudflare R2
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

export const deleteR2Object = async (key: string): Promise<void> => {
  if (!R2_BUCKET_NAME) {
    console.warn("R2_BUCKET_NAME is not defined. Skipping R2 object deletion for key:", key);
    return;
  }
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2.send(command);
    console.log(`Successfully deleted R2 object: ${key}`);
  } catch (error) {
    console.error(`Error deleting R2 object ${key}:`, error);
    throw error; // Re-throw the error for upstream handling
  }
};

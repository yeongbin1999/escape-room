import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }
    if (!process.env.R2_BUCKET) {
      return NextResponse.json({ error: "R2_BUCKET environment variable not set" }, { status: 500 });
    }

    // Create a unique key for the file
    const uniqueId = crypto.randomUUID();
    const key = `themes/${uniqueId}-${filename.replace(/\s/g, '_')}`;

    const signedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 3600 } // 1 hour
    );
  
    // Return the signed URL and the key
    return NextResponse.json({ signedUrl, key });

  } catch (error) {
    console.error("Error generating signed URL for upload:", error);
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
  }
}

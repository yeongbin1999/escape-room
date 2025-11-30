import {
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });
  if (!process.env.R2_BUCKET) return NextResponse.json({ error: "R2_BUCKET environment variable not set" }, { status: 500 });

  try {
    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      }),
      { expiresIn: 3600 } // 1시간
    );
  
    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 });
  }
}

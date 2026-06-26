import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-1",
});

export const S3_PRIVATE_BUCKET = process.env.S3_PRIVATE_BUCKET || "akalingua-private";
export const S3_PUBLIC_BUCKET = process.env.S3_PUBLIC_BUCKET || "akalingua-public";
export const S3_REGION = process.env.AWS_REGION || "eu-west-1";

export const buildPrivateFileUrl = (key: string): string =>
  `https://${S3_PRIVATE_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

export const buildPublicFileUrl = (key: string): string =>
  `https://${S3_PUBLIC_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

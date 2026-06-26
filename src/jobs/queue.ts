import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "eu-west-1" });

export type JobType =
  | "SEND_OTP"
  | "SEND_EMAIL"
  | "SEND_SMS"
  | "SEND_NOTIFICATION"
  | "EXPIRE_QUOTES"
  | "NOTIFY_INTEREST_QUEUE"
  | "NOTIFY_ACCELERATOR_FEED";

export const enqueueJob = async (
  type: JobType,
  payload: Record<string, any>,
  delaySeconds = 0,
): Promise<void> => {
  if (process.env.NODE_ENV === "development") {
    // In development, just log the job — no SQS needed
    console.log(`[JOB QUEUED] ${type}:`, payload);
    return;
  }
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL as string,
      MessageBody: JSON.stringify({ type, payload }),
      DelaySeconds: delaySeconds,
    }),
  );
};

// ponytail: SQS not wired yet — enqueueJob just logs in every environment.
// To go live: uncomment the SQS client + send below and set SQS_QUEUE_URL /
// AWS creds in env. No call sites change.
// import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// const sqs = new SQSClient({ region: process.env.AWS_REGION || "eu-west-1" });

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
  const when = delaySeconds ? ` (+${delaySeconds}s)` : "";
  console.log(`[JOB QUEUED] ${type}${when}:`, payload);

  // await sqs.send(
  //   new SendMessageCommand({
  //     QueueUrl: process.env.SQS_QUEUE_URL as string,
  //     MessageBody: JSON.stringify({ type, payload }),
  //     DelaySeconds: delaySeconds,
  //   }),
  // );
};

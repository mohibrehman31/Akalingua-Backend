export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  is_read: boolean;
  read_at: Date | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

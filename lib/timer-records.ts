import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Mode = "timer" | "stopwatch";
export type Category = "Uncategorized" | "Work" | "Side Hustle" | "Blog" | "Other";

export type TimerRecord = {
  id: number;
  taskName: string;
  duration: number;
  date: string;
  mode: Mode;
  category: Category;
};

type TimerRecordInsert = Omit<TimerRecord, "id">;

type TimerRecordRow = {
  id: number;
  task_name: string;
  duration: number;
  date: string;
  mode: Mode;
  category: Category;
};

export const DEFAULT_CATEGORY: Category = "Uncategorized";

export const CATEGORY_OPTIONS: Category[] = [
  "Uncategorized",
  "Work",
  "Side Hustle",
  "Blog",
  "Other",
];

const TABLE_NAME = "timer_records";

let supabaseClient: SupabaseClient | null | undefined;

const getSupabaseClient = () => {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
};

const normalizeCategory = (value: unknown): Category => {
  if (CATEGORY_OPTIONS.includes(value as Category)) {
    return value as Category;
  }

  switch (value) {
    case "未設定":
      return "Uncategorized";
    case "仕事":
      return "Work";
    case "副業":
      return "Side Hustle";
    case "ブログ":
      return "Blog";
    case "その他":
      return "Other";
    default:
      return DEFAULT_CATEGORY;
  }
};

const mapRowToTimerRecord = (row: TimerRecordRow): TimerRecord => ({
  id: row.id,
  taskName: row.task_name,
  duration: row.duration,
  date: row.date,
  mode: row.mode === "stopwatch" ? "stopwatch" : "timer",
  category: normalizeCategory(row.category),
});

const getMissingConfigMessage = () =>
  "Supabase config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export const fetchTimerRecords = async () => {
  const client = getSupabaseClient();
  if (!client) {
    return { data: [] as TimerRecord[], error: getMissingConfigMessage() };
  }

  const { data, error } = await client
    .from(TABLE_NAME)
    .select("id, task_name, duration, date, mode, category")
    .order("date", { ascending: false });

  if (error) {
    return { data: [] as TimerRecord[], error: error.message };
  }

  const records = (data as TimerRecordRow[]).map(mapRowToTimerRecord);
  return { data: records, error: null as string | null };
};

export const insertTimerRecord = async (record: TimerRecordInsert) => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: getMissingConfigMessage() };
  }

  const { error } = await client.from(TABLE_NAME).insert([
    {
      task_name: record.taskName,
      duration: record.duration,
      date: record.date,
      mode: record.mode,
      category: record.category,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  return { error: null as string | null };
};

export const deleteTimerRecord = async (id: number) => {
  const client = getSupabaseClient();
  if (!client) {
    return { error: getMissingConfigMessage() };
  }

  const { error } = await client.from(TABLE_NAME).delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }

  return { error: null as string | null };
};

export const fetchTodayDuration = async () => {
  const client = getSupabaseClient();
  if (!client) {
    return { duration: 0, error: getMissingConfigMessage() };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const { data, error } = await client
    .from(TABLE_NAME)
    .select("duration")
    .gte("date", todayStart.toISOString())
    .lt("date", tomorrowStart.toISOString());

  if (error) {
    return { duration: 0, error: error.message };
  }

  const duration = (data as Array<{ duration: number | null }>).reduce(
    (sum, row) => sum + (row.duration ?? 0),
    0,
  );

  return { duration, error: null as string | null };
};
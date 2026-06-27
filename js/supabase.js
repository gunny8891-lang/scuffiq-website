const { createClient } = supabase;

const SUPABASE_URL = "https://scohjgsjjxbkpfuhlmrz.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_ja-1cvEG-6iOG8IO54UfeA_p5ngEFUe";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

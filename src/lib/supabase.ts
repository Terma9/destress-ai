/**
 * Single shared Supabase client for the app.
 * The URL and publishable key come from .env and are public by design —
 * Row Level Security in the database decides what each user may read or write.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Missing Supabase config: copy .env.example to .env and fill in the values.');
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // Keep the user's session on the device so they stay signed in across restarts.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build receives auth redirects in the URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

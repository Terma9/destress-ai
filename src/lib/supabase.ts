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
    // Phones keep the session in AsyncStorage so the user stays signed in.
    // On web, supabase-js picks storage itself: localStorage in the browser,
    // and in-memory during Expo's static pre-rendering in Node, which has no
    // `window` (passing AsyncStorage there crashes the build).
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

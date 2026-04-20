const DEBUG = false;

const SUPABASE_URL = 'https://dhrgjtnsyzybjsfaftrm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRocmdqdG5zeXp5YmpzZmFmdHJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc5MTQsImV4cCI6MjA5MjI5MzkxNH0.wQ6vJ_KUVMt7CturBfVvLJ088WpX1f4pUPfsXlKi1LY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

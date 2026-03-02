const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://geilroobnavmcalhkore.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaWxyb29ibmF2bWNhbGhrb3Jl';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
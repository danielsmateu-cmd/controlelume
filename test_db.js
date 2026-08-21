import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://veysoizitzprxznkdhqu.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXNvaXppdHpwcnh6bmtkaHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTQ1NDIsImV4cCI6MjA4NzE5MDU0Mn0.sLZ_evLuZZdxyDz87ITnt-uGdPNSXWODa9a12pfaypw");
async function check() {
  const { data, error } = await supabase.from('marketplace_listings').select('ml_item_id, variations').eq('ml_item_id', 'MLB3891206967');
  console.log("Data:", data);
  if(error) console.log("Error:", error);
}
check();

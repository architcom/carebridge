import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase=createClient('https://crddvvazctuugjyswigq.supabase.co','sb_publishable_-MG0bcuTHcVHeikqe1H5VQ_0GD_jCzu');
const form=document.getElementById('reset-form');
const message=document.getElementById('reset-message');
const button=document.getElementById('reset-button');
const {data:{user}}=await supabase.auth.getUser();
if(!user){button.disabled=true;message.textContent='This reset link is invalid or expired. Request a new link from the login page.'}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity()||!user)return;
  button.disabled=true;
  const {error}=await supabase.auth.updateUser({password:document.getElementById('new-password').value});
  if(error){message.textContent=error.message;message.classList.add('error');button.disabled=false;return}
  await supabase.auth.signOut();
  form.hidden=true;
  message.textContent='Password changed. Return to login and choose your account role.';
});

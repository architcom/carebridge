import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://crddvvazctuugjyswigq.supabase.co',
  'sb_publishable_-MG0bcuTHcVHeikqe1H5VQ_0GD_jCzu',
);
const $ = id => document.getElementById(id);
const form = $('auth-form');
const message = $('message');
const password = $('password');
let mode = 'login';

function setMessage(text, error=false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

function setMode(next) {
  mode = next;
  const register = next === 'register';
  $('login-tab').setAttribute('aria-selected', String(!register));
  $('register-tab').setAttribute('aria-selected', String(register));
  $('form-panel').setAttribute('aria-labelledby', register ? 'register-tab' : 'login-tab');
  $('form-title').textContent = register ? 'Create account' : 'Sign in';
  $('form-subtitle').textContent = register ? 'Join with your email address.' : 'Choose your role and enter your details.';
  $('submit-button').firstChild.textContent = register ? 'CREATE PATIENT ACCOUNT ' : 'LOGIN ';
  $('switch-prompt').textContent = register ? 'Already have an account?' : 'New here?';
  $('switch-link').firstChild.textContent = register ? 'Sign in ' : 'Create an account ';
  $('role-choice').hidden = register;
  $('register-role-note').hidden = !register;
  $('forgot-password').hidden = register;
  password.autocomplete = register ? 'new-password' : 'current-password';
  setMessage('');
}

async function finishLogin(user, expectedRole=null) {
  if (!user?.email_confirmed_at) {
    await supabase.auth.signOut();
    throw new Error('Please verify your email before signing in.');
  }
  const { data: account, error: accountError } = await supabase.from('login_accounts')
    .select('email').eq('id', user.id).maybeSingle();
  if (accountError) throw accountError;
  if (!account) {
    const { error } = await supabase.from('login_accounts').insert({id:user.id,email:user.email});
    if (error) throw error;
  }
  const { data: roleRow, error: roleError } = await supabase.from('user_roles')
    .select('role').eq('user_id', user.id).single();
  if (roleError || !roleRow) throw new Error('No role is assigned to this account. Check the Supabase setup.');
  if (expectedRole && roleRow.role !== expectedRole) {
    await supabase.auth.signOut();
    throw new Error(`This account is assigned as ${roleRow.role}. Choose “${roleRow.role}” to log in.`);
  }
  window.location.assign(roleRow.role === 'doctor' ? 'index.html' : 'patient.html');
}

$('login-tab').addEventListener('click', () => setMode('login'));
$('register-tab').addEventListener('click', () => setMode('register'));
$('switch-link').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
$('show-password').addEventListener('click', () => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'HIDE' : 'SHOW';
  $('show-password').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

$('forgot-password').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email || !$('email').checkValidity()) {
    $('email').reportValidity();
    setMessage('Enter your email address first.', true);
    return;
  }
  $('forgot-password').disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('reset.html', window.location.href).href,
  });
  setMessage(error ? error.message : 'If the account exists, a password reset link is on its way.', Boolean(error));
  $('forgot-password').disabled = false;
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const email = $('email').value.trim();
  const secret = password.value;
  const button = $('submit-button');
  button.disabled = true;
  setMessage('');
  try {
    if (mode === 'register') {
      const {data,error} = await supabase.auth.signUp({
        email,password:secret,
        options:{emailRedirectTo:new URL('login.html',window.location.href).href},
      });
      if (error) throw error;
      password.value='';
      if (data.session && data.user?.email_confirmed_at) await finishLogin(data.user,'patient');
      else setMessage('Check your inbox for a verification link, then log in as Patient.');
    } else {
      const role = form.querySelector('input[name="role"]:checked').value;
      const {data,error} = await supabase.auth.signInWithPassword({email,password:secret});
      if (error) throw error;
      password.value='';
      await finishLogin(data.user,role);
    }
  } catch (error) {
    setMessage(error.message || 'Unable to sign in. Please try again.', true);
  } finally { button.disabled=false; }
});

// A verification or recovery link may open this page with an existing session.
const {data:{user}} = await supabase.auth.getUser();
if (user?.email_confirmed_at) {
  try { await finishLogin(user); }
  catch (error) { setMessage(error.message,true); }
}

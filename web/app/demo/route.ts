export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Labra Navigation Design</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Albert+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #f6f8f8;
      --surface: #ffffff;
      --surface-2: #fafcfc;
      --canvas: #f0f4f4;
      --ink: #0a1f24;
      --ink-2: #455258;
      --ink-3: #889399;
      --line: #e2e7e8;
      --accent: #0d7c89;
      --accent-soft: #d6eef0;
      --accent-on: #ffffff;
    }
    body { font-family: "Albert Sans", system-ui, sans-serif; background: var(--bg); color: var(--ink); font-size: 14px; line-height: 1.5; }
    .container { display: flex; height: 100vh; flex-direction: column; }
    @media (min-width: 1024px) { .container { flex-direction: row; } }
    .sidebar { display: none; width: 240px; flex-direction: column; background: var(--surface-2); border-right: 1px solid var(--line); padding: 24px 16px 20px; height: 100vh; }
    @media (min-width: 1024px) { .sidebar { display: flex; } }
    .brand { font-family: "Fraunces", serif; font-weight: 500; font-size: 22px; line-height: 1; color: var(--ink); padding: 0 4px; }
    .brand .dot { color: var(--accent); font-style: italic; }
    .nav { margin-top: 32px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .nav-item { display: block; padding: 10px 12px; border-radius: 10px; font-size: 14px; background: transparent; color: var(--ink-2); border: none; cursor: pointer; transition: all 0.12s; font-family: "Albert Sans", system-ui, sans-serif; }
    .nav-item:hover { background: var(--canvas); color: var(--ink); }
    .nav-item.active { background: var(--ink); color: var(--surface); font-weight: 500; }
    .spacer { flex: 1; }
    .userline { padding: 0 4px; border-top: 0.5px solid var(--line); padding-top: 16px; }
    .user-name { font-size: 14px; font-weight: 500; color: var(--ink); line-height: 1.2; }
    .user-email { margin-top: 4px; font-family: "Geist Mono", monospace; font-size: 11px; color: var(--ink-3); letter-spacing: 0.2px; }
    .signout { margin-top: 12px; font-size: 13px; color: var(--ink-3); border: none; background: none; cursor: pointer; font-family: "Albert Sans", system-ui, sans-serif; }
    .signout:hover { color: var(--ink); }
    .mobile-header { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; height: 48px; border-bottom: 1px solid var(--line); background: var(--surface); }
    @media (min-width: 1024px) { .mobile-header { display: none; } }
    .mobile-brand { font-family: "Fraunces", serif; font-weight: 500; font-size: 19px; line-height: 1; color: var(--ink); }
    .mobile-brand .dot { color: var(--accent); font-style: italic; }
    .avatar-btn { width: 32px; height: 32px; border-radius: 50%; background: var(--canvas); color: var(--ink-2); border: none; cursor: pointer; font-family: "Albert Sans", system-ui, sans-serif; font-size: 12px; font-weight: 500; }
    .main { flex: 1; overflow: auto; padding: 56px 64px; background: var(--bg); padding-bottom: 56px; }
    @media (max-width: 1023px) { .main { padding-top: 48px; padding: 48px 32px 56px; } }
    .page-kicker { font-family: "Geist Mono", monospace; font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 12px; }
    .page-title { font-family: "Fraunces", serif; font-weight: 400; font-size: 44px; line-height: 1.05; letter-spacing: -1.2px; color: var(--ink); margin: 0; }
    .page-sub { font-size: 15px; color: var(--ink-2); margin-top: 14px; max-width: 540px; line-height: 1.55; }
    .mobile-nav { display: flex; height: 56px; border-top: 1px solid var(--line); background: var(--surface); position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; }
    @media (min-width: 1024px) { .mobile-nav { display: none; } }
    .mobile-nav button { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; border: none; background: none; cursor: pointer; font-family: "Albert Sans", system-ui, sans-serif; color: var(--ink-3); transition: all 0.12s; }
    .mobile-nav button.active { color: var(--ink); font-weight: 500; }
  </style>
</head>
<body>
  <div class="container">
    <aside class="sidebar">
      <div class="brand">labra<span class="dot">.</span></div>
      <nav class="nav">
        <button class="nav-item active" onclick="switchPage('evaluate', this)">Evaluate</button>
        <button class="nav-item" onclick="switchPage('tracker', this)">Tracker</button>
        <button class="nav-item" onclick="switchPage('settings', this)">Settings</button>
      </nav>
      <div class="spacer"></div>
      <div class="userline">
        <div class="user-name">Demo User</div>
        <div class="user-email">demo@labra.local</div>
        <button class="signout">Sign out</button>
      </div>
    </aside>
    <header class="mobile-header">
      <div class="mobile-brand">labra<span class="dot">.</span></div>
      <button class="avatar-btn">DU</button>
    </header>
    <main class="main">
      <div class="page-kicker" id="kicker">Evaluate</div>
      <h1 class="page-title" id="title">Verdict in &lt;15s.</h1>
      <p class="page-sub" id="description">Paste a recruiter message, a JD, a URL.</p>
    </main>
    <nav class="mobile-nav">
      <button class="active" onclick="switchPage('evaluate', this)">Evaluate</button>
      <button onclick="switchPage('tracker', this)">Tracker</button>
      <button onclick="switchPage('settings', this)">Settings</button>
    </nav>
  </div>
  <script>
    const pages = {
      evaluate: { kicker: 'Evaluate', title: 'Verdict in <15s.', description: 'Paste a recruiter message, a JD, a URL.' },
      tracker: { kicker: 'Tracker', title: 'Every role, one log.', description: 'Track every opportunity from first contact to offer.' },
      settings: { kicker: 'Settings', title: 'Your profile, plainly.', description: 'Manage your profile and preferences.' }
    };
    function switchPage(page, element) {
      document.querySelectorAll('.nav-item, .mobile-nav button').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(\`[onclick="switchPage('\${page}', this)"]\`).forEach(el => el.classList.add('active'));
      const pageData = pages[page];
      document.getElementById('kicker').textContent = pageData.kicker;
      document.getElementById('title').textContent = pageData.title;
      document.getElementById('description').textContent = pageData.description;
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

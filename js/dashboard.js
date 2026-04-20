var DEBUG = false;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkSession();
  if (!session) return;

  document.getElementById('settings-btn').addEventListener('click', openSettings);
});

function openSettings() {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-danger-outline';
  logoutBtn.textContent = 'Log out';
  logoutBtn.addEventListener('click', async () => {
    const confirmed = confirm('Log out?');
    if (confirmed) await logout();
  });

  content.appendChild(logoutBtn);
  showBottomSheet(content, 'Settings');
}

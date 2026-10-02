let timer = 0;
export function showToast(message: string) {
  const toast = document.querySelector<HTMLElement>('#site-toast');
  if (!toast) return;
  window.clearTimeout(timer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

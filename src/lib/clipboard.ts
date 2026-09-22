export async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Use the selection fallback below.
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const legacyClipboard = document as unknown as { execCommand(commandId: string): boolean };
  const copied = legacyClipboard.execCommand('copy');
  textarea.remove();
  return copied;
}

export async function copyFrom(button: HTMLButtonElement, value: string): Promise<void> {
  const original = button.textContent ?? '복사';
  const copied = await copyText(value);
  button.textContent = copied ? '복사됨' : '복사 실패';
  window.setTimeout(() => { button.textContent = original; }, 1400);
}

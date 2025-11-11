export function formatDateDMY(input) {
  if (!input) return '-';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return '-';
  }
}

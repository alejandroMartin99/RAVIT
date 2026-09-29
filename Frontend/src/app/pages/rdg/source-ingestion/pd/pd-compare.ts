export type PdCompareRow = Record<string, string>;

export function cellOf(row: PdCompareRow, key: string): string {
  return row[key] ?? '';
}

export function statusLabel(status: string): string {
  if (status === 'new_line') {
    return 'New';
  }
  if (status === 'Discard_Line') {
    return 'Discard';
  }
  return status;
}

export function compareFieldId(col: string): string | null {
  if (col === 'item_ref' || col === 'Item_Status' || col.startsWith('ChangeStatus')) {
    return null;
  }
  const base = col.endsWith('__Check') ? col.slice(0, -7) : col.endsWith('_New') ? col.slice(0, -4) : col.endsWith('_Old') ? col.slice(0, -4) : col;
  return /^\d{2}\.\d{2}$/.test(base) ? `flag:${base}` : base;
}

export function viewLikeValue(row: PdCompareRow, field: string): string {
  return cellOf(row, `${field}_New`) || cellOf(row, field);
}

export function arrowValue(from: string, to: string): string {
  return `${from || '—'} → ${to || '—'}`;
}

export function changedBases(row: PdCompareRow): string[] {
  const bases: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (value !== 'X') {
      continue;
    }
    if (key.startsWith('ChangeStatus')) {
      bases.push('ChangeStatus');
      continue;
    }
    if (key.endsWith('__Check')) {
      bases.push(key.slice(0, -7));
    }
  }
  return bases;
}

export function changeArrow(row: PdCompareRow, base: string, newIssue: string, oldIssue: string): string {
  if (base === 'ChangeStatus') {
    return arrowValue(cellOf(row, `${oldIssue}_New`) || cellOf(row, oldIssue), cellOf(row, newIssue) || cellOf(row, `${newIssue}_New`));
  }
  return arrowValue(cellOf(row, `${base}_Old`), cellOf(row, `${base}_New`) || cellOf(row, base));
}

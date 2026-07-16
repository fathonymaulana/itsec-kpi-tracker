export function computeCalcValue(
  formulaKey: string,
  inputValues: (number | null | undefined)[]
): number | null {
  const has = (v: number | null | undefined): v is number =>
    v !== null && v !== undefined && !isNaN(v as number)
  const n = (v: number) => Number(v)
  const [A, B, C, D, E] = inputValues

  try {
    switch (formulaKey) {
      case 'A/B':
        if (!has(A) || !has(B) || n(B) === 0) return null
        return n(A) / n(B)

      case 'B/A':
        if (!has(A) || !has(B) || n(A) === 0) return null
        return n(B) / n(A)

      case 'B/C':
        if (!has(B) || !has(C) || n(C) === 0) return null
        return n(B) / n(C)

      case 'C/B':
        if (!has(B) || !has(C) || n(B) === 0) return null
        return n(C) / n(B)

      case 'D/E':
        if (!has(D) || !has(E) || n(E) === 0) return null
        return n(D) / n(E)

      case 'A/(A+B)':
        if (!has(A) || !has(B) || (n(A) + n(B)) === 0) return null
        return n(A) / (n(A) + n(B))

      case '1-(A/B)':
        if (!has(A) || !has(B) || n(B) === 0) return null
        return 1 - n(A) / n(B)

      case '(A-B)/B':
        if (!has(A) || !has(B) || n(B) === 0) return null
        return (n(A) - n(B)) / n(B)

      case '(A-B)/A':
        if (!has(A) || !has(B) || n(A) === 0) return null
        return (n(A) - n(B)) / n(A)

      case '(C-D)/D':
        if (!has(C) || !has(D) || n(D) === 0) return null
        return (n(C) - n(D)) / n(D)

      case '1-((A-B)/B)':
        // PMO Forecasting Accuracy — signed difference, NOT absolute value
        if (!has(A) || !has(B) || n(B) === 0) return null
        return 1 - (n(A) - n(B)) / n(B)

      default:
        return null
    }
  } catch {
    return null
  }
}

export function formatValue(value: number | null, formulaKey?: string): string {
  if (value === null || value === undefined) return '—'
  // Format large numbers with commas, percentages as %
  if (Math.abs(value) < 10 && formulaKey && !formulaKey.startsWith('1-')) {
    return value.toFixed(2)
  }
  if (value > 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return value.toFixed(2)
}

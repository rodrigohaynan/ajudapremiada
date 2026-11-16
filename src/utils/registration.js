// Formatação e validação do CPF no cliente; o Supabase valida novamente.
export const onlyDigits = value => String(value || '').replace(/\D/g, '')

export function formatCpf(value) {
  const d = onlyDigits(value).slice(0, 11)
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)]
    .filter(Boolean).join('.') + (d.length > 9 ? '-' + d.slice(9) : '')
}

export function formatMobile(value) {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.length === 2 ? '(' + d + ')' : d
  const local = d.slice(2)
  return '(' + d.slice(0, 2) + ') ' +
    (local.length > 5 ? local.slice(0, 5) + '-' + local.slice(5) : local)
}

export function isValidCpf(value) {
  const d = onlyDigits(value)
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const checkDigit = length => {
    let sum = 0
    for (let index = 0; index < length; index++) {
      sum += Number(d[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return checkDigit(9) === Number(d[9]) &&
    checkDigit(10) === Number(d[10])
}

export const isValidMobile = value =>
  /^[1-9]\d9\d{8}$/.test(onlyDigits(value))

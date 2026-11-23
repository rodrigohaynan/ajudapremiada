// Endereço público oficial. Usado em links de e-mail, compartilhamentos e artes.
export const PUBLIC_SITE_URL = 'https://ajudeeganhe.com.br'
export const PUBLIC_SITE_HOST = new URL(PUBLIC_SITE_URL).host

export const campaignUrl = slug => PUBLIC_SITE_URL + '/campanha/' + encodeURIComponent(slug)

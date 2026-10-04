/* Configuracao publica da landing page.

   Devolve so o que o navegador precisa montar a pagina: se o WhatsApp
   esta configurado e os identificadores de analytics.

   O numero em si NAO e devolvido. Nao ha motivo para o navegador
   conhecer o numero comercial antes do lead enviar o formulario — o
   link so e montado depois do cadastro, no /api/leads. Assim o
   numero nao fica no cache de quem abre a pagina.

   Identificadores de analytics vao aqui por serem publicos por
   natureza: e o proposito deles. A chave secreta da Conversion API
   (pixel server-side) e outra coisa e nao entra neste arquivo.
*/

export default function handler(req, res) {
  const numero = (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  res.status(200).json({
    whatsapp_configurado: Boolean(numero),
    analytics: {
      // Pixel e GA4 sao publicos no HTML de qualquer pagina. Vem do
      // ambiente para nao ter dois lugares com o mesmo id.
      meta_pixel_id: process.env.META_PIXEL_ID || '',
      ga4_measurement_id: process.env.GA4_MEASUREMENT_ID || '',
      gtm_container_id: process.env.GTM_CONTAINER_ID || '',
      // Chave publica do Conversion API. A secreta nao vem aqui.
      meta_capi_token_publico: process.env.META_CAPI_TOKEN_PUBLICO || '',
    },
    webhook_configurado: Boolean(process.env.WEBHOOK_URL || ''),
  });
}
# Worki Digital — Landing de Análise Estratégica

Landing de conversão em arquivo único: `index.html`. Sem build, sem
dependência, sem framework. Abre direto no navegador ou sobe em qualquer
host estático.

## Configuração

Tudo o que precisa ser preenchido está no bloco `<script>` do final do
arquivo:

```js
const WEBHOOK_URL     = '';   // endpoint que recebe o lead (POST JSON)
const WHATSAPP_NUMBER = '';   // só dígitos, com DDI — ex.: 5585888888888

const PIXEL_ID   = '';        // Meta Pixel
const GA4_ID     = '';        // G-XXXXXXXXXX
const GTM_ID     = '';        // GTM-XXXXXXX
const ADS_ID     = '';        // AW-XXXXXXXXX
const ACCESS_TOKEN = '';      // Conversion API
```

Vazios = a página funciona igual, só não envia nem mede. Nada quebra.

## Fluxo do formulário

1. Valida a etapa (campos obrigatórios + WhatsApp com DDD e nono dígito 9)
2. Monta o lead com UTMs, `fbclid`, `gclid`, URL de origem, data/hora,
   timezone, página e user agent
3. Envia `POST JSON` para `WEBHOOK_URL`
4. **Só então** mostra "Cadastro recebido" e libera o botão de WhatsApp
5. Dispara o evento `Lead`

Se `WEBHOOK_URL` estiver vazio ou o POST falhar, o lead é guardado em
`localStorage` (`leads_worki`) em vez de se perder em silêncio.

### Payload

```json
{
  "nome": "", "whatsapp": "", "empresa": "", "segmento": "",
  "faturamento": "", "investimento": "", "gargalo": "",
  "gargalo_outro": "", "meta_90_dias": "",
  "utm_source": "", "utm_medium": "", "utm_campaign": "",
  "utm_content": "", "utm_term": "", "fbclid": "", "gclid": "",
  "origem_url": "", "pagina_origem": "", "pagina": "",
  "data_hora": "", "timezone": "", "user_agent": ""
}
```

A origem fica salva em `sessionStorage` na primeira visita, então quem
volta pela navegação interna continua com a atribuição correta.

## Eventos

`PageView`, `ViewContent`, `FormStart`, `FormStep`, `Lead`, `WhatsAppClick`.
Todos vão para `window.__events` para inspeção, e para GA4/Meta quando os
IDs estão configurados. `Lead` só dispara **depois** de o lead ser salvo.

## Regras de conteúdo

Nenhum número além dos quatro da faixa de prova. Sem depoimento, sem nome
de cliente, sem promessa de resultado. A observação sobre variação de
resultados aparece na prova e no rodapé.

Para alterar os indicadores (+R$ 5 mi, +R$ 13 mi, +70, 4+ anos), edite a
seção `.proof` no HTML.

## Acessibilidade

`lang="pt-BR"`, landmarks semânticos, skip link, `label` associado por
`for` em todo campo, `aria-live` no sucesso, `aria-disabled` nos CTAs sem
número, e `prefers-reduced-motion` respeitado.

## Testado

Desktop 1280px, mobile 390px e 320px sem overflow horizontal. Fluxo
completo do formulário validado no navegador: bloqueio de campo vazio,
recusa de telefone fixo, máscara brasileira, avanço entre as 6 etapas,
toggle de "Outro", gravação do lead e evento `Lead` por último.

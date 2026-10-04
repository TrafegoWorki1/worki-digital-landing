/* Monta o index.html unindo os tres arquivos de origem.

   Manter estilo, corpo e script separados deixa cada parte revisavel;
   o Vercel precisa de um unico index.html. Este script gera o arquivo
   final e verifica que nada se perdeu na montagem.
*/

import { readFile, writeFile } from 'node:fs/promises';

const RAIZ = '/opt/data/worki-landing';

const CABECALHO = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Worki Digital | Tráfego Pago, Performance, CRM, Automação e IA</title>
<meta name="description" content="Transforme tráfego em oportunidades e oportunidades em vendas. Conheça a metodologia da Worki Digital para aquisição, CRM, automação e inteligência artificial.">
<meta name="theme-color" content="#0a0a0b">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Worki Digital">
<meta property="og:title" content="Worki Digital | Tráfego Pago, Performance, CRM, Automação e IA">
<meta property="og:description" content="Transforme tráfego em oportunidades e oportunidades em vendas. Conheça a metodologia da Worki Digital para aquisição, CRM, automação e inteligência artificial.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Worki Digital | Tráfego Pago, Performance, CRM, Automação e IA">
<meta name="twitter:description" content="Transforme tráfego em oportunidades e oportunidades em vendas.">

<!-- Favicon: S inline, zero requisicao extra -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0a0b'/%3E%3Ctext x='16' y='23' font-family='Inter,sans-serif' font-size='19' font-weight='800' fill='%23f5b000' text-anchor='middle'%3EW%3C/text%3E%3C/svg%3E">

<style>
`;

const ESTILO = `
</style>
</head>
<body>

<!-- Leve ao vivo porque estes ids sao publicos por natureza.
     A chave secreta da Conversion API e outra coisa: ela fica no
     servidor, nunca no HTML. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
</script>
`;

const FIM = `
</body>
</html>
`;

async function main() {
  const estilos = await readFile(`${RAIZ}/estilos.css`, 'utf8');
  const corpo = await readFile(`${RAIZ}/corpo.html`, 'utf8');
  const script = await readFile(`${RAIZ}/script.js`, 'utf8');

  // O conteudo original tem comentarios de arquivo em JS e CSS que
  // virariam texto na pagina. Tira a primeira linha de comentario.
  const cssLimpo = estilos.replace(/^﻿?\/\*[\s\S]*?\*\/\s*/, '');
  const jsLimpo = script.replace(/^﻿?\/\*[\s\S]*?\*\/\s*/, '');

  const html = CABECALHO + cssLimpo + ESTILO + corpo + '<script>\n' + jsLimpo + FIM;

  await writeFile(`${RAIZ}/index.html`, html, 'utf8');

  // Verificacao de montagem: se faltar alguma peca, o erro aparece
  // aqui e nao em producao.
  const checagens = [
    ['CSS embutido', html.includes('--ambar:')],
    ['selo do hero', html.includes('ACELERAÇÃO DE VENDAS'.toLowerCase()) || html.includes('Aceleração de vendas')],
    ['headline do hero', html.includes('operação')],
    ['indicador 5 milhoes', html.includes('+R$ 5 milhões')],
    ['indicador 13 milhoes', html.includes('+R$ 13 milhões')],
    ['indicador 70 projetos', html.includes('+70 projetos')],
    ['indicador 4 anos', html.includes('4+ anos')],
    ['ressalva de resultados', html.includes('Resultados variam conforme')],
    ['secao problema', html.includes('Seu problema pode não ser falta de tráfego')],
    ['destaque do desperdicio', html.includes('apenas aumenta o desperdício')],
    ['quatro cartoes', html.includes('Tráfego &amp; Aquisição') &&
      html.includes('Performance') &&
      html.includes('CRM &amp; Comercial') &&
      html.includes('Automação &amp; IA')],
    ['seis etapas do metodo', html.includes('01') && html.includes('Diagnóstico') &&
      html.includes('Otimização')],
    ['fluxo anuncio ate venda', html.includes('Anúncio') && html.includes('Follow-up')],
    ['perfil 60 mil', html.includes('R$ 60 mil/mês')],
    ['comparacao tradicional', html.includes('Modelo tradicional') &&
      html.includes('cinco fornecedores')],
    ['formulario multi-etapa', html.includes('data-etapa="5"')],
    ['campo whatsapp', html.includes('id="whatsapp"')],
    ['opcao de faturamento alta', html.includes('Acima de R$ 500 mil')],
    ['opcao de investimento alta', html.includes('Acima de R$ 50 mil/mês')],
    ['gargalos', html.includes('Mensurar melhor marketing e vendas')],
    ['meta 90 dias', html.includes('meta_90_dias')],
    ['botao solicitar analise', html.includes('Solicitar minha análise')],
    ['tela de sucesso', html.includes('Cadastro recebido')],
    ['botao whatsapp final', html.includes('Falar com a Worki Digital')],
    ['cta final forte', html.includes('deixando na mesa entre o clique e a venda')],
    ['cta fixo mobile', html.includes('cta-fixo')],
    ['evento Lead', html.includes("'Lead'") || html.includes('"Lead"')],
    ['evento PageView', html.includes('PageView')],
    ['evento FormStart', html.includes('FormStart')],
    ['evento FormStep', html.includes('FormStep')],
    ['evento WhatsAppClick', html.includes('WhatsAppClick')],
    ['evento ViewContent', html.includes('ViewContent')],
    ['UTMs lidas', html.includes('utm_campaign') && html.includes('utm_term')],
    ['fbclid e gclid', html.includes('fbclid') && html.includes('gclid')],
    ['chamada do endpoint', html.includes("fetch('/api/leads'")],
    ['link do whatsapp montado pelo servidor', html.includes('resposta.whatsapp')],
    ['sem cliches de agencia', !html.includes('apassionados por marketing') &&
      !html.includes('próximo nível') &&
      !html.includes('Soluções personalizadas')],
  ];

  console.log(`index.html gerado: ${html.length} bytes`);
  console.log('');

  let falhas = 0;
  checagens.forEach(function (c) {
    const ok = c[1];
    if (!ok) falhas++;
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${c[0]}`);
  });

  console.log('');
  console.log(falhas === 0
    ? `Todas as ${checagens.length} verificacoes passaram.`
    : `${falhas} verificacao(oes) falharam.`);

  process.exit(falhas === 0 ? 0 : 1);
}

main();
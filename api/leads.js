/* Salva o lead da landing page.

   Ordem que o dono definiu e que importa: **salvar antes de
   encaminhar para o WhatsApp**. Se o salvamento falhar, o lead nao
   recebe o link do WhatsApp. Mandar o cara para o atendimento e so
   depois descobrir que o cadastro nao gravou significa perder a
   oportunidade sem nem registrar o contato.

   Onde grava, em ordem de preferencia:

   1. WEBHOOK_URL, se configurada. Owner do dado e quem configura.
   2. Arquivo local em privado/leads.jsonl. Nao e backup, e o ultimo
      recurso para o lead nao virar ar.

   Configuracao (variaveis de ambiente do servidor):

     WEBHOOK_URL           destino do cadastro. Vazio = usa o arquivo.
     WEBHOOK_TOKEN         cabecalho Authorization, opcional.
     WHATSAPP_NUMBER       numero comercial que recebe o lead.
     WHATSAPP_MENSAGEM_FIXA mensagem que abre a conversa.

   A chave de webhook fica no servidor. Nunca vai para o navegador:
   quem visse o codigo da pagina poderia reenviar cadastro para a sua
   URL e lotar o webhook.
*/

import { appendFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/* Onde o lead e gravado quando o arquivo local e usado.

   O padrao e /tmp, e nao um caminho dentro do projeto. Motivo concreto:
   em hosting de funcao sem servidor o sistema de arquivos pode ser
   somente-leitura, e o `appendFile` estoura. A primeira versao apontava
   para dentro do projeto e, em producao, **todo lead era recusado** com
   "nao foi possivel registrar" — validacao passava, gravacao falhava.

   Por isso a ordem e: tenta o arquivo local; se falhar e nao houver
   webhook, so THEN recusa. Com webhook configurado a gravacao local
   deixa de ser obrigatoria. */
const PASTA = process.env.LEADS_DIR || join(tmpdir(), 'worki-leads');
const ARQUIVO = join(PASTA, 'leads.jsonl');

// Campos que o dono pediu. Lista fechada: o que chega fora disso e
// ignorado, para nao guardar lixo no webhook.
const CAMPOS_TEXTO = {
  nome: 120,
  whatsapp: 40,
  empresa: 160,
  segmento: 160,
  meta_90_dias: 600,
  gargalo_outro: 300,
  // Da variante de 3 laminas: qualificacao com cargo, instagram e
  // papel na decisao. Sem cargo e decisor nao da para saber quem
  // respondeu, so que a empresa tem interesse.
  cargo: 80,
  instagram: 80,
  decisor: 40,
  origem_pagina: 300,
};

const OPCOES = {
  faturamento: [
    'Até R$ 30 mil',
    'R$ 30 mil a R$ 60 mil',
    'R$ 60 mil a R$ 100 mil',
    'R$ 100 mil a R$ 300 mil',
    'R$ 300 mil a R$ 500 mil',
    'Acima de R$ 500 mil',
  ],
  investimento: [
    'Ainda não investe',
    'Até R$ 3 mil/mês',
    'R$ 3 mil a R$ 10 mil/mês',
    'R$ 10 mil a R$ 30 mil/mês',
    'R$ 30 mil a R$ 50 mil/mês',
    'Acima de R$ 50 mil/mês',
  ],
  // Faixas novas da variante de 3 laminas. As duas listas coexistem:
  // `faturamento` e a lista antiga e `faturamento_3l` a nova, porque
  // a pagina antiga ja esta no ar com os rotulos dela.
  faturamento_3l: [
    'Até R$ 30 mil',
    'R$ 30 mil a R$ 60 mil',
    'R$ 60 mil a R$ 100 mil',
    'R$ 100 mil a R$ 300 mil',
    'R$ 300 mil a R$ 500 mil',
    'R$ 500 mil a R$ 1 milhão',
    'Acima de R$ 1 milhão',
  ],
  cargo: [
    'Sócio / Proprietário',
    'CEO / Diretor',
    'Diretor de Marketing',
    'Diretor Comercial',
    'Gerente',
    'Coordenador',
    'Analista',
    'Outro',
  ],
  decisor: [
    'SIM, SOU DECISOR',
    'PARTICIPO DA DECISÃO',
    'NÃO SOU DECISOR',
  ],
};

const GARGALOS = [
  'Gerar mais leads',
  'Melhorar a qualidade dos leads',
  'Aumentar conversão em vendas',
  'Estruturar CRM',
  'Melhorar acompanhamento dos leads',
  'Automatizar atendimento',
  'Implementar IA',
  'Mensurar melhor marketing e vendas',
  'Outro',
];

function soTexto(valor, max) {
  return String(valor == null ? '' : valor)
    // Remove quebras de linha: texto de uma linha, senao o log fica
    // com varias linhas por lead e quebra a leitura linha a linha.
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
}

function opcaoValida(valor, lista) {
  return lista.includes(valor) ? valor : '';
}

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

/* Recusa telefone que nao parece brasileiro. O minimo e 10 digitos, com
   codigo de pais, para o time comercial conseguir retornar.

   Aceita 12 digitos tambem. Numero brasileiro de celular tem 13
   (55 + DDD + 9). O 12 aparece em numero de ramal, ou em cadastro com
   um digito a mais ou a menos, e rejeitar esse caso joga fora lead
   valido: o prefixo 55 ainda esta la e o link de WhatsApp funciona. */
function telefoneValido(bruto) {
  const d = soDigitos(bruto);
  if (d.length >= 13 && d.startsWith('55')) return d;
  if (d.length === 12 && d.startsWith('55')) return d;
  if (d.length === 11) return '55' + d;
  if (d.length === 10) return '55' + d;
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'método não permitido' });
    return;
  }

  const d = req.body || {};
  const variante = soTexto(d.variante, 20);

  const nome = soTexto(d.nome, CAMPOS_TEXTO.nome);
  if (!nome) {
    res.status(400).json({ erro: 'informe seu nome', campo: 'nome' });
    return;
  }

  const telefone = telefoneValido(d.whatsapp);
  if (!telefone) {
    res.status(400).json({
      erro: 'informe um WhatsApp válido com DDD',
      campo: 'whatsapp',
    });
    return;
  }

  // E-mail e obrigatorio na variante de 3 laminas. Nao e validado na
  // pagina antiga, que pede e-mail como opcional: exigir aqui quebraria
  // o envio da pagina que ja esta no ar.
  if (variante === 'tres-laminas') {
    const email = soTexto(d.email, 160).toLowerCase();
    if (!email) {
      res.status(400).json({ erro: 'informe seu e-mail', campo: 'email' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ erro: 'e-mail inválido', campo: 'email' });
      return;
    }
  }

  const lead = {
    nome,
    whatsapp: telefone,
    email: soTexto(d.email, 160).toLowerCase(),
    empresa: soTexto(d.empresa, CAMPOS_TEXTO.empresa),
    segmento: soTexto(d.segmento, CAMPOS_TEXTO.segmento),
    cargo: opcaoValida(d.cargo, OPCOES.cargo),
    instagram: soTexto(d.instagram, CAMPOS_TEXTO.instagram).replace(/^@/, ''),
    decisor: opcaoValida(d.decisor, OPCOES.decisor),
    // O rotulo de faturamento depende da variante, porque as duas
    // paginas tem faixas diferentes. Valida contra a lista certa.
    faturamento: variante === 'tres-laminas'
      ? opcaoValida(d.faturamento, OPCOES.faturamento_3l)
      : opcaoValida(d.faturamento, OPCOES.faturamento),
    investimento: opcaoValida(d.investimento, OPCOES.investimento),
    gargalo: opcaoValida(d.gargalo, GARGALOS),
    gargalo_outro:
      d.gargalo === 'Outro'
        ? soTexto(d.gargalo_outro, CAMPOS_TEXTO.gargalo_outro)
        : '',
    meta_90_dias: soTexto(d.meta_90_dias, CAMPOS_TEXTO.meta_90_dias),

    // Origem do trafego. fbclid e gclid sao o click id que permite
    // amarrar o lead ao anuncio que ele veio.
    utm_source: soTexto(d.utm_source, 200),
    utm_medium: soTexto(d.utm_medium, 200),
    utm_campaign: soTexto(d.utm_campaign, 200),
    utm_content: soTexto(d.utm_content, 200),
    utm_term: soTexto(d.utm_term, 200),
    fbclid: soTexto(d.fbclid, 200),
    gclid: soTexto(d.gclid, 200),

    page_url: soTexto(d.page_url || d.url_origem, 500),
    url_origem: soTexto(d.url_origem, 500),
    referer: soTexto(d.referer, 500),
    origem_pagina: soTexto(d.origem_pagina, CAMPOS_TEXTO.origem_pagina),
    variante,
    criado_em: new Date().toISOString(),
    origem_formulario: variante === 'tres-laminas'
      ? 'landing-worki-3-laminas'
      : 'landing-worki-digital',
    status: 'novo',
  };

  // --- 1. Arquivo local. Sempre, mesmo com webhook. ---
  // Motivo: se o webhook cair, o lead ainda fica registrado aqui e da
  // para reprocessar depois. Webhook sem copia e bete.
  let arquivoOk = true;
  try {
    await mkdir(PASTA, { recursive: true });
    await appendFile(ARQUIVO, JSON.stringify(lead) + '\n', 'utf8');
  } catch (e) {
    arquivoOk = false;
  }

  // --- 2. Webhook, se houver. ---
  const webhook = process.env.WEBHOOK_URL || '';
  let viaWebhook = false;
  let erroWebhook = '';

  if (webhook) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = process.env.WEBHOOK_TOKEN || '';
      if (token) headers.Authorization = `Bearer ${token}`;

      const resposta = await fetch(webhook, {
        method: 'POST',
        headers,
        body: JSON.stringify(lead),
        signal: AbortSignal.timeout(12000),
      });
      viaWebhook = resposta.ok;
      if (!resposta.ok) {
        erroWebhook = `webhook respondeu HTTP ${resposta.status}`;
      }
    } catch (e) {
      erroWebhook = `webhook falhou: ${e.message || e}`;
    }
  }

  // Nenhum destino funcionou. Recusar e melhor que aceitar e perder:
  // lead que o time nunca ve e pior que lead que o lead recebe um erro
  // e tenta de novo.
  if (!arquivoOk && !viaWebhook) {
    res.status(500).json({
      erro: 'não foi possível registrar seu cadastro agora',
      detalhe: 'tente novamente em instantes',
    });
    return;
  }

  // --- 3. Link do WhatsApp, montado so depois de salvar. ---
  const numero = soDigitos(process.env.WHATSAPP_NUMBER || '');
  let linkWhatsapp = null;
  if (numero) {
    const mensagem =
      soTexto(process.env.WHATSAPP_MENSAGEM_FIXA, 400) ||
      'Olá! Acabei de preencher o formulário da Worki Digital e gostaria ' +
        'de solicitar uma análise da minha operação.';
    linkWhatsapp =
      'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem);
  }

  res.status(200).json({
    ok: true,
    salvo: true,
    via_webhook: viaWebhook,
    // O lead foi salvo, mesmo que o webhook tenha falhado: quem
    // responde decide o que fazer com isso.
    observacao: erroWebhook || null,
    whatsapp: linkWhatsapp,
  });
}
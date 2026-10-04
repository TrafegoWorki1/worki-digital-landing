/* Prova que o webhook recebe o lead.

   Sobe um servidor HTTP local que finge ser o destino do webhook,
   aponta WEBHOOK_URL para ele e envia um lead. Verifica se o servidor
   recebeu o corpo com os campos certos.

   Necessario porque sem isso a gente so sabe que o arquivo local foi
   gravado, e nao que a integracao externa funciona.
*/

import { createServer } from 'node:http';
import { join } from 'node:path';

process.env.LEADS_DIR = process.env.LEADS_DIR || join('/tmp', 'worki-leads-webhook-teste');
const ARQUIVO_WEBHOOK_TESTE = join(process.env.LEADS_DIR, 'leads.jsonl');

let recebido = null;
let statusResposta = 200;
let cabecalhos = null;

const servidor = createServer((req, res) => {
  let corpo = '';
  req.on('data', (pedaco) => { corpo += pedaco; });
  req.on('end', () => {
    cabecalhos = req.headers;
    try {
      recebido = JSON.parse(corpo);
    } catch (e) {
      recebido = { erro_ao_parsear: true, corpo };
    }
    res.writeHead(statusResposta, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: statusResposta < 300 }));
  });
});

await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const porta = servidor.address().port;
const urlWebhook = `http://127.0.0.1:${porta}/hook`;

process.env.WEBHOOK_URL = urlWebhook;
process.env.WEBHOOK_TOKEN = 'segredo-de-teste-123';
process.env.WHATSAPP_NUMBER = '558592494552';

const mod = await import('./api/leads.js');
const handler = mod.default;

let falhas = 0;
function teste(nome, ok, detalhe) {
  if (ok) console.log(`OK   ${nome}`);
  else { console.log(`FALHA ${nome}${detalhe ? ' -> ' + detalhe : ''}`); falhas++; }
}

function respostaFalsa() {
  const r = { statusCode: 0, corpo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (j) => { r.corpo = j; return r; };
  return r;
}

const lead = {
  nome: 'Carlos Teste Webhook',
  whatsapp: '(11) 97777-6666',
  empresa: 'Oficina Exemplo',
  segmento: 'Centro automotivo',
  faturamento: 'R$ 100 mil a R$ 300 mil',
  investimento: 'R$ 10 mil a R$ 30 mil/mês',
  gargalo: 'Implementar IA',
  meta_90_dias: 'Aumentar faturamento',
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'busca-maio',
  utm_content: 'anuncio-03',
  utm_term: 'automacao',
  fbclid: 'fb-teste-99',
  gclid: '',
  url_origem: 'https://exemplo.com/?utm_campaign=busca-maio',
  referer: 'https://google.com/',
};

console.log('== webhook respondendo 200 ==');
let r = respostaFalsa();
await handler({ method: 'POST', body: lead }, r);

teste('lead aceito', r.statusCode === 200, `veio ${r.statusCode}`);
teste('informa que salvou via webhook', r.corpo.via_webhook === true,
  JSON.stringify(r.corpo));
teste('webhook realmente recebeu', recebido !== null);
if (recebido) {
  teste('webhook recebeu o nome', recebido.nome === 'Carlos Teste Webhook');
  teste('webhook recebeu a empresa', recebido.empresa === 'Oficina Exemplo');
  teste('webhook recebeu o telefone com pais', recebido.whatsapp === '5511977776666',
    recebido.whatsapp);
  teste('webhook recebeu utm_campaign', recebido.utm_campaign === 'busca-maio');
  teste('webhook recebeu status', recebido.status === 'novo');
  teste('webhook recebeu data', !Number.isNaN(Date.parse(recebido.criado_em)));
  teste('token enviado no cabecalho',
    cabecalhos && cabecalhos.authorization === 'Bearer segredo-de-teste-123',
    cabecalhos ? cabecalhos.authorization : 'sem cabecalho');
  teste('content-type application/json',
    cabecalhos && cabecalhos['content-type'] === 'application/json');
  teste('segredo do webhook nao vai para o lead',
    recebido.segredo_do_webhook === undefined);
}

console.log('\n== webhook respondendo 500 ==');
recebido = null;
statusResposta = 500;
r = respostaFalsa();
await handler({ method: 'POST', body: { ...lead, nome: 'Lead Com Webhook Quebrado' } }, r);

teste('lead ainda e aceito quando o webhook falha', r.statusCode === 200,
  `veio ${r.statusCode}`);
teste('informa que salvou mesmo assim', r.corpo.salvo === true);
teste('marca que nao foi pelo webhook', r.corpo.via_webhook === false);
teste('leva a observacao do erro', !!r.corpo.observacao,
  r.corpo.observacao || 'vazio');
teste('whatsapp continua disponivel', !!r.corpo.whatsapp);

console.log('\n== webhook que nao existe ==');
recebido = null;
process.env.WEBHOOK_URL = 'http://127.0.0.1:1/nao-existe';
r = respostaFalsa();
await handler({ method: 'POST', body: { ...lead, nome: 'Lead Sem Destino' } }, r);
teste('lead ainda e aceito com webhook inalcancavel', r.statusCode === 200,
  `veio ${r.statusCode}`);
teste('informa que salvou no arquivo', r.corpo.salvo === true);
teste('leva observacao da falha de rede', !!r.corpo.observacao);

servidor.close();

const { writeFile } = await import('node:fs/promises');
await writeFile(ARQUIVO_WEBHOOK_TESTE, '', 'utf8');
console.log('\nlimpeza: arquivo de leads zerado.');

console.log(falhas === 0
  ? '\nTodos os testes de webhook passaram.'
  : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
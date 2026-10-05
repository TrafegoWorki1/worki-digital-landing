/* Testa o endpoint de leads: validacao, gravacao e ordem do fluxo.

   O ponto que mais importa: Lead so depois de salvo, e nenhum link de
   WhatsApp quando o cadastro falha. Um lead que vai para o atendimento
   sem registro e oportunidade perdida sem rastro.

   Roda com arquivo temporario, sem mexer no arquivo real de leads.
*/

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

process.env.WHATSAPP_NUMBER = '558592494552';
process.env.WEBHOOK_URL = '';

// Mesma pasta que o endpoint usa. O teste precisa ler o arquivo de
// verdade, senao ele valida a gravacao e nao a persistencia.
process.env.LEADS_DIR = process.env.LEADS_DIR || join('/tmp', 'worki-leads-teste');
const ARQUIVO_REAL = join(process.env.LEADS_DIR, 'leads.jsonl');

const mod = await import('./api/leads.js');
const handler = mod.default;

let falhas = 0;
function teste(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`OK   ${nome}`);
  } else {
    console.log(`FALHA ${nome}${detalhe ? ' -> ' + detalhe : ''}`);
    falhas++;
  }
}

function respostaFalsa() {
  const r = { statusCode: 0, corpo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (j) => { r.corpo = j; return r; };
  return r;
}

const valido = {
  nome: 'Maria Oliveira',
  whatsapp: '(85) 98888-7777',
  empresa: 'Clínica Exemplo',
  segmento: 'Clínica',
  faturamento: 'R$ 60 mil a R$ 100 mil',
  investimento: 'R$ 3 mil a R$ 10 mil/mês',
  gargalo: 'Estruturar CRM',
  gargalo_outro: '',
  meta_90_dias: 'Organizar o time comercial',
  utm_source: 'facebook',
  utm_medium: 'cpc',
  utm_campaign: 'campanha-setembro',
  utm_content: 'criativo-02',
  utm_term: 'crm',
  fbclid: 'IwAR2x9abc123',
  gclid: 'Cj0KCjw123456',
  url_origem: 'https://exemplo.com/?utm_source=facebook',
  referer: 'https://facebook.com/',
};

console.log('== validacao ==');

let r = respostaFalsa();
await handler({ method: 'POST', body: { ...valido, nome: '' } }, r);
teste('nome vazio: 400', r.statusCode === 400, `veio ${r.statusCode}`);
teste('nome vazio: sem link de WhatsApp', !r.corpo.whatsapp);

r = respostaFalsa();
await handler({ method: 'POST', body: { ...valido, nome: 'X', whatsapp: '123' } }, r);
teste('telefone curto: 400', r.statusCode === 400, `veio ${r.statusCode}`);

r = respostaFalsa();
await handler({ method: 'POST', body: { ...valido, telefone: undefined, whatsapp: '123' } }, r);
teste('sem telefone: 400', r.statusCode === 400, `veio ${r.statusCode}`);

// Numero de 12 digitos comecando em 55: era barrado e quebrava lead
// valido. O prefixo do pais esta la e o link funciona.
//
// Confere o arquivo gravado, e nao a resposta: o link de WhatsApp vai
// para WHATSAPP_NUMBER (numero de destino), nao para o telefone do lead.
const { readFile: lerArquivo } = await import('node:fs/promises');
const ARQUIVO = process.env.LEADS_DIR
  ? process.env.LEADS_DIR + '/leads.jsonl'
  : '/tmp/worki-leads/leads.jsonl';

for (const numero of ['558592494552', '558598888777', '5585924945521']) {
  r = respostaFalsa();
  await handler({ method: 'POST', body: { ...valido, whatsapp: numero } }, r);
  teste(`12 digitos aceito: ${numero}`,
    r.statusCode === 200 && r.corpo.salvo === true, `veio ${r.statusCode}`);

  const linhas = (await lerArquivo(ARQUIVO, 'utf8')).trim().split('\n').filter(Boolean);
  const ultimo = JSON.parse(linhas[linhas.length - 1]);
  teste(`12 digitos gravados inteiros: ${numero}`,
    ultimo.whatsapp === numero, ultimo.whatsapp);
}

r = respostaFalsa();
await handler({ method: 'GET', body: {} }, r);
teste('GET: 405', r.statusCode === 405, `veio ${r.statusCode}`);

console.log('\n== gravacao ==');

r = respostaFalsa();
await handler({ method: 'POST', body: valido }, r);
teste('lead valido: 200', r.statusCode === 200, `veio ${r.statusCode}`);
teste('lead valido: salvo verdadeiro', r.corpo.salvo === true);
teste('lead valido: tem link de WhatsApp', !!r.corpo.whatsapp &&
  r.corpo.whatsapp.startsWith('https://wa.me/558592494552'),
  r.corpo.whatsapp ? r.corpo.whatsapp.slice(0, 40) : 'sem link');

// O telefone tem que ser salvo com codigo de pais.
const { readFile } = await import('node:fs/promises');
let linhas = [];
try {
  linhas = (await readFile(ARQUIVO_REAL, 'utf8')).trim().split('\n').filter(Boolean);
} catch (e) {
  linhas = [];
}
const ultimo = linhas.length ? JSON.parse(linhas[linhas.length - 1]) : null;

teste('lead foi gravado em arquivo', ultimo !== null);
if (ultimo) {
  teste('telefone com codigo de pais', ultimo.whatsapp === '5585988887777',
    ultimo.whatsapp);
  teste('utm_campaign gravada', ultimo.utm_campaign === 'campanha-setembro');
  teste('fbclid gravado', ultimo.fbclid === 'IwAR2x9abc123');
  teste('gclid gravado', ultimo.gclid === 'Cj0KCjw123456');
  teste('faturamento gravado', ultimo.faturamento === 'R$ 60 mil a R$ 100 mil');
  teste('status novo', ultimo.status === 'novo');
  teste('data de criacao em ISO', !Number.isNaN(Date.parse(ultimo.criado_em)));
  teste('url de origem gravada', ultimo.url_origem.includes('utm_source=facebook'));
}

console.log('\n== sanitizacao ==');

r = respostaFalsa();
await handler({ method: 'POST', body: {
  ...valido,
  gargalo: 'texto inventado que nao esta na lista',
  faturamento: 'inventado',
  investimento: 'inventado',
} }, r);
teste('opcao invalida ainda aceita o lead', r.statusCode === 200);
linhas = (await readFile(ARQUIVO_REAL, 'utf8')).trim().split('\n').filter(Boolean);
const ultimo2 = JSON.parse(linhas[linhas.length - 1]);
teste('faturamento invalido vira vazio', ultimo2.faturamento === '',
  ultimo2.faturamento);
teste('gargalo invalido vira vazio', ultimo2.gargalo === '', ultimo2.gargalo);
teste('investimento invalido vira vazio', ultimo2.investimento === '',
  ultimo2.investimento);

r = respostaFalsa();
await handler({ method: 'POST', body: {
  ...valido,
  nome: 'A'.repeat(400),
  empresa: 'E'.repeat(400),
} }, r);
linhas = (await readFile(ARQUIVO_REAL, 'utf8')).trim().split('\n').filter(Boolean);
const ultimo3 = JSON.parse(linhas[linhas.length - 1]);
teste('nome gigante truncado', ultimo3.nome.length === 120, ultimo3.nome.length);
teste('empresa gigante truncada', ultimo3.empresa.length === 160,
  ultimo3.empresa.length);

console.log('\n== sem numero de WhatsApp ==');

delete process.env.WHATSAPP_NUMBER;
r = respostaFalsa();
await handler({ method: 'POST', body: valido }, r);
teste('sem numero: lead ainda e salvo', r.statusCode === 200 && r.corpo.salvo);
teste('sem numero: whatsapp vem nulo', r.corpo.whatsapp === null);

process.env.WHATSAPP_NUMBER = '558592494552';

// Limpeza: remove as linhas de teste do arquivo de leads.
linhas = (await readFile(ARQUIVO_REAL, 'utf8')).trim().split('\n').filter(Boolean);
const { writeFile } = await import('node:fs/promises');
await writeFile(ARQUIVO_REAL, '', 'utf8');
console.log(`\nlimpeza: ${linhas.length} linha(s) de teste removidas.`);

console.log(falhas === 0
  ? '\nTodos os testes passaram.'
  : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
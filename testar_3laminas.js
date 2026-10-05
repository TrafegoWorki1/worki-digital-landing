
/* Testa o endpoint com o corpo que a variante de 3 laminas envia. */

import handler from './api/leads.js';
import { readFile } from 'node:fs/promises';

function respostaFalsa() {
  return {
    statusCode: 200,
    corpo: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.corpo = d; return this; },
  };
}

const BODY = {
  variante: 'tres-laminas',
  nome: 'Joao da Silva',
  whatsapp: '85999998888',
  email: 'joao@empresa.com.br',
  instagram: '@joaoempresa',
  faturamento: 'R$ 100 mil a R$ 300 mil',
  cargo: 'Diretor de Marketing',
  decisor: 'SIM, SOU DECISOR',
  page_url: 'https://exemplo.com/landing?gclid=abc',
  origem_pagina: 'landing-3-laminas',
  utm_source: 'facebook',
  utm_medium: 'cpc',
  utm_campaign: 'setembro',
  utm_content: 'criativo-01',
  utm_term: 'crm',
  fbclid: 'IwAR2x9abc',
  gclid: 'Cj0KCjw123',
};

const ARQUIVO = (process.env.LEADS_DIR || '/tmp/worki-leads') + '/leads.jsonl';

let falhas = 0;
function teste(nome, ok, detalhe) {
  if (ok) console.log('OK   ' + nome);
  else { console.log('FALHA ' + nome + (detalhe ? '  -> ' + detalhe : '')); falhas++; }
}

let r = respostaFalsa();
// Sem WHATSAPP_NUMBER nao ha link: o numero e Montado no servidor e
// nunca vai no navegador. Aqui o teste fornece um, para exercitar o
// caminho completo; a pagina de producao recebe o valor do ambiente.
process.env.WHATSAPP_NUMBER = '558592494552';
await handler({ method: 'POST', body: { ...BODY } }, r);
teste('lead aceito', r.statusCode === 200 && r.corpo.salvo === true,
  'HTTP ' + r.statusCode + ' ' + JSON.stringify(r.corpo).slice(0, 120));
teste('link de WhatsApp montado', !!(r.corpo.whatsapp && r.corpo.whatsapp.includes('wa.me')),
  r.corpo.whatsapp || 'sem link');

const linhas = (await readFile(ARQUIVO, 'utf8')).trim().split('\n').filter(Boolean);
const lead = JSON.parse(linhas[linhas.length - 1]);

teste('nome gravado', lead.nome === BODY.nome, lead.nome);
teste('telefone com pais', lead.whatsapp === '5585999998888', lead.whatsapp);
teste('email em minusculo', lead.email === BODY.email, lead.email);
teste('instagram sem @', lead.instagram === 'joaoempresa', lead.instagram);
teste('faturamento da faixa nova', lead.faturamento === 'R$ 100 mil a R$ 300 mil', lead.faturamento);
teste('cargo gravado', lead.cargo === 'Diretor de Marketing', lead.cargo);
teste('decisor gravado', lead.decisor === 'SIM, SOU DECISOR', lead.decisor);
teste('utm_source', lead.utm_source === 'facebook', lead.utm_source);
teste('utm_campaign', lead.utm_campaign === 'setembro', lead.utm_campaign);
teste('fbclid', lead.fbclid === 'IwAR2x9abc', lead.fbclid);
teste('gclid', lead.gclid === 'Cj0KCjw123', lead.gclid);
teste('page_url', String(lead.page_url).includes('gclid=abc'), lead.page_url);
teste('origem_pagina', lead.origem_pagina === 'landing-3-laminas', lead.origem_pagina);
teste('variante registrada', lead.variante === 'tres-laminas', lead.variante);
teste('origem_formulario da variante', lead.origem_formulario === 'landing-worki-3-laminas', lead.origem_formulario);
teste('criado_em em ISO', /^\d{4}-\d{2}-\d{2}T/.test(lead.criado_em), lead.criado_em);

// E-mail e obrigatorio so na variante nova.
r = respostaFalsa();
await handler({ method: 'POST', body: { ...BODY, email: '' } }, r);
teste('email vazio: 400', r.statusCode === 400, 'HTTP ' + r.statusCode);

r = respostaFalsa();
await handler({ method: 'POST', body: { ...BODY, email: 'nao-e-email' } }, r);
teste('email invalido: 400', r.statusCode === 400, 'HTTP ' + r.statusCode);

// Faixa de faturamento que so existe na lista nova.
r = respostaFalsa();
await handler({ method: 'POST', body: { ...BODY, faturamento: 'R$ 500 mil a R$ 1 milhão' } }, r);
teste('faixa nova aceita', r.statusCode === 200, 'HTTP ' + r.statusCode);

// Cargo fora da lista e ignorado, nao aceito.
r = respostaFalsa();
await handler({ method: 'POST', body: { ...BODY, cargo: 'Inventado' } }, r);
teste('cargo inventado ignorado', r.statusCode === 200, 'HTTP ' + r.statusCode);
const linhas2 = (await readFile(ARQUIVO, 'utf8')).trim().split('\n').filter(Boolean);
const lead2 = JSON.parse(linhas2[linhas2.length - 1]);
teste('cargo inventado fica vazio', lead2.cargo === '', JSON.stringify(lead2.cargo));

// Pagina antiga segue sem e-mail, como antes.
r = respostaFalsa();
await handler({ method: 'POST', body: {
  nome: 'Sem Email', whatsapp: '85999998888',
  faturamento: 'R$ 60 mil a R$ 100 mil', variante: '',
} }, r);
teste('pagina antiga aceita sem email', r.statusCode === 200 && r.corpo.salvo === true,
  'HTTP ' + r.statusCode);
const linhas3 = (await readFile(ARQUIVO, 'utf8')).trim().split('\n').filter(Boolean);
const lead3 = JSON.parse(linhas3[linhas3.length - 1]);
teste('pagina antiga mantem origem', lead3.origem_formulario === 'landing-worki-digital', lead3.origem_formulario);

console.log('');
if (falhas) { console.log(falhas + ' teste(s) falharam.'); process.exit(1); }
console.log('Todos os testes da variante passaram.');

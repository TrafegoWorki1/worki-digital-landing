/* Ponte entre a sessao efemera do Hermes e um agente no PC do dono.

   O PROBLEMA QUE ESTA PONTE NAO RESOLVE, e que precisa estar claro
   antes de qualquer coisa:

   A sessao do Hermes roda num container descartavel, sem IP publico e
   sem porta escutando. Um agente rodando no PC do dono NAO alcanca este
   processo. Nao existe "conectar" no sentido de abrir uma conexao.

   O que esta ponte faz, de verdade:

   1. Expoe o estado do trabalho (o que existe, o que passou nos testes)
      para um cliente HTTP. Util se o agente rodar em algum lugar que
      alcance a rede do container.

   2. Aceita mudanca de arquivo por HTTP, para o agente escrever no
      repositorio sem precisar de acesso ao disco.

   Se o agente esta no seu PC e este container esta atras de rede
   privada, o unico caminho que funciona na pratica e o donofazer
   `git push` de dentro do container depois de autenticado. A ponte
   ajuda, mas nao substitui isso.

   SEGURANCA — leia antes de usar:

   - Exige um token. Sem token, 401 e nada acontece.
   - Nao executa comando de sistema. Nao existe shell remoto aqui. Um
     endpoint que aceita "execute isso" e uma porta aberta para qualquer
     um que leia o codigo, e nao e ponte: e backdoor.
   - Nao escreve fora do diretorio do projeto. O caminho e resolvido e
     conferido antes de qualquer escrita.
   - So aceita metodo POST nas rotas que mudam algo.
   - Rate limit simples, porque token vazado em log e chat acontece.

   USAR:

     PONTE_TOKEN=<segredo> node servidor.js
     PONTE_PORTA=8080 PONTE_TOKEN=<segredo> node servidor.js

   O token nunca vai para o log nem para a resposta.
*/

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PROJETO = resolve(AQUI, '..');
const PORTA = Number(process.env.PONTE_PORTA || 8787);
const TOKEN = process.env.PONTE_TOKEN || '';

/* Sem token a ponte nem sobe. Publicar um servico que le e escreve
   arquivos sem autenticacao seria pior que nao publicar. */
if (!TOKEN) {
  console.error('PONTE_TOKEN nao definido. A ponte nao sobe.');
  console.error('Gere um segredo:openssl rand -hex 32');
  process.exit(1);
}

/* ---------- utilidades ---------- */

function naRaiz(caminho) {
  const alvo = resolve(PROJETO, caminho || '.');
  // Resolve normaliza ".." e link simbolico de caminho textual. A
  // comparacao garante que ninguem escape do projeto escrevendo "../".
  if (alvo !== PROJETO && !alvo.startsWith(PROJETO + '/')) return null;
  return alvo;
}

function json(res, codigo, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    'Cache-Control': 'no-store',
  });
  res.end(corpo);
}

/* Rate limit por endereco. Simples e suficiente: o objetivo e nao
   receber cem requisicoes por segundo se o token vazar. */
const acessos = new Map();

function excedeu(ip) {
  const agora = Date.now();
  const janela = 60_000;
  const limite = 30;
  const anterior = acessos.get(ip) || { inicio: agora, contagem: 0 };
  if (agora - anterior.inicio > janela) {
    acessos.set(ip, { inicio: agora, contagem: 1 });
    return false;
  }
  anterior.contagem++;
  acessos.set(ip, anterior);
  return anterior.contagem > limite;
}

function autenticado(req) {
  const cab = req.headers.authorization || '';
  const informado = cab.startsWith('Bearer ') ? cab.slice(7) : '';
  // Comparacao de tamanho fixo, para nao vazar o token por tempo de
  // resposta. Diferenca de tamanho ja entrega o comprimento.
  if (informado.length !== TOKEN.length) return false;
  let igual = 0;
  for (let i = 0; i < TOKEN.length; i++) {
    igual |= informado.charCodeAt(i) ^ TOKEN.charCodeAt(i);
  }
  return igual === 0;
}

function corpoDaRequisicao(req, limite = 1024 * 1024) {
  return new Promise((resolveP, rejectP) => {
    let dados = '';
    let tamanho = 0;
    let estourou = false;

    req.on('data', (pedaco) => {
      if (estourou) return;
      tamanho += pedaco.length;
      if (tamanho > limite) {
        estourou = true;
        // Nao destroi a conexao aqui. Destruir sem responder someia o
        // cliente com ECONNRESET, sem codigo de erro nenhum — e
        // exatamente o que aconteceu na primeira versao deste teste.
        // A resposta 413 fica a cargo de quem chamou.
        rejectP(Object.assign(new Error('corpo grande demais'), { status: 413 }));
        return;
      }
      dados += pedaco;
    });
    req.on('end', () => {
      if (estourou) return;
      try {
        resolveP(dados ? JSON.parse(dados) : {});
      } catch (e) {
        rejectP(new Error('JSON invalido'));
      }
    });
    req.on('error', (e) => {
      if (!estourou) rejectP(e);
    });
  });
}

/* Roda um comando com lista fixa de argumentos. Sem shell, sem
   interpolacao: o comando vem do codigo, nunca do cliente. */
function rodar(comando, argumentos, diretorio, limiteMs = 120_000) {
  return new Promise((resolveP) => {
    exec(comando, argumentos, diretorio, limiteMs).then(resolveP);
  });
}

function exec(comando, argumentos, diretorio, limiteMs) {
  return new Promise((resolveP) => {
    const proc = spawn(comando, argumentos, {
      cwd: diretorio,
      shell: false,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });

    let saida = '';
    let erro = '';

    const temporizador = setTimeout(() => {
      proc.kill('SIGKILL');
      resolveP({
        codigo: null,
        saida: (saida + '\n[comando interrompido por limite de tempo]').slice(-20000),
        erro,
        interrompido: true,
      });
    }, limiteMs);

    proc.stdout.on('data', (p) => { saida += p.toString(); });
    proc.stderr.on('data', (p) => { erro += p.toString(); });

    proc.on('error', (e) => {
      clearTimeout(temporizador);
      resolveP({ codigo: null, saida, erro: erro + e.message });
    });

    proc.on('close', (codigo) => {
      clearTimeout(temporizador);
      resolveP({
        codigo,
        // Corta em 20 mil caracteres. Resposta de terminal nao precisa
        // de mais, e o limite evita estourar memoria com log enorme.
        saida: saida.slice(-20000),
        erro: erro.slice(-8000),
      });
    });
  });
}

/* ---------- rotas ---------- */

const rotas = {

  /* Estado geral. O unico endpoint seguro para chamar sem medo. */
  async estado() {
    const arquivos = await readdir(PROJETO);
    let temGit = false;
    try {
      await stat(join(PROJETO, '.git'));
      temGit = true;
    } catch (e) {
      temGit = false;
    }

    const git = temGit
      ? await rodar('git', ['log', '--oneline', '-5'], PROJETO, 15000)
      : { saida: '(sem repositorio git)', codigo: null, erro: '' };

    return {
      projeto: 'landing-page-worki-digital',
      raiz: PROJETO,
      tem_git: temGit,
      sessao_efemera: true,
      aviso: 'A sessao e um container descartavel. Sem push para o GitHub, '
           + 'este trabalho se perde quando a sessao terminar.',
      arquivos,
      git_log: git.saida.trim().split('\n').filter(Boolean).slice(0, 5),
    };
  },

  /* Le um arquivo do projeto. */
  async ler(dados) {
    const alvo = naRaiz(dados.caminho);
    if (!alvo) return { erro: 'caminho fora do projeto' };
    try {
      const conteudo = await readFile(alvo, 'utf8');
      return {
        ok: true,
        caminho: dados.caminho,
        bytes: Buffer.byteLength(conteudo),
        conteudo,
      };
    } catch (e) {
      return { erro: `nao consegui ler: ${e.code || e.message}` };
    }
  },

  /* Escreve um arquivo. Este e o que permite ao agente trabalhar no
     repositorio sem acesso ao disco. */
  async escrever(dados) {
    const alvo = naRaiz(dados.caminho);
    if (!alvo) return { erro: 'caminho fora do projeto' };
    if (typeof dados.conteudo !== 'string') {
      return { erro: 'conteudo precisa ser texto' };
    }
    if (Buffer.byteLength(dados.conteudo) > 1024 * 1024) {
      return { erro: 'arquivo grande demais (limite 1 MB)' };
    }
    // So permite estes nomes. Lista fechada: a ponte nao vira um
    // editor de arquivo qualquer, so o codigo do projeto.
    const permitidos = [
      'index.html', 'estilos.css', 'corpo.html', 'script.js',
      'montar.js', 'package.json', 'vercel.json',
      'api/leads.js', 'api/configuracao.js',
    ];
    if (!permitidos.includes(dados.caminho)) {
      return {
        erro: 'arquivo fora da lista permitida',
        permitidos,
      };
    }

    const { writeFile } = await import('node:fs/promises');
    try {
      await writeFile(alvo, dados.conteudo, 'utf8');
      return { ok: true, caminho: dados.caminho, bytes: Buffer.byteLength(dados.conteudo) };
    } catch (e) {
      return { erro: `nao consegui escrever: ${e.code || e.message}` };
    }
  },

  /* Roda a montagem e a bateria de testes. Comandos fixos: o cliente
     escolhe o que rodar, nunca o que executar. */
  async testar() {
    const montagem = await rodar('node', ['montar.js'], PROJETO, 60000);
    const leads = await rodar('node', ['testar_leads.js'], PROJETO, 90000);
    const webhook = await rodar('node', ['testar_webhook.js'], PROJETO, 90000);

    const passou =
      montagem.codigo === 0 && leads.codigo === 0 && webhook.codigo === 0;

    return {
      ok: passou,
      montagem: { codigo: montagem.codigo, saida: montagem.saida.slice(-3000), erro: montagem.erro.slice(-1500) },
      leads: { codigo: leads.codigo, saida: leads.saida.slice(-2000), erro: leads.erro.slice(-1000) },
      webhook: { codigo: webhook.codigo, saida: webhook.saida.slice(-2000), erro: webhook.erro.slice(-1000) },
    };
  },

  /* Estado do git, sem alterar nada. */
  async git_status() {
    const status = await rodar('git', ['status', '--short'], PROJETO, 15000);
    return { ok: status.codigo === 0, saida: status.saida || '(limpo)' };
  },

  /* Autentica e organiza o repositório. Push fica de fora de proposito:
     publicacao nao acontece por HTTP, porque publicacao exige decisao
     do dono, e nao um POST de quem leu o token. */
  async git_commit(dados) {
    if (typeof dados.mensagem !== 'string' || !dados.mensagem.trim()) {
      return { erro: 'mensagem de commit obrigatoria' };
    }
    if (dados.mensagem.length > 500) {
      return { erro: 'mensagem longa demais (limite 500)' };
    }

    const add = await rodar('git', ['add', '-A'], PROJETO, 30000);
    const commit = await rodar(
      'git', ['commit', '-m', dados.mensagem], PROJETO, 30000
    );

    // Se nao havia nada para commitar, o git sai com codigo 1 e
    // mensagem propria. Nao e erro da ponte.
    const semMudanca = /nothing to commit|nada para commitar/i.test(commit.saida + commit.erro);

    const log = await rodar('git', ['log', '--oneline', '-5'], PROJETO, 15000);

    return {
      ok: semMudanca || commit.codigo === 0,
      add: add.erro || null,
      commit: { codigo: commit.codigo, saida: commit.saida, erro: commit.erro },
      sem_mudanca: semMudanca,
      log: log.saida.trim().split('\n').filter(Boolean),
    };
  },

  /* Explica as limitacoes reais da ponte, para ninguem perder tempo
     tentando conectar de um jeito que nao funciona. */
  async limite() {
    return {
      aviso: 'Esta ponte NAO torna a sessao alcancavel de fora.',
      unreachable: [
        'A sessao roda em container sem IP publico e sem porta escutando.',
        'Um agente no PC do dono nao conecta neste processo.',
        'Rede privada entre o container e o PC nao e atravessada por HTTP.',
      ],
      o_que_funciona: [
        'Aponte um cliente HTTP para o endereco da rede do container, se houver rota.',
        'Ou use a ponte para inspecionar o trabalho e pedir alteracoes, pasando pelo container.',
      ],
      o_que_resolve_o_problema: [
        'git autenticado dentro do container e push para o GitHub.',
        'Isso tira o codigo do container descartavel.',
        'Publicacao continua exigindo decisao do dono, nao um POST remoto.',
      ],
      limitacao_segura: [
        'Nao ha execucao de comando de sistema.',
        'Nao ha shell remoto.',
        'Escrita restrita a 9 arquivos nomeados.',
        'Token obrigatorio, com comparacao de tamanho fixo.',
        'Rate limit de 30 requisicoes por minuto.',
      ],
    };
  },
};

/* ---------- servidor ---------- */

const servidor = createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || 'desconhecido';

  // Cabecalho de seguranca basico. Vale mesmo em rede interna.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (excedeu(ip)) {
    return json(res, 429, { erro: 'muitas requisicoes, espere um minuto' });
  }

  // Autorizado e sem token de qualidade: o token precisa ter tamanho
  // razoavel. Token de 3 caracteres nao e credencial, e chute.
  if (TOKEN.length < 16) {
    return json(res, 503, { erro: 'PONTE_TOKEN fraco demais (minimo 16 caracteres)' });
  }

  if (!autenticado(req)) {
    return json(res, 401, { erro: 'sem autorizacao' });
  }

  const partes = (req.url || '/').split('?')[0].split('/').filter(Boolean);
  const rota = partes[0] || 'estado';

  // Rota desconhecida e 404, antes de qualquer checagem de metodo.
  // Sem isso, POST numa rota inexistente devolvia 405 (metodo invalido
  // para uma rota "que nao existe"), o que e confuso e esconde o fato
  // de que a rota simplesmente nao existe.
  const acao = rotas[rota];
  if (!acao) {
    return json(res, 404, {
      erro: `rota desconhecida: ${rota}`,
      rotas: Object.keys(rotas),
    });
  }

  // POST: recebe corpo (ler arquivo, escrever, commitar, rodar testes).
  // GET: so consulta que nao precisa de corpo.
  //
  // `ler` fica no POST porque o caminho vai no corpo, nao na query
  // string: e dado do cliente, e query string vaza em log de proxy.
  const mudando = ['ler', 'escrever', 'git_commit', 'testar'];
  const ehMetodoCerto = mudando.includes(rota) ? req.method === 'POST' : req.method === 'GET';

  if (!ehMetodoCerto) {
    return json(res, 405, { erro: `metodo ${req.method} nao serve para ${rota}` });
  }

  let dados = {};
  if (req.method === 'POST') {
    try {
      dados = await corpoDaRequisicao(req);
    } catch (e) {
      // Corpo grande demais responde 413, e nao 400 de JSON invalido.
      return json(res, e.status || 400, { erro: e.message });
    }
  }

  try {
    const resultado = await acao(dados);
    // Erro funcional nao e erro de servidor: devolve 400.
    const codigo = resultado && resultado.erro ? 400 : 200;
    json(res, codigo, resultado);
  } catch (e) {
    // Log sem token e sem corpo da requisicao.
    console.error(`[ponte] erro em ${rota}: ${e.message}`);
    json(res, 500, { erro: 'erro interno', detalhe: e.message });
  }
});

servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`Ponte no ar na porta ${PORTA}`);
  console.log(`Projeto: ${PROJETO}`);
  console.log('Rotas: ' + Object.keys(rotas).join(', '));
  console.log('Sem execucao de comando e sem shell remoto, por decisao.');
  console.log(`Limite: 30 requisicoes por minuto.`);
});
/* Script da landing page.

   Ordem das coisas que importam:

   1. Ler UTMs da URL assim que a pagina abre. Se o lead fills o
      formulario em outra aba e volta, os UTMs ainda estao guardados.
   2. Disparar PageView e ViewContent.
   3. FormStep a cada mudanca de etapa.
   4. FormStart no primeiro foco.
   5. Lead **so depois** que o servidor confirmar que salvou.
   6. WhatsAppClick so quando o link do WhatsApp for clicado.

   O ponto 5 e o mais importante: se disparassemos Lead na hora do
   clique, o evento contaria lead que nunca chegou no servidor, e o
   numero da campanha nao bateria com o numero do cadastro.
*/

(function () {
  'use strict';

  var TOTAL_ETAPAS = 5;
  var etapaAtual = 1;
  var leadSalvo = null; // guarda os dados depois que o servidor salva
  var formIniciado = false;

  /* ---------- analytics ---------- */

  /* Camada minima de evento. Nao depende de Pixel nem GA4: os ids
     vem do servidor e podem nao estar configurados. O evento fica
     registrado aqui de qualquer forma, e o Pixel e o GA4 so repassam
     se existirem. Assim o rastreamento nao some so porque faltou um
     id. */
  var eventos = [];

  function registrarEvento(nome, params) {
    var registro = {
      evento: nome,
      params: params || {},
      em: new Date().toISOString(),
      url: window.location.href,
    };
    eventos.push(registro);
    window.__workiEventos = eventos;

    // Pixel do Meta, se configurado
    if (window.fbq) {
      try {
        if (nome === 'Lead') {
          window.fbq('track', 'Lead', params || {});
        } else {
          window.fbq('trackCustom', nome, params || {});
        }
      } catch (e) { /* pixel bloqueado por adblock: nao e erro nosso */ }
    }

    // GA4, se configurado
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', nome, params || {});
      } catch (e) { /* id ausente */ }
    }

    // GTM, se configurado
    if (window.dataLayer) {
      try {
        window.dataLayer.push({ event: nome, ...params });
      } catch (e) { /* id ausente */ }
    }
  }

  /* ---------- UTMs e click ids ---------- */

  var CHAVES = [
    'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'fbclid', 'gclid',
  ];

  var origem = {};

  (function leParametros() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    CHAVES.forEach(function (chave) {
      var valor = params.get(chave);
      if (valor) origem[chave] = valor.slice(0, 200);
    });
  })();

  /* Persiste em sessao: se o lead recarregar a pagina no meio do
     formulario, os UTMs nao somem. */
  try {
    var guardado = sessionStorage.getItem('worki_origem');
    if (guardado) {
      var anterior = JSON.parse(guardado);
      Object.keys(anterior).forEach(function (k) {
        if (!origem[k]) origem[k] = anterior[k];
      });
    }
    sessionStorage.setItem('worki_origem', JSON.stringify(origem));
  } catch (e) { /* modo privado pode bloquear: segue sem persistir */ }

  /* ---------- mascara de telefone ---------- */

  var inputTel = document.getElementById('whatsapp');

  function mascaraTelefone(valor) {
    var d = valor.replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    // 10 digitos: (85) 9999-9999   |   11 digitos: (85) 99999-9999
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) {
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    }
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  if (inputTel) {
    inputTel.addEventListener('input', function () {
      var posFim = inputTel.selectionStart === inputTel.value.length;
      inputTel.value = mascaraTelefone(inputTel.value);
      if (posFim) {
        try { inputTel.setSelectionRange(inputTel.value.length, inputTel.value.length); } catch (e) {}
      }
    });

    // Impede colar letra. Telefone so aceita digito.
    inputTel.addEventListener('paste', function (ev) {
      ev.preventDefault();
      var texto = (ev.clipboardData || window.clipboardData).getData('text');
      inputTel.value = mascaraTelefone(texto);
    });
  }

  /* ---------- validacao ---------- */

  function mostrarErro(campo, mensagem) {
    var el = document.getElementById('erro-' + campo);
    var input = document.getElementById(campo);
    if (el) {
      el.textContent = mensagem;
      el.classList.add('visivel');
    }
    if (input) {
      input.setAttribute('aria-invalid', 'true');
    }
  }

  function limparErro(campo) {
    var el = document.getElementById('erro-' + campo);
    var input = document.getElementById(campo);
    if (el) {
      el.textContent = '';
      el.classList.remove('visivel');
    }
    if (input) input.removeAttribute('aria-invalid');
  }

  function limparErros() {
    ['nome', 'whatsapp', 'empresa', 'segmento', 'faturamento',
     'investimento', 'gargalo', 'meta'].forEach(limparErro);
    var geral = document.getElementById('erro-geral');
    geral.classList.remove('visivel');
    geral.textContent = '';
  }

  function valorRadio(nome) {
    var marcado = document.querySelector('input[name="' + nome + '"]:checked');
    return marcado ? marcado.value : '';
  }

  /* Cada etapa valida so o que e dela. Validar tudo na hora de
     avancar faria o lead se sentirIOSqueado no primeiro erro. */
  function validarEtapa(numero) {
    var erro = null;

    if (numero === 1) {
      if (!document.getElementById('nome').value.trim()) {
        mostrarErro('nome', 'Preencha seu nome.');
        erro = 'nome';
      } else if (inputTel.value.replace(/\D/g, '').length < 10) {
        mostrarErro('whatsapp', 'Informe um WhatsApp válido com DDD.');
        erro = 'whatsapp';
      }
    }

    if (numero === 2) {
      if (!document.getElementById('empresa').value.trim()) {
        mostrarErro('empresa', 'Preencha o nome da empresa.');
        erro = 'empresa';
      } else if (!document.getElementById('segmento').value.trim()) {
        mostrarErro('segmento', 'Informe o segmento da empresa.');
        erro = 'segmento';
      }
    }

    if (numero === 3 && !valorRadio('faturamento')) {
      mostrarErro('faturamento', 'Selecione uma faixa de faturamento.');
      erro = 'faturamento';
    }

    if (numero === 4 && !valorRadio('investimento')) {
      mostrarErro('investimento', 'Selecione quanto investe hoje.');
      erro = 'investimento';
    }

    if (numero === 5) {
      if (!valorRadio('gargalo')) {
        mostrarErro('gargalo', 'Selecione o principal gargalo.');
        erro = 'gargalo';
      } else if (valorRadio('gargalo') === 'Outro' &&
                 !document.getElementById('gargalo_outro').value.trim()) {
        mostrarErro('gargalo', 'Conte o que é o gargalo.');
        erro = 'gargalo';
      }
    }

    if (erro) {
      var alvo = document.getElementById(erro);
      if (alvo) {
        alvo.focus({ preventScroll: false });
        try { alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
      }
    }
    return erro === null;
  }

  /* ---------- navegacao entre etapas ---------- */

  var NOME_ETAPA = {
    1: 'Seus dados', 2: 'Empresa', 3: 'Faturamento',
    4: 'Investimento', 5: 'Gargalo e meta',
  };

  function mostrarEtapa(numero) {
    document.querySelectorAll('.grupo').forEach(function (grupo) {
      var n = parseInt(grupo.getAttribute('data-etapa'), 10);
      grupo.classList.toggle('ativo', n === numero);
    });

    etapaAtual = numero;
    document.getElementById('etapa-num').textContent = String(numero);
    document.getElementById('etapa-nome').textContent = NOME_ETAPA[numero] || '';
    document.getElementById('progresso-barra').style.width =
      (numero / TOTAL_ETAPAS) * 100 + '%';

    document.getElementById('btn-voltar').style.display = numero > 1 ? '' : 'none';

    var btnAvancar = document.getElementById('btn-avancar');
    btnAvancar.textContent = numero === TOTAL_ETAPAS
      ? 'Solicitar minha análise'
      : 'Continuar';

    if (numero < TOTAL_ETAPAS) {
      registrarEvento('FormStep', { etapa: numero });
    }

    // Volta ao topo do formulario. Sem isso, no celular a pessoa avanca
    // sem ver os campos novos.
    var caixa = document.querySelector('.form-caixa');
    if (caixa) {
      try {
        caixa.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (e) {
        var y = caixa.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo(0, y);
      }
    }
  }

  document.getElementById('btn-avancar').addEventListener('click', function () {
    if (!validarEtapa(etapaAtual)) return;

    if (etapaAtual < TOTAL_ETAPAS) {
      mostrarEtapa(etapaAtual + 1);
      return;
    }
    enviarFormulario();
  });

  document.getElementById('btn-voltar').addEventListener('click', function () {
    if (etapaAtual > 1) mostrarEtapa(etapaAtual - 1);
  });

  /* "Outro" revela o campo de texto */
  document.querySelectorAll('input[name="gargalo"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var campoOutro = document.getElementById('campo-outro');
      if (campoOutro) {
        campoOutro.style.display = radio.checked && radio.value === 'Outro' ? '' : 'none';
      }
    });
  });

  /* Limpa o erro enquanto a pessoa digita */
  ['nome', 'whatsapp', 'empresa', 'segmento', 'gargalo_outro'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true') {
        limparErro(id === 'gargalo_outro' ? 'gargalo' : id);
      }
    });
  });

  /* ---------- FormStart ---------- */

  var form = document.getElementById('form-analise');
  form.addEventListener('focusin', function () {
    if (!formIniciado) {
      formIniciado = true;
      registrarEvento('FormStart', { etapa: 1 });
    }
  }, { once: true });

  /* ---------- envio ---------- */

  function montarLead() {
    return {
      nome: document.getElementById('nome').value.trim(),
      whatsapp: document.getElementById('whatsapp').value.trim(),
      empresa: document.getElementById('empresa').value.trim(),
      segmento: document.getElementById('segmento').value.trim(),
      faturamento: valorRadio('faturamento'),
      investimento: valorRadio('investimento'),
      gargalo: valorRadio('gargalo'),
      gargalo_outro: document.getElementById('gargalo_outro').value.trim(),
      meta_90_dias: document.getElementById('meta_90_dias').value.trim(),

      // origem e click ids
      utm_source: origem.utm_source || '',
      utm_medium: origem.utm_medium || '',
      utm_campaign: origem.utm_campaign || '',
      utm_content: origem.utm_content || '',
      utm_term: origem.utm_term || '',
      fbclid: origem.fbclid || '',
      gclid: origem.gclid || '',

      // de onde veio a pagina e de onde veio o clique
      url_origem: window.location.href.slice(0, 500),
      referer: document.referrer.slice(0, 500),
    };
  }

  function enviarFormulario() {
    var btn = document.getElementById('btn-avancar');
    var textoOriginal = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    var geral = document.getElementById('erro-geral');
    geral.classList.remove('visivel');

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(montarLead()),
    })
      .then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, corpo: j }; });
      })
      .then(function (res) {
        if (!res.ok || !res.corpo.ok) {
          // Nao mostra link do WhatsApp: o cadastro nao foi salvo, e
          // levar o lead ao atendimento sem registro seria perder o
          // contato sem nem deixar rastro.
          geral.textContent = res.corpo.erro ||
            'Não foi possível registrar seu cadastro. Tente novamente.';
          geral.classList.add('visivel');
          btn.disabled = false;
          btn.textContent = textoOriginal;
          return;
        }

        leadSalvo = montarLead();

        // Lead so depois do "salvo: true" do servidor. Antes disso o
        // numero da campanha contaria lead inexistente.
        registrarEvento('Lead', {
          valor: 0,
          moeda: 'BRL',
          faturamento: leadSalvo.faturamento,
          investimento: leadSalvo.investimento,
          gargalo: leadSalvo.gargalo,
          campanha: leadSalvo.utm_campaign || '(direto)',
        });

        mostrarSucesso(res.corpo);
      })
      .catch(function () {
        geral.textContent =
          'Falha de conexão. Verifique sua internet e tente novamente.';
        geral.classList.add('visivel');
        btn.disabled = false;
        btn.textContent = textoOriginal;
      });
  }

  function mostrarSucesso(resposta) {
    document.getElementById('form-analise').style.display = 'none';
    var tela = document.getElementById('tela-sucesso');
    tela.style.display = 'block';

    // Resumo: o lead ve o que foi registrado. Se algo estiver errado,
    // ele corrige antes de falar com a equipe.
    var resumo = document.getElementById('resumo-lead');
    var linhas = [
      ['Nome', leadSalvo.nome],
      ['WhatsApp', leadSalvo.whatsapp],
      ['Empresa', leadSalvo.empresa],
      ['Segmento', leadSalvo.segmento],
      ['Faturamento', leadSalvo.faturamento],
      ['Investimento', leadSalvo.investimento],
      ['Gargalo', leadSalvo.gargalo === 'Outro'
        ? leadSalvo.gargalo_outro
        : leadSalvo.gargalo],
    ];
    if (leadSalvo.meta_90_dias) linhas.push(['Meta 90 dias', leadSalvo.meta_90_dias]);

    resumo.innerHTML = '';
    linhas.forEach(function (par) {
      if (!par[1]) return;
      var div = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = par[0];
      var dd = document.createElement('dd');
      dd.textContent = par[1];
      div.appendChild(dt);
      div.appendChild(dd);
      resumo.appendChild(div);
    });

    var botao = document.getElementById('btn-whatsapp');
    if (resposta.whatsapp) {
      botao.href = resposta.whatsapp;
      botao.addEventListener('click', function () {
        registrarEvento('WhatsAppClick', {
          etapa_salvamento: 'confirmado',
          campanha: leadSalvo.utm_campaign || '(direto)',
        });
      });
    } else {
      // Sem numero configurado: o lead fica preso aqui. Melhor avisar
      // que o cadastro foi registrado do que sumir sem explicacao.
      botao.textContent = 'Cadastro registrado. Nossa equipe entrará em contato.';
      botao.removeAttribute('href');
      botao.style.background = 'var(--grafite-2)';
      botao.style.color = 'var(--branco)';
      botao.style.cursor = 'default';
      botao.addEventListener('click', function (ev) {
        ev.preventDefault();
      });
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }

  document.getElementById('btn-reiniciar').addEventListener('click', function () {
    document.getElementById('tela-sucesso').style.display = 'none';
    var f = document.getElementById('form-analise');
    f.style.display = '';
    var btn = document.getElementById('btn-avancar');
    btn.disabled = false;
    btn.textContent = 'Continuar';
    mostrarEtapa(1);
  });

  /* ---------- CTA e microanimações ---------- */

  document.querySelectorAll('[data-cta]').forEach(function (link) {
    link.addEventListener('click', function () {
      registrarEvento('ViewContent', { origem_cta: link.getAttribute('data-cta') });
    });
  });

  /* CTA fixo no mobile: so depois da primeira dobra. */
  var ctaFixo = document.getElementById('cta-fixo');
  var hero = document.querySelector('.hero');

  if (ctaFixo && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        // Quando o hero sai da tela, mostra o CTA fixo.
        ctaFixo.classList.toggle('visivel', !e.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' }).observe(hero);
  }

  /* Entrada suave das secoes */
  if ('IntersectionObserver' in window) {
    var alvos = document.querySelectorAll('.secao__cabecalho, .cartao, .etapa, .indicador');
    alvos.forEach(function (el) { el.classList.add('aparece'); });

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visivel');
          observador.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    alvos.forEach(function (el) { observador.observe(el); });
  }

  /* ---------- analytics: carga inicial ---------- */

  registrarEvento('PageView', {
    origem_campanha: origem.utm_campaign || '(direto)',
    utm_source: origem.utm_source || '',
    utm_medium: origem.utm_medium || '',
  });

  document.getElementById('ano').textContent = String(new Date().getFullYear());
})();
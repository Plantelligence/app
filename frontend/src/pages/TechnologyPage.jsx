import React from 'react';
import { Link } from 'react-router-dom';

const heroHighlights = [
  {
    label: '12 tipos',
    description: 'Cuidado personalizado para cada espécie.'
  },
  {
    label: '480 min',
    description: 'Sensores atentos 24h para manter tudo ideal.'
  },
  {
    label: '3 min',
    description: 'Problema detectado? Corrigimos quase na hora.'
  }
];

const differentiators = [
  {
    id: 'automacao',
    title: 'Automação centrada na planta',
    body: 'Plugues de controle geram receitas de clima, irrigação e nutrição com curva de aprendizado rápida. Modele cada cultura com sensores validados para estufas premium.'
  },
  {
    id: 'tecnologia',
    title: 'Arquitetura modular Plantelligence',
    body: 'Edge computing nas estufas, orquestração em nuvem e APIs abertas. Sincronize comandos, telemetria e manutenção preventiva em um único painel.'
  },
  {
    id: 'lgpd',
    title: 'Segurança e LGPD por design',
    body: 'Criptografia ponta a ponta, MFA obrigatório e log imutável garantem rastreabilidade do operador ao atuador. Consentimento granular sempre visível.'
  }
];

const solutionBlocks = [
  {
    title: 'Foco agronômico',
    points: [
      'Receitas digitais para tomate, morango, folhosas e flores premium.',
      'Rotinas automáticas ajustadas a fotoperíodo, umidade e pressão hídrica.',
      'Simulador climático mostra impacto antes de aplicar na estufa.'
    ]
  },
  {
    title: 'Orquestração inteligente',
    points: [
      'Sincronização de válvulas, nebulizadores, ventiladores e iluminação.',
      'Alertas multicanal e planos de contingência para cada cenário crítico.',
      'Dashboards em tempo real com visão de ROI por cultivo.'
    ]
  },
  {
    title: 'Confiança Plantelligence',
    points: [
      'Autenticação multifator e tokens rotativos monitoram acessos.',
      'Logs encadeados com hash e trilhas prontas para auditorias LGPD.',
      'Appliances seguros para conexão direta com CLPs e gateways industriais.'
    ]
  }
];

const partners = [
  'Estufas Premium',
  'Verticais Urbanas',
  'Hubs Logísticos',
  'Produtores Orgânicos',
  'Exportadores de Cultivo Especial',
  'Centros de Pesquisa e Desenvolvimento'
];

export const TechnologyPage = () => (
  <div className="flex flex-col gap-24">
    <section id="inicio" className="relative isolate overflow-hidden bg-gradient-to-b from-emerald-500/15 via-slate-950 to-slate-950 pt-24">
      <div className="absolute inset-0 -z-10 opacity-40 blur-3xl" aria-hidden>
        <div className="mx-auto h-full max-w-5xl bg-emerald-500/30" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-24 lg:flex-row lg:items-center">
        <div className="max-w-xl space-y-6">
          <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-widest text-emerald-200">
            Tecnologia Plantelligence
          </span>
          <h1 className="text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
            Plantelligence transforma estufas em operações previsíveis e eficientes.
          </h1>
          <p className="text-lg text-slate-300">
            Com telemetria contínua, orquestração precisa de atuadores e camadas robustas de segurança, nossa solução garante controle total do ambiente agrícola. Tudo pronto para demonstrar agora, com autenticação multifator (MFA) e rastreabilidade completa para atender às normas e à LGPD.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="rounded-md bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Entrar na demonstração
            </Link>
            <Link
              to="/register"
              className="rounded-md border border-emerald-400/60 px-5 py-3 text-center text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
            >
              Criar acesso piloto
            </Link>
          </div>
        </div>
        <div className="flex-1 rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-6 shadow-2xl shadow-emerald-500/20">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Resultados que você vê na prática
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {heroHighlights.map((item) => (
              <div key={item.label} className="rounded-md border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-3xl font-semibold text-emerald-400">{item.label}</p>
                <p className="mt-3 text-sm text-emerald-200">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section id="automacao" className="mx-auto w-full max-w-6xl px-6">
      <div className="grid gap-8 lg:grid-cols-3">
        {differentiators.map((item) => (
          <article
            key={item.title}
            id={item.id}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg transition hover:border-emerald-500/50 hover:shadow-emerald-500/10"
          >
            <h3 className="text-xl font-semibold text-slate-100">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-400">{item.body}</p>
          </article>
        ))}
      </div>
    </section>

    <section id="tecnologia" className="bg-slate-900/60 py-20">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-slate-50 sm:text-4xl">Plataforma completa para valorizar sua produção e vender mais</h2>
            <p className="text-base text-slate-300">
              Estruture a oferta da sua estufa com experiências personalizadas para cada cultura. Plantelligence entrega narrativa de vendas, dados técnicos e evidências de compliance para encantar investidores e compradores finais, tudo com foco em qualidade e previsibilidade.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {partners.map((partner) => (
                <div
                  key={partner}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-center text-sm text-slate-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-100"
                >
                  {partner}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-slate-950 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-emerald-200">Como entregamos valor</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <span>Playbooks de venda que conectam performance agronômica a indicadores financeiros.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <span>Visão 360º de sustentabilidade e rastreabilidade com certificações integradas.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                <span>Portal seguro para compradores acompanharem qualidade, safra e compliance em tempo real.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="lgpd" className="mx-auto w-full max-w-6xl px-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {solutionBlocks.map((block) => (
          <article key={block.title} className="rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-8 shadow-xl shadow-emerald-500/10">
            <h3 className="text-xl font-semibold text-emerald-300">{block.title}</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {block.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>

    <section className="mx-auto w-full max-w-6xl px-6 pb-24">
      <div className="flex flex-col gap-6 rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-10 text-center shadow-xl shadow-emerald-500/10">
        <h2 className="text-3xl font-semibold text-slate-50">Veja Plantelligence operando ao vivo</h2>
        <p className="text-base text-slate-300">
          Experimente uma estufa inteligente em funcionamento com acesso protegido por autenticação multifator (MFA). Explore painéis de telemetria em tempo real, fluxos de conformidade LGPD e simulações criptográficas de comando, tudo para mostrar como segurança e automação trabalham juntas.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="rounded-md bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            Entrar com MFA
          </Link>
          <Link
            to="/dashboard"
            className="rounded-md border border-emerald-400/60 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          >
            Ver painel (se já estiver logado)
          </Link>
        </div>
      </div>
    </section>
  </div>
);

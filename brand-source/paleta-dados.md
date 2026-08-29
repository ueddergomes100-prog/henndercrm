# Paleta de dados — Hennder CRM

Instância da marca do método `dataviz`. **Nenhum valor aqui foi escolhido no olho**:
a ordem dos slots saiu de uma enumeração das 5.040 permutações possíveis, e cada
número abaixo foi medido por `scripts/validate_palette.js`.

Superfícies de referência: claro `#ffffff`, escuro `#181227`.

## Categórica (identidade da série)

Ordem fixa, atribuída em sequência, **nunca ciclada**. A mesma ordem vale nos dois
modos — só os steps mudam, para que uma série não troque de cor quando o usuário
alterna o tema.

| Slot | Família | Claro | Escuro |
| --- | --- | --- | --- |
| 1 | violeta (marca) | `#7a35e8` | `#8a53ee` |
| 2 | laranja | `#eb6834` | `#d95926` |
| 3 | turquesa | `#1baf7a` | `#199e70` |
| 4 | amarelo | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | verde | `#008300` | `#0a9b0a` |
| 7 | azul | `#2a78d6` | `#3987e5` |
| 8 | vermelho | `#e34948` | `#e66767` |

Medições (ΔE em OKLab ×100):

| | Claro | Escuro |
| --- | --- | --- |
| Pior par adjacente sob daltonismo | 9,1 (alvo ≥ 8) | 8,4 |
| Pior par adjacente, visão normal | 19,6 (piso ≥ 15) | 19,3 |
| Contraste vs superfície | relief | todos ≥ 3:1 |

**A ordem é o mecanismo de segurança, não enfeite.** O roxo da marca ocupa o slot 1
por ser a cor da identidade; os outros sete foram ordenados para maximizar o pior
par adjacente. Trocar a ordem invalida as medições acima.

### Limite de séries em formas *all-pairs*

Dispersão, bolha, mapa e small-multiples deixam qualquer par encostar, então valem
apenas os **3 primeiros slots** (claro: ΔE 9,2 sob daltonismo, 27,6 em visão normal;
escuro: 9,4 / 26,5). O quarto slot derruba o par para 6,1. Com mais de três séries
nessas formas, agrupe o excedente em "Outros" ou facete — não estique a paleta.

### Regra de relief no modo claro

Três slots ficam abaixo de 3:1 sobre branco: turquesa (2,82), amarelo (2,17) e
magenta (2,69). Isso **obriga** rótulo direto visível ou visão de tabela onde eles
aparecem. Não é um aviso descartável.

Onde isso já está satisfeito hoje:

- *Evolução de recompra* — legenda com marcador + rótulo acima do gráfico
  (`ChartLegend`), obrigatória por ter duas séries.
- *Categorias recorrentes* — lista de rótulos com marcador abaixo da rosca.
- *Mix de atribuição* — tooltip com rótulo e o percentual impresso no centro.

Ao adicionar um gráfico novo que use esses três slots, o rótulo direto vem junto —
não é opcional.

## Sequencial (magnitude) — roxo da marca

Hue 293,6°. Faixa completa para encoding contínuo (heatmap, choropleth):

| Step | Hex | Step | Hex | Step | Hex |
| --- | --- | --- | --- | --- | --- |
| 100 | `#fab5ff` | 300 | `#c073ff` | 550 | `#7600f5` |
| 150 | `#eea7ff` | 350 | `#b160ff` | 600 | `#6700e0` |
| 200 | `#df97ff` | 400 | `#a34cff` | 650 | `#5a00cc` |
| 250 | `#d085ff` | 450 | `#9332ff` | 700 | `#4d00b7` |
| | | 500 | `#850aff` | | |

**Ordinal** (etapas de funil, faixas, tiers) usa o subconjunto
`200 · 300 · 400 · 500 · 600` — validado nos dois modos: lightness monotônica,
todos os saltos ΔL ≥ 0,06, e a ponta encostada na superfície acima de 2:1
(claro 2,10:1; escuro 2,30:1). A rampa completa **falha** o teste ordinal de
propósito: os steps são próximos demais. Isso é esperado, não é defeito.

## Divergente (polaridade)

**Roxo ↔ laranja** — frio contra quente, os dois primeiros slots da categórica.
Midpoint neutro cinza (claro `#f1eff6`, escuro `#2e2445`). Mesma quantidade de
passos por braço.

## Status (fixo — nunca tematizado)

Reservado. Nunca vira "série 4". Sempre acompanhado de ícone + rótulo.

| Papel | Hex | Contraste claro | Contraste escuro |
| --- | --- | --- | --- |
| good | `#0ca30c` | 3,35 | 5,42 |
| warning | `#fab219` | 1,83 | 9,91 |
| serious | `#ec835a` | 2,64 | 6,89 |
| critical | `#d03b3b` | 4,80 | 3,79 |

No claro, `warning` e `serious` ficam abaixo de 3:1 por construção — o par
ícone + rótulo é a mitigação, então a cor nunca carrega o significado sozinha.

## Tinta e cromo

| Papel | Claro | Contraste | Escuro | Contraste |
| --- | --- | --- | --- | --- |
| Ink primário | `#161122` | 18,46:1 | `#f5f0fe` | 16,26:1 |
| Ink secundário | `#4a4363` | 9,23:1 | `#c4bad8` | 9,84:1 |
| Ink mudo (eixo/rótulo) | `#6f6788` | 5,29:1 | `#9b8fb5` | 6,05:1 |

Todos passam AA para texto normal.

## Como regerar

Os scripts de derivação estão descritos no histórico do projeto; o essencial é:
enumerar as permutações com o slot 1 travado no roxo, exigir o piso de visão
normal (≥ 15) e que o trio inicial passe em `--pairs all`, e escolher a ordem que
maximiza o pior par adjacente sob daltonismo simulado. Rodar uma vez por modo,
contra a superfície real em que o gráfico é desenhado.

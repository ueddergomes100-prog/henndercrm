# Identidade visual — Hennder Company

Arquivos oficiais da marca e as cores derivadas deles. Esta pasta é a **fonte**;
o que a aplicação consome de verdade está em `public/brand/`.

## Cores da marca

Amostradas diretamente da arte oficial (`Hennder Roxo.jpeg`), não estimadas:

| Papel | Hex | Onde aparece na logo |
| --- | --- | --- |
| Roxo principal | `#7a35e8` | "DER", metade direita do símbolo |
| Grafite | `#252935` | "HENN", metade esquerda do símbolo |

A escala completa usada na UI está em `src/app/globals.css`, nas variáveis
`--brand-purple-*` (50 a 900) e `--brand-ink-*` (600 a 950). O `500` da escala
roxa é exatamente o `#7a35e8` da logo; o resto foi construído em volta dele.

## Arquivos fonte (esta pasta)

| Arquivo | Conteúdo |
| --- | --- |
| `hennder-company-simbolo.svg` | Só o símbolo (H/N cruzados) |
| `hennder-company-tema-light.svg` | Lockup horizontal, texto grafite — para fundo claro |
| `hennder-company-tema-dark.svg` | Lockup horizontal, texto branco — para fundo escuro |
| `hennder-company-icone.svg` | Ícone de app (quadrado arredondado) |

Atenção: apesar da extensão `.svg`, **não são vetores**. Cada arquivo é um PNG em
base64 embutido, com um segundo PNG servindo de máscara de transparência via
`feColorMatrix`. Por isso pesam 300–750 KB e não podem ser recoloridos por CSS.

## Assets usados pela aplicação (`public/brand/`)

Gerados a partir dos fontes acima: máscara aplicada, recorte justo e
redimensionamento. São PNGs com transparência real.

| Arquivo | Uso |
| --- | --- |
| `hennder-lockup-light.png` | Lockup branco + roxo — fundo escuro (tela de login) |
| `hennder-lockup.png` | Lockup grafite + roxo — fundo claro |
| `hennder-symbol-light.png` | Símbolo branco + roxo — fundo escuro (badge do menu lateral) |
| `hennder-symbol.png` | Símbolo grafite + roxo — fundo claro |

Para regerar depois de trocar a arte oficial, o caminho é: extrair os dois PNGs
embutidos do `.svg`, compor RGB do primeiro com a luminância do segundo como
alfa, recortar na bounding box e exportar. A variante clara sai da escura
mapeando os pixels de baixa saturação para branco e preservando os cromáticos.

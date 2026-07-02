from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from build_hennder_crm_pdf import (
    AMBER,
    ASSETS_DIR,
    BLUE,
    CYAN,
    DARK,
    INK,
    LIGHT_BORDER,
    MUTED,
    NAVY,
    ORANGE,
    PALE_BLUE,
    PALE_CYAN,
    PALE_GREEN,
    PALE_ORANGE,
    PALE_PURPLE,
    PURPLE,
    SLATE,
    TEAL,
    WHITE,
    create_commercial_journey,
    create_cover,
    create_dashboard_preview,
    create_integration_flow,
    hex_tuple,
    pil_font,
)


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
RENDER_DIR = DOCS_DIR / "rendered"
OUTPUT_PDF = DOCS_DIR / "Hennder_CRM_Apresentacao_Funcionalidades.pdf"
PAGE_WIDTH = 2550
PAGE_HEIGHT = 3300
MARGIN = 210
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), candidate, font=font)
        if box[2] - box[0] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 10,
    max_lines: int | None = None,
) -> int:
    lines = wrap_text(draw, text, font, max_width)
    if max_lines:
        lines = lines[:max_lines]
    x, y = xy
    line_height = font.size + line_gap
    for line in lines:
        draw.text((x, y), line, font=font, fill=f"#{fill}")
        y += line_height
    return y


def rounded(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: str,
    radius: int = 34,
    outline: str | None = None,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(
        box,
        radius=radius,
        fill=f"#{fill}",
        outline=f"#{outline}" if outline else None,
        width=width,
    )


def new_page() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), f"#{WHITE}")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((-550, -700, 850, 700), fill=(*hex_tuple(PALE_BLUE), 170))
    draw.ellipse((2050, 2670, 2870, 3490), fill=(*hex_tuple(PALE_CYAN), 170))
    return image, draw


def draw_header(
    draw: ImageDraw.ImageDraw,
    page_number: int,
    section_number: str,
    kicker: str,
    title: str,
    subtitle: str,
    accent: str,
) -> int:
    draw.text(
        (MARGIN, 78),
        "HENNDER CRM",
        font=pil_font(28, True),
        fill=f"#{BLUE}",
    )
    draw.text(
        (MARGIN + 235, 82),
        "INTELIGÊNCIA COMERCIAL E RECOMPRA",
        font=pil_font(23, True),
        fill=f"#{MUTED}",
    )
    rounded(draw, (MARGIN, 165, PAGE_WIDTH - MARGIN, 620), accent, 44)
    draw.text(
        (MARGIN + 72, 218),
        f"{section_number}  {kicker.upper()}",
        font=pil_font(27, True),
        fill="#D9F8FF",
    )
    draw_wrapped(
        draw,
        (MARGIN + 72, 285),
        title,
        pil_font(62, True),
        WHITE,
        CONTENT_WIDTH - 144,
        line_gap=12,
        max_lines=2,
    )
    draw_wrapped(
        draw,
        (MARGIN + 72, 500),
        subtitle,
        pil_font(29),
        "EAF8FF",
        CONTENT_WIDTH - 144,
        line_gap=8,
        max_lines=2,
    )
    draw.line(
        (MARGIN, PAGE_HEIGHT - 105, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 105),
        fill=f"#{LIGHT_BORDER}",
        width=3,
    )
    draw.text(
        (MARGIN, PAGE_HEIGHT - 78),
        "APRESENTAÇÃO FUNCIONAL  •  JUNHO DE 2026",
        font=pil_font(21, True),
        fill=f"#{MUTED}",
    )
    draw.text(
        (PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 78),
        str(page_number),
        font=pil_font(23, True),
        fill=f"#{BLUE}",
        anchor="ra",
    )
    return 680


def draw_lead(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    accent: str,
    height: int = 200,
) -> int:
    rounded(draw, (MARGIN, y, PAGE_WIDTH - MARGIN, y + height), "F8FBFF", 28, LIGHT_BORDER, 3)
    draw.rounded_rectangle(
        (MARGIN, y, MARGIN + 22, y + height),
        radius=11,
        fill=f"#{accent}",
    )
    draw_wrapped(
        draw,
        (MARGIN + 62, y + 45),
        text,
        pil_font(34, True),
        INK,
        CONTENT_WIDTH - 110,
        line_gap=13,
        max_lines=3,
    )
    return y + height + 35


def draw_metric_strip(
    draw: ImageDraw.ImageDraw,
    y: int,
    items: list[tuple[str, str, str]],
    height: int = 250,
) -> int:
    gap = 18
    width = int((CONTENT_WIDTH - gap * (len(items) - 1)) / len(items))
    for index, (value, label, color) in enumerate(items):
        x = MARGIN + index * (width + gap)
        rounded(draw, (x, y, x + width, y + height), color, 30)
        draw.text(
            (x + width / 2, y + 80),
            value,
            font=pil_font(37, True),
            fill=f"#{WHITE}",
            anchor="mm",
        )
        draw_wrapped(
            draw,
            (x + 28, y + 145),
            label,
            pil_font(23, True),
            WHITE,
            width - 56,
            line_gap=6,
            max_lines=2,
        )
    return y + height + 35


def draw_feature_grid(
    draw: ImageDraw.ImageDraw,
    y: int,
    features: list[tuple[str, str]],
    accent: str,
    *,
    columns: int = 2,
    card_height: int = 285,
    gap: int = 22,
) -> int:
    card_width = int((CONTENT_WIDTH - gap * (columns - 1)) / columns)
    rows = (len(features) + columns - 1) // columns
    for index, (title, detail) in enumerate(features):
        row = index // columns
        column = index % columns
        x = MARGIN + column * (card_width + gap)
        top = y + row * (card_height + gap)
        rounded(
            draw,
            (x, top, x + card_width, top + card_height),
            WHITE,
            30,
            LIGHT_BORDER,
            3,
        )
        draw.rounded_rectangle(
            (x, top, x + 18, top + card_height),
            radius=9,
            fill=f"#{accent}",
        )
        draw_wrapped(
            draw,
            (x + 50, top + 36),
            title,
            pil_font(29, True),
            accent,
            card_width - 90,
            line_gap=7,
            max_lines=2,
        )
        draw_wrapped(
            draw,
            (x + 50, top + 105),
            detail,
            pil_font(25),
            SLATE,
            card_width - 90,
            line_gap=9,
            max_lines=5,
        )
    return y + rows * card_height + (rows - 1) * gap + 35


def draw_note(
    draw: ImageDraw.ImageDraw,
    y: int,
    title: str,
    body: str,
    fill: str,
    accent: str,
    height: int = 215,
) -> int:
    rounded(draw, (MARGIN, y, PAGE_WIDTH - MARGIN, y + height), fill, 30, accent, 4)
    draw.text(
        (MARGIN + 50, y + 34),
        title,
        font=pil_font(28, True),
        fill=f"#{accent}",
    )
    draw_wrapped(
        draw,
        (MARGIN + 50, y + 88),
        body,
        pil_font(25),
        INK,
        CONTENT_WIDTH - 100,
        line_gap=9,
        max_lines=4,
    )
    return y + height + 30


def paste_centered(
    image: Image.Image,
    asset_path: Path,
    y: int,
    target_width: int = CONTENT_WIDTH,
) -> int:
    asset = Image.open(asset_path).convert("RGB")
    ratio = target_width / asset.width
    target_height = int(asset.height * ratio)
    asset = asset.resize((target_width, target_height), Image.Resampling.LANCZOS)
    image.paste(asset, (MARGIN, y))
    return y + target_height + 35


def build_pages() -> list[Image.Image]:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    cover_path = create_cover()
    flow_path = create_integration_flow()
    dashboard_path = create_dashboard_preview()
    journey_path = create_commercial_journey()

    pages = [Image.open(cover_path).convert("RGB")]

    image, draw = new_page()
    y = draw_header(
        draw,
        2,
        "01",
        "Visão do produto",
        "Um CRM criado para transformar dados em ação comercial",
        "A equipe sabe quem priorizar, por que entrar em contato e qual é o próximo passo.",
        BLUE,
    )
    y = draw_lead(
        draw,
        y,
        "O Hennder CRM organiza o relacionamento com clientes e usa o histórico comercial "
        "para revelar risco, potencial de recompra e oportunidades de venda.",
        CYAN,
    )
    y = draw_metric_strip(
        draw,
        y,
        [
            ("RECUPERAR", "clientes sem compra", ORANGE),
            ("ANTECIPAR", "o momento da recompra", CYAN),
            ("CRESCER", "com venda cruzada", PURPLE),
            ("ORGANIZAR", "a rotina da equipe", TEAL),
        ],
    )
    draw.text(
        (MARGIN, y),
        "Integração independente do ERP",
        font=pil_font(39, True),
        fill=f"#{NAVY}",
    )
    y = draw_wrapped(
        draw,
        (MARGIN, y + 62),
        "A plataforma trabalha com uma camada de conexão adaptável. Cada implantação pode "
        "receber dados por consulta somente leitura, API, arquivos ou sincronização agendada, "
        "conforme a estrutura e as permissões do ERP utilizado pelo cliente.",
        pil_font(27),
        INK,
        CONTENT_WIDTH,
        line_gap=10,
        max_lines=4,
    ) + 25
    y = paste_centered(image, flow_path, y)
    draw_note(
        draw,
        y,
        "Base comum de dados",
        "Clientes, produtos, vendas, itens vendidos, vendedores, datas, valores, filiais e "
        "status comerciais ativam os indicadores do CRM.",
        PALE_BLUE,
        BLUE,
        190,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        3,
        "02",
        "Gestão executiva",
        "Dashboard comercial inteligente",
        "Os principais sinais da operação aparecem de forma visual, objetiva e priorizada.",
        PURPLE,
    )
    y = draw_lead(
        draw,
        y,
        "Uma leitura rápida da carteira, da recorrência e das oportunidades ajuda gestores e "
        "vendedores a começarem o dia pelo que realmente merece atenção.",
        PURPLE,
    )
    y = paste_centered(image, dashboard_path, y)
    draw_feature_grid(
        draw,
        y,
        [
            ("KPIs comerciais", "Indicadores de clientes, recompra, receita, risco e potencial recuperável."),
            ("Gráficos de evolução", "Acompanhamento visual da recorrência e do desempenho por categoria."),
            ("Ranking de prioridades", "Clientes e vendedores ordenados pelos sinais mais relevantes."),
            ("Prévia de inatividade", "Resumo dos clientes sem compra e acesso direto à recuperação."),
        ],
        PURPLE,
        card_height=270,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        4,
        "03",
        "Conhecimento do cliente",
        "Carteira segmentada e Perfil 360°",
        "Cada cliente é visto pelo cadastro, comportamento de compra, relacionamento e potencial.",
        BLUE,
    )
    y = draw_feature_grid(
        draw,
        y,
        [
            ("Consulta de clientes", "Busca por nome ou cidade e filtros por vendedor, status e qualidade cadastral."),
            ("Perfil 360°", "Dados cadastrais, compras, itens, alertas, oportunidades e histórico de contatos."),
            ("Indicadores individuais", "Ticket médio, frequência, dias sem compra, score e potencial perdido."),
            ("Vendedor preferencial", "Profissional com maior relacionamento no histórico de compras."),
            ("Qualidade cadastral", "Pontuação de WhatsApp, telefone, e-mail, documentos, endereço e localização."),
            ("Status de inatividade", "Classificação entre ativo, atenção, risco e perdido."),
        ],
        BLUE,
        card_height=275,
    )
    y = draw_metric_strip(
        draw,
        y,
        [
            ("CADASTRO", "qualidade mensurável", BLUE),
            ("HISTÓRICO", "compras e contatos", CYAN),
            ("AFINIDADE", "vendedor recomendado", PURPLE),
            ("POTENCIAL", "valor a recuperar", ORANGE),
        ],
        height=225,
    )
    draw_note(
        draw,
        y,
        "Saúde da base",
        "O módulo destaca cadastros incompletos, calcula o score médio e mostra os registros "
        "que precisam de correção para melhorar a capacidade de contato.",
        PALE_PURPLE,
        PURPLE,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        5,
        "04",
        "Recorrência e relacionamento",
        "Recuperação de clientes e alertas de recompra",
        "Ausência de compra e ciclos de consumo são transformados em filas de ação.",
        ORANGE,
    )
    y = draw_feature_grid(
        draw,
        y,
        [
            ("Central de Recuperação", "Clientes sem compra ordenados por urgência, inatividade e potencial."),
            ("Registro de retorno", "Resultado, observação, canal, responsável e próxima data de contato."),
            ("Histórico de contatos", "Tentativas registradas permanecem disponíveis para continuidade."),
            ("Alertas de recompra", "Previsões por produto, departamento, palavra-chave e histórico individual."),
            ("Priorização", "Filtros de hoje, próximos dias, atrasados e nível de prioridade."),
            ("Atribuição de conversão", "O contato fica registrado; a conversão ideal é confirmada pela venda real importada."),
        ],
        ORANGE,
        card_height=275,
    )
    y = draw_note(
        draw,
        y,
        "Regra essencial de recuperação",
        "Uma tentativa de contato não elimina o alerta. A oportunidade permanece ativa até "
        "existir uma nova compra ou uma decisão comercial registrada.",
        PALE_ORANGE,
        ORANGE,
    )
    draw_note(
        draw,
        y,
        "WhatsApp com contexto",
        "Atalhos abrem a conversa com número normalizado e mensagem relacionada ao cliente, "
        "produto ou oportunidade. A automação oficial pode ser adicionada conforme a operação.",
        PALE_GREEN,
        TEAL,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        6,
        "05",
        "Prova de resultado",
        "Conversão automática baseada em venda real",
        "O CRM não depende apenas do vendedor marcar um alerta como convertido.",
        BLUE,
    )
    y = draw_lead(
        draw,
        y,
        "O fluxo correto é registrar o contato comercial e deixar o sistema identificar, nas próximas vendas "
        "importadas, se o cliente comprou dentro da janela de atribuição configurada.",
        BLUE,
    )
    y = draw_feature_grid(
        draw,
        y,
        [
            ("1. Alerta gerado", "O sistema identifica cliente, produto, vendedor, data prevista e prioridade de recompra."),
            ("2. Contato registrado", "O vendedor marca como contatado, informa canal, observação e próxima ação."),
            ("3. Venda importada", "Na sincronização ou importação mensal, novas vendas entram com cliente, produto, data e valor."),
            ("4. Conversão direta", "Mesmo cliente, mesmo produto ou categoria equivalente, dentro da janela após o contato."),
            ("5. Venda influenciada", "Mesmo cliente compra qualquer produto no período; resultado entra como influência comercial."),
            ("6. Resultado executivo", "Faturamento recuperado, alertas convertidos, ROI e performance por vendedor são calculados."),
        ],
        BLUE,
        card_height=250,
    )
    y = draw_metric_strip(
        draw,
        y,
        [
            ("CONTATO", "ação do vendedor", TEAL),
            ("JANELA", "7 a 15 dias configuráveis", CYAN),
            ("VENDA", "prova pelo ERP", ORANGE),
            ("ROI", "resultado mensurável", PURPLE),
        ],
        height=215,
    )
    draw_note(
        draw,
        y,
        "Regra recomendada",
        "Conversão direta: cliente + produto do alerta dentro de 7 dias após o contato. "
        "Conversão influenciada: cliente compra qualquer item em até 7 ou 15 dias. "
        "A marcação manual pode existir apenas como exceção administrativa.",
        PALE_BLUE,
        BLUE,
        220,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        7,
        "06",
        "Execução comercial",
        "Carteira, oportunidades e agenda em um só fluxo",
        "A equipe recebe contexto para vender e ferramentas para organizar a próxima ação.",
        TEAL,
    )
    y = draw_feature_grid(
        draw,
        y,
        [
            ("Carteira do vendedor", "Clientes preferenciais, risco, alertas, potencial e conversão."),
            ("Oportunidades", "Venda cruzada com cliente, produto de origem, sugestão e confiança."),
            ("Gestão de oportunidades", "Criação, edição, responsável, status e exclusão."),
            ("Agenda semanal", "Ligações, visitas, retornos e recompras previstas."),
            ("Compromissos", "Criação, edição e exclusão de eventos com controle por vendedor."),
            ("Acesso por perfil", "Administrador e supervisor veem a operação; vendedor atua na carteira."),
        ],
        TEAL,
        card_height=275,
    )
    y = draw_metric_strip(
        draw,
        y,
        [
            ("FOCO", "prioridade por vendedor", TEAL),
            ("CONTEXTO", "abordagem personalizada", BLUE),
            ("CADÊNCIA", "agenda de retornos", CYAN),
            ("CONTROLE", "status e responsável", PURPLE),
        ],
        height=225,
    )
    draw_note(
        draw,
        y,
        "Continuidade da operação",
        "Contatos, status de alertas, oportunidades e agenda ficam persistidos, evitando que "
        "a rotina dependa de planilhas e anotações dispersas.",
        PALE_GREEN,
        TEAL,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        8,
        "07",
        "Inteligência e gestão",
        "Análises, relatórios, segurança e experiência",
        "Recursos de apoio ajudam a interpretar a base, acompanhar resultados e governar o acesso.",
        CYAN,
    )
    y = draw_feature_grid(
        draw,
        y,
        [
            ("IA Comercial", "Perguntas e respostas orientadas pelos dados atuais do CRM."),
            ("Análises disponíveis", "Risco, potencial, vendedores, produtos, cadastro e prioridades."),
            ("Relatórios", "Perda, recuperação, recorrência e faturamento recuperado."),
            ("Perfis de acesso", "Experiências separadas para administrador, supervisor e vendedor."),
            ("Sessão protegida", "Cookie HTTP-only e escopo de dados conforme o perfil."),
            ("Temas visuais", "Modo claro e dark profundo com preferência salva."),
            ("Persistência operacional", "Informações da rotina mantidas no banco remoto."),
            ("Evolução preparada", "Arquitetura pronta para incorporar novos modelos e análises."),
        ],
        CYAN,
        card_height=245,
    )
    y = draw_note(
        draw,
        y,
        "Evolução planejada da inteligência",
        "O módulo atual trabalha com regras e dados disponíveis no CRM. Modelos externos podem "
        "ser incorporados quando dados, governança e objetivos estiverem maduros.",
        PALE_CYAN,
        CYAN,
        205,
    )
    draw_metric_strip(
        draw,
        y,
        [
            ("CLARO", "leitura leve", BLUE),
            ("DARK", "contraste profundo", DARK),
            ("PERFIS", "acesso controlado", PURPLE),
            ("DADOS", "rotina persistente", TEAL),
        ],
        height=210,
    )
    pages.append(image)

    image, draw = new_page()
    y = draw_header(
        draw,
        9,
        "08",
        "Jornada completa",
        "Da leitura dos dados à ação e ao resultado",
        "Gestão, relacionamento e execução conectados em uma rotina comercial contínua.",
        NAVY,
    )
    y = paste_centered(image, journey_path, y, CONTENT_WIDTH)
    y = draw_feature_grid(
        draw,
        y,
        [
            ("Dashboard", "Visão geral e prioridades."),
            ("Clientes e Perfil 360°", "Contexto completo para relacionamento."),
            ("Recuperação e Recompra", "Ações para trazer clientes de volta."),
            ("Carteira e Oportunidades", "Foco comercial por vendedor."),
            ("Agenda", "Organização da cadência de contatos."),
            ("IA e Relatórios", "Interpretação e acompanhamento."),
        ],
        NAVY,
        card_height=205,
    )
    y = draw_note(
        draw,
        y,
        "Compatível com o ecossistema do cliente",
        "A integração é desenhada sobre os dados disponíveis e as regras do negócio, permitindo "
        "que o Hennder CRM trabalhe com diferentes ERPs e cenários de implantação.",
        PALE_BLUE,
        BLUE,
        190,
    )
    draw.text(
        (PAGE_WIDTH / 2, y + 55),
        "Mais relacionamento. Mais recorrência. Mais venda com contexto.",
        font=pil_font(38, True),
        fill=f"#{NAVY}",
        anchor="mm",
    )
    draw.text(
        (PAGE_WIDTH / 2, y + 120),
        "HENNDER CRM  •  INTELIGÊNCIA COMERCIAL E RECOMPRA",
        font=pil_font(23, True),
        fill=f"#{CYAN}",
        anchor="mm",
    )
    pages.append(image)

    return pages


def build_pdf() -> Path:
    pages = build_pages()
    for index, page in enumerate(pages, start=1):
        page.save(RENDER_DIR / f"page-{index}.png", quality=96)
    pages[0].save(
        OUTPUT_PDF,
        "PDF",
        resolution=300,
        save_all=True,
        append_images=pages[1:],
        quality=95,
    )
    return OUTPUT_PDF


if __name__ == "__main__":
    print(build_pdf())

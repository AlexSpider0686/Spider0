# -*- coding: utf-8 -*-
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import MSO_AUTO_SIZE, MSO_VERTICAL_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "presentation_assets"
SCREENSHOTS = ASSETS / "screenshots"
RENDERED = ASSETS / "rendered"
TMP = ROOT / "tmp_presentation"
OUT = ROOT / "presentations" / "ProjectCore_Agent_Shell_Presentation_Musk_Style_v6.pptx"

SW = 13.333
SH = 7.5

BG = RGBColor(6, 12, 20)
PANEL = RGBColor(17, 29, 45)
PANEL_SOFT = RGBColor(22, 37, 57)
WHITE = RGBColor(248, 250, 252)
TEXT = RGBColor(230, 237, 245)
MUTED = RGBColor(168, 182, 201)
LINE = RGBColor(52, 72, 98)
CYAN = RGBColor(88, 214, 245)
BLUE = RGBColor(75, 135, 255)
GREEN = RGBColor(114, 226, 177)
ORANGE = RGBColor(255, 155, 92)
DARK = RGBColor(12, 22, 35)
LIGHT_SURFACE = RGBColor(242, 246, 250)


def rgb(r, g, b):
    return RGBColor(r, g, b)


def set_font(run, size, bold=False, color=WHITE, name="Arial"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def add_shape(
    slide,
    x,
    y,
    w,
    h,
    color,
    transparency=0.0,
    rounded=False,
    line=None,
    line_width=1.0,
    line_transparency=0.0,
):
    shape_type = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if rounded else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.fill.transparency = transparency
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.transparency = line_transparency
        shape.line.width = Pt(line_width)
    return shape


def add_bg(slide, image_path=None, overlay=0.0):
    if image_path and Path(image_path).exists():
        slide.shapes.add_picture(str(image_path), 0, 0, width=Inches(SW), height=Inches(SH))
    else:
        add_shape(slide, 0, 0, SW, SH, BG)
    if overlay:
        add_shape(slide, 0, 0, SW, SH, BG, transparency=overlay)


def add_text(
    slide,
    text,
    x,
    y,
    w,
    h,
    size,
    bold=False,
    color=WHITE,
    align=PP_ALIGN.LEFT,
    valign=MSO_VERTICAL_ANCHOR.TOP,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = Pt(0)
    tf.margin_right = Pt(0)
    tf.margin_top = Pt(0)
    tf.margin_bottom = Pt(0)
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    run = p.add_run()
    run.text = text
    set_font(run, size, bold, color)
    return box


def add_badge(slide, text, x, y, accent=CYAN, width=None):
    width = width or max(1.6, min(3.2, 0.11 * len(text) + 0.8))
    shape = add_shape(slide, x, y, width, 0.36, PANEL, transparency=0.06, rounded=True, line=accent)
    tf = shape.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = text
    set_font(run, 10.5, True, accent)


def add_bullets(slide, items, x, y, w, size=14, gap=0.46, bullet_color=CYAN):
    current_y = y
    for item in items:
        add_shape(slide, x, current_y + 0.07, 0.08, 0.08, bullet_color)
        add_text(slide, item, x + 0.18, current_y, w - 0.18, 0.28, size, False, TEXT)
        current_y += gap


def crop_to_ratio(image_path, ratio, anchor="center"):
    TMP.mkdir(parents=True, exist_ok=True)
    image_path = Path(image_path)
    out = TMP / f"{image_path.stem}_{anchor}_{str(ratio).replace('.', '_')}.png"
    if out.exists():
        return out

    with Image.open(image_path) as img:
        img = img.convert("RGB")
        iw, ih = img.size
        current_ratio = iw / ih
        if current_ratio > ratio:
            new_w = int(ih * ratio)
            if anchor == "left":
                left = 0
            elif anchor == "right":
                left = iw - new_w
            else:
                left = (iw - new_w) // 2
            box = (left, 0, left + new_w, ih)
        else:
            new_h = int(iw / ratio)
            if anchor == "top":
                top = 0
            elif anchor == "bottom":
                top = ih - new_h
            else:
                top = (ih - new_h) // 2
            box = (0, top, iw, top + new_h)
        img.crop(box).save(out, quality=95)
    return out


def add_image_panel(slide, image_path, x, y, w, h, frame=PANEL, border=LINE, mode="contain", anchor="center"):
    add_shape(slide, x, y, w, h, frame, rounded=True, line=border, line_width=1.2)
    inner_x = x + 0.14
    inner_y = y + 0.14
    inner_w = w - 0.28
    inner_h = h - 0.28
    add_shape(slide, inner_x, inner_y, inner_w, inner_h, LIGHT_SURFACE, rounded=True)

    if mode == "cover":
        prepared = crop_to_ratio(image_path, inner_w / inner_h, anchor=anchor)
        slide.shapes.add_picture(str(prepared), Inches(inner_x), Inches(inner_y), width=Inches(inner_w), height=Inches(inner_h))
        return

    with Image.open(image_path) as img:
        iw, ih = img.size

    scale = min(inner_w / iw, inner_h / ih)
    draw_w = iw * scale
    draw_h = ih * scale
    draw_x = inner_x + (inner_w - draw_w) / 2
    draw_y = inner_y + (inner_h - draw_h) / 2
    slide.shapes.add_picture(str(image_path), Inches(draw_x), Inches(draw_y), width=Inches(draw_w), height=Inches(draw_h))


def add_metric_card(slide, value, caption, x, y, accent):
    add_shape(slide, x, y, 1.68, 0.9, PANEL, transparency=0.03, rounded=True, line=accent)
    add_text(slide, value, x + 0.17, y + 0.18, 1.1, 0.24, 18, True, WHITE)
    add_text(slide, caption, x + 0.17, y + 0.48, 1.25, 0.22, 9.5, False, MUTED)


def add_footer(slide):
    add_text(slide, "Spider0 | Product presentation", 0.72, 7.0, 3.2, 0.18, 9.2, False, MUTED)


def add_devtool_mock(slide, x, y, w, h):
    add_shape(slide, x, y, w, h, PANEL, rounded=True, line=LINE, line_width=1.2)
    add_shape(slide, x + 0.12, y + 0.12, w - 0.24, 0.32, rgb(245, 247, 250), rounded=True)
    add_text(slide, "ProjectCore Agent Shell", x + 0.28, y + 0.18, 2.5, 0.12, 9.5, False, rgb(40, 46, 58))

    sidebar_w = 1.6
    add_shape(slide, x + 0.12, y + 0.48, sidebar_w, h - 0.6, rgb(18, 29, 45), rounded=True)
    add_badge(slide, "LOCAL AGENT", x + 0.24, y + 0.62, CYAN, 0.82)
    add_text(slide, "ProjectCore Agent Shell", x + 0.24, y + 0.82, 1.18, 0.28, 12, True, WHITE)
    add_text(
        slide,
        "Среда для работы с AI, локальной папкой проекта и git-remote в одном окне.",
        x + 0.24,
        y + 1.1,
        1.18,
        0.46,
        8.5,
        False,
        MUTED,
    )

    def sidebar_block(title, lines, by):
        add_shape(slide, x + 0.24, by, 1.28, 0.82, rgb(22, 37, 57), rounded=True, line=rgb(44, 63, 90))
        add_text(slide, title, x + 0.3, by + 0.08, 0.9, 0.16, 9.2, True, WHITE)
        text_y = by + 0.28
        for line in lines:
            add_shape(slide, x + 0.3, text_y, 1.0, 0.16, rgb(14, 23, 37), rounded=True, line=rgb(54, 74, 100))
            add_text(slide, line, x + 0.36, text_y + 0.03, 0.88, 0.1, 7.8, False, TEXT)
            text_y += 0.2

    sidebar_block("Модель", ["Qwen OAuth (CLI)", "qwen3-coder-plus"], y + 1.72)
    sidebar_block("Workspace", [r"C:\project", "Выбрать"], y + 2.66)
    sidebar_block("Git", ["GitHub", "GitVerse", "Переключить remote"], y + 3.6)
    sidebar_block("Доступы", ["qwen", "auto-edit"], y + 4.72)

    main_x = x + 1.9
    main_w = w - 2.02
    add_badge(slide, "AGENT CONSOLE", main_x + 0.16, y + 0.62, CYAN, 0.92)
    add_text(slide, "Codex-style интерфейс для Qwen OAuth (CLI)", main_x + 0.16, y + 0.86, 3.4, 0.22, 13.5, True, WHITE)
    add_shape(slide, main_x + main_w - 0.82, y + 0.62, 0.66, 0.34, rgb(24, 70, 68), rounded=True, line=rgb(76, 193, 168))
    add_text(slide, "Готов к работе", main_x + main_w - 0.74, y + 0.73, 0.52, 0.08, 8.4, False, rgb(164, 245, 222))

    add_shape(slide, main_x + 0.16, y + 1.18, main_w - 0.32, 0.9, rgb(17, 28, 43), rounded=True, line=rgb(38, 56, 80))
    add_badge(slide, "СИСТЕМА", main_x + 0.24, y + 1.28, CYAN, 0.62)
    add_text(
        slide,
        "Один интерфейс для выбора модели, подключения локальной папки, вложения файлов и запуска задачи в рабочем контуре команды.",
        main_x + 0.24,
        y + 1.52,
        main_w - 0.62,
        0.34,
        9.4,
        False,
        TEXT,
    )
    add_text(
        slide,
        "Без переключения между CLI, чатом, файловым менеджером и настройками remote.",
        main_x + 0.24,
        y + 1.76,
        main_w - 0.62,
        0.26,
        8.6,
        False,
        MUTED,
    )

    add_shape(slide, main_x + 0.16, y + 2.18, main_w - 0.32, 2.82, rgb(10, 17, 28), rounded=True, line=rgb(28, 42, 62))
    add_text(slide, "Рабочая область задачи", main_x + 0.32, y + 2.34, 1.8, 0.16, 10, True, MUTED)
    add_text(slide, "Здесь команда ведет диалог с агентом и получает результат по проекту.", main_x + 0.32, y + 2.56, 3.9, 0.18, 8.8, False, rgb(124, 140, 162))

    add_shape(slide, main_x + 0.16, y + 5.1, 0.26, 0.78, rgb(34, 48, 68), rounded=True, line=rgb(58, 77, 102))
    add_text(slide, "+", main_x + 0.24, y + 5.37, 0.08, 0.08, 12, False, TEXT, PP_ALIGN.CENTER)
    add_shape(slide, main_x + 0.48, y + 5.1, main_w - 1.3, 0.78, rgb(12, 20, 32), rounded=True, line=rgb(37, 55, 80))
    add_text(slide, "Опиши задачу простыми словами или добавь скриншот через Ctrl+V.", main_x + 0.66, y + 5.38, 3.9, 0.12, 8.8, False, rgb(125, 139, 160))
    add_shape(slide, main_x + main_w - 1.16, y + 6.0, 0.82, 0.34, rgb(39, 54, 76), rounded=True, line=rgb(58, 77, 102))
    add_text(slide, "Показать файлы", main_x + main_w - 1.01, y + 6.11, 0.56, 0.08, 7.8, False, TEXT, PP_ALIGN.CENTER)
    add_shape(slide, main_x + main_w - 0.28, y + 6.0, 0.88, 0.34, rgb(60, 160, 255), rounded=True, line=rgb(109, 195, 255))
    add_text(slide, "Выполнить задачу", main_x + main_w - 0.14, y + 6.11, 0.62, 0.08, 7.8, True, rgb(5, 11, 20), PP_ALIGN.CENTER)


def slide_cover(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide, SCREENSHOTS / "site-hero.png", overlay=0.42)
    add_shape(slide, 0, 0, 6.2, SH, BG, transparency=0.08)
    add_badge(slide, "PROJECTCORE", 0.82, 0.72, CYAN, 1.24)
    add_text(slide, "Предварительная бюджетная оценка\nсистем безопасности за 5–10 минут.", 0.82, 1.24, 5.0, 1.08, 28, True, WHITE)
    add_text(
        slide,
        "Project.Core объединяет публичный сайт, браузерную платформу расчета и Agent Shell для команды разработки в одном продукте.",
        0.86,
        2.74,
        4.8,
        0.54,
        15.3,
        False,
        TEXT,
    )
    add_bullets(
        slide,
        [
            "Бюджет по нескольким системам безопасности без Excel-хаоса и недельной подготовки.",
            "AI-аудит цен, региональный слой по 85+ субъектам РФ и Risk Guard AI для контроля сбалансированности.",
            "Один продукт для клиента, пресейла, интегратора и команды, которая его развивает.",
        ],
        0.86,
        3.62,
        4.95,
        size=13.8,
        gap=0.5,
    )
    add_metric_card(slide, "5–10 мин", "предварительная оценка", 0.86, 5.72, CYAN)
    add_metric_card(slide, "85+", "субъектов РФ", 2.72, 5.72, BLUE)
    add_metric_card(slide, "Risk Guard AI", "баланс бюджета", 4.58, 5.72, GREEN)
    add_footer(slide)


def slide_site(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide, RENDERED / "bg-cover.jpg", overlay=0.76)
    add_badge(slide, "ПУБЛИЧНЫЙ САЙТ", 0.82, 0.72, ORANGE, 1.7)
    add_text(slide, "Сайт продает продукт\nдо первого звонка.", 0.82, 1.22, 4.75, 0.88, 28, True, WHITE)
    add_text(
        slide,
        "Он объясняет, что именно делает Project.Core, почему расчету можно доверять и где находится официальный вход в платформу.",
        0.86,
        2.46,
        4.6,
        0.52,
        15,
        False,
        TEXT,
    )
    add_bullets(
        slide,
        [
            "Фиксирует позиционирование: ранний пресейл, тендер, внутренняя технико-экономическая оценка.",
            "Показывает ценность платформы: состав систем, AI-аудит цен, Risk Guard AI и логику бюджета.",
            "Создает доверие: описание системы, правовая информация и явная точка входа для клиента и партнера.",
        ],
        0.86,
        3.44,
        4.75,
        size=13.4,
        gap=0.56,
        bullet_color=ORANGE,
    )
    add_image_panel(slide, RENDERED / "site-about-preview.jpg", 5.86, 0.92, 6.55, 5.88, border=ORANGE, mode="contain")
    add_footer(slide)


def slide_platform(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide, RENDERED / "bg-platform2.jpg", overlay=0.82)
    add_badge(slide, "ПЛАТФОРМА РАСЧЕТА", 0.82, 0.72, BLUE, 1.98)
    add_text(slide, "Платформа собирает не просто сумму,\nа объяснимый бюджет по объекту.", 0.82, 1.22, 5.18, 0.96, 27, True, WHITE)
    add_text(
        slide,
        "Project.Core заменяет хаотичный ручной расчет управляемым цифровым процессом: объект, зоны, системы, обследование, проектирование, бюджет и логика расчета связаны в одну модель.",
        0.86,
        2.52,
        4.9,
        0.72,
        14.5,
        False,
        TEXT,
    )
    add_bullets(
        slide,
        [
            "Карточка объекта, структура зон и выбор состава систем формируют инженерный контур расчета.",
            "AI-аудит цен, рыночная верификация и защитные коэффициенты удерживают бюджет в рабочем диапазоне.",
            "Пользователь видит, из чего собрана сумма: объемы, единичные расценки, коэффициенты, AI-проверки и ограничения.",
        ],
        0.86,
        3.68,
        4.92,
        size=13.2,
        gap=0.54,
        bullet_color=BLUE,
    )
    add_image_panel(slide, SCREENSHOTS / "platform-object-view.png", 5.94, 0.94, 6.44, 5.96, border=BLUE, mode="contain")
    add_footer(slide)


def slide_devtool(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide, None)
    add_badge(slide, "AGENT SHELL", 0.82, 0.72, GREEN, 1.42)
    add_text(slide, "Инструмент разработчика держит\nмодель, код и задачу в одном окне.", 0.82, 1.2, 4.95, 0.92, 27, True, WHITE)
    add_text(
        slide,
        "Agent Shell — это рабочая среда команды: выбор AI-провайдера, подключение локального workspace, работа с GitHub и GitVerse, вложения файлов и запуск задачи без переключения между разными инструментами.",
        0.86,
        2.48,
        4.88,
        0.76,
        14.2,
        False,
        TEXT,
    )
    add_bullets(
        slide,
        [
            "Поддерживает сценарий Qwen OAuth CLI, Qwen API и другие рабочие контуры без потери контекста.",
            "Дает разработчику прямой доступ к локальной папке проекта, remote и режиму выполнения задачи.",
            "Ускоряет доработку продукта: экран продукта, кодовая база и AI-исполнитель работают рядом.",
        ],
        0.86,
        3.72,
        4.86,
        size=13,
        gap=0.52,
        bullet_color=GREEN,
    )
    add_devtool_mock(slide, 5.92, 0.92, 6.48, 5.98)
    add_footer(slide)


def slide_final(prs):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_bg(slide, SCREENSHOTS / "site-ai-engine.png", overlay=0.74)
    add_badge(slide, "ФИНАЛЬНОЕ СООБЩЕНИЕ", 0.82, 0.72, CYAN, 2.08)
    add_text(slide, "Один продукт.\nТри сильных слоя ценности.", 0.82, 1.24, 4.5, 0.86, 28, True, WHITE)
    add_text(
        slide,
        "Сайт объясняет ценность, платформа формирует защищаемый бюджет, Agent Shell ускоряет развитие самого продукта.",
        0.86,
        2.5,
        4.4,
        0.5,
        15,
        False,
        TEXT,
    )
    add_shape(slide, 0.86, 3.42, 1.9, 1.14, PANEL, rounded=True, line=CYAN)
    add_text(slide, "Сайт", 1.08, 3.68, 0.8, 0.16, 17, True, WHITE)
    add_text(slide, "Продает и объясняет\nпродукт.", 1.08, 3.98, 1.2, 0.28, 11.2, False, MUTED)
    add_shape(slide, 2.98, 3.42, 1.9, 1.14, PANEL, rounded=True, line=BLUE)
    add_text(slide, "Платформа", 3.2, 3.68, 1.0, 0.16, 17, True, WHITE)
    add_text(slide, "Считает и объясняет\nбюджет.", 3.2, 3.98, 1.2, 0.28, 11.2, False, MUTED)
    add_shape(slide, 5.1, 3.42, 1.9, 1.14, PANEL, rounded=True, line=GREEN)
    add_text(slide, "Agent Shell", 5.32, 3.68, 1.15, 0.16, 17, True, WHITE)
    add_text(slide, "Развивает продукт\nв рабочем ритме.", 5.32, 3.98, 1.28, 0.28, 11.2, False, MUTED)
    add_image_panel(slide, SCREENSHOTS / "platform-budget-view.png", 7.42, 1.18, 5.0, 4.9, border=CYAN, mode="contain")
    add_footer(slide)


def main():
    prs = Presentation()
    prs.slide_width = Inches(SW)
    prs.slide_height = Inches(SH)

    slide_cover(prs)
    slide_site(prs)
    slide_platform(prs)
    slide_devtool(prs)
    slide_final(prs)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()

import os
import sys
from bs4 import BeautifulSoup
from markdown_it import MarkdownIt

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def get_reportlab_html(element):
    """Recursively convert BeautifulSoup tag children to ReportLab-compatible HTML tags."""
    if element.name is None:
        # Text node: escape for XML parser
        text = str(element)
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    html_out = ""
    for child in element.children:
        if child.name is None:
            text = str(child)
            html_out += text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        elif child.name == 'strong' or child.name == 'b':
            html_out += f"<b>{get_reportlab_html(child)}</b>"
        elif child.name == 'em' or child.name == 'i':
            html_out += f"<i>{get_reportlab_html(child)}</i>"
        elif child.name == 'code':
            html_out += f'<font face="Courier" color="#c7254e"><b>{get_reportlab_html(child)}</b></font>'
        elif child.name == 'a':
            href = child.get('href', '')
            html_out += f'<a href="{href}"><font color="#3498db"><u>{get_reportlab_html(child)}</u></font></a>'
        elif child.name == 'br':
            html_out += "<br/>"
        else:
            html_out += get_reportlab_html(child)
    return html_out

def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(colors.HexColor('#666666'))
    page_num = canvas.getPageNumber()
    canvas.drawCentredString(A4[0]/2, 36, f"Page {page_num}")
    canvas.restoreState()

def convert_md_to_pdf(md_path, pdf_path):
    if not os.path.exists(md_path):
        print(f"Error: {md_path} does not exist.")
        return False
        
    print(f"Reading {md_path}...")
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Render markdown to HTML using markdown-it-py
    md = MarkdownIt()
    html_content = md.render(md_content)
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Configure custom styles
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 14
    normal_style.textColor = colors.HexColor('#333333')
    normal_style.spaceAfter = 6
    
    h1_style = ParagraphStyle(
        'H1_Custom',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#2c3e50'),
        spaceBefore=16,
        spaceAfter=12,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'H2_Custom',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#34495e'),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    
    h3_style = ParagraphStyle(
        'H3_Custom',
        parent=styles['Heading3'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#7f8c8d'),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Code'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#2c3e50'),
        backColor=colors.HexColor('#f8f9fa'),
        borderColor=colors.HexColor('#e9ecef'),
        borderWidth=0.5,
        borderPadding=8,
        spaceBefore=6,
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Bullet'],
        fontSize=10,
        leading=14,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )
    
    story = []
    
    # Walk top-level HTML nodes and append flowables
    for element in soup.children:
        if element.name is None:
            continue
            
        if element.name == 'h1':
            story.append(Paragraph(get_reportlab_html(element), h1_style))
        elif element.name == 'h2':
            story.append(Paragraph(get_reportlab_html(element), h2_style))
        elif element.name == 'h3':
            story.append(Paragraph(get_reportlab_html(element), h3_style))
        elif element.name == 'p':
            story.append(Paragraph(get_reportlab_html(element), normal_style))
        elif element.name == 'ul':
            for li in element.find_all('li', recursive=False):
                story.append(Paragraph(f"&bull; {get_reportlab_html(li)}", bullet_style))
            story.append(Spacer(1, 4))
        elif element.name == 'ol':
            idx = 1
            for li in element.find_all('li', recursive=False):
                story.append(Paragraph(f"{idx}. {get_reportlab_html(li)}", bullet_style))
                idx += 1
            story.append(Spacer(1, 4))
        elif element.name == 'pre':
            # Preformatted code blocks
            code_tag = element.find('code')
            code_text = code_tag.get_text() if code_tag else element.get_text()
            escaped = code_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            # Replace spaces and newlines for flowable Paragraph
            formatted = escaped.replace('\n', '<br/>').replace(' ', '&nbsp;')
            story.append(Paragraph(formatted, code_style))
        elif element.name == 'table':
            table_data = []
            # Gather rows
            for tr in element.find_all('tr'):
                row_data = []
                for cell in tr.find_all(['td', 'th']):
                    cell_html = get_reportlab_html(cell)
                    cell_style = ParagraphStyle(
                        'Cell_Custom',
                        parent=normal_style,
                        fontSize=8,
                        leading=10,
                        spaceAfter=0
                    )
                    row_data.append(Paragraph(cell_html, cell_style))
                if row_data:
                    table_data.append(row_data)
            
            if table_data:
                col_count = len(table_data[0])
                col_width = doc.width / col_count
                t = Table(table_data, colWidths=[col_width]*col_count)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f3f5')),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                    ('TOPPADDING', (0,0), (-1,-1), 6),
                    ('LEFTPADDING', (0,0), (-1,-1), 6),
                    ('RIGHTPADDING', (0,0), (-1,-1), 6),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dee2e6')),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
        elif element.name == 'hr':
            story.append(Spacer(1, 10))
            t = Table([['']], colWidths=[doc.width])
            t.setStyle(TableStyle([('LINEABOVE', (0,0), (-1,-1), 0.5, colors.HexColor('#dee2e6'))]))
            story.append(t)
            story.append(Spacer(1, 10))
            
    print(f"Building PDF {pdf_path}...")
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print("Done!")
    return True

if __name__ == '__main__':
    print("ReportLab compilation script active.")
    convert_md_to_pdf('User-manual.md', 'User-manual.pdf')
    convert_md_to_pdf('User-manual_easy.md', 'User-manual_easy.pdf')

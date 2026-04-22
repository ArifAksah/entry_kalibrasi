import codecs

filepath = r'd:\entry_kalibrasi\next-dashboard-app\lib\certificate-pdf-helper.ts'
with codecs.open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '[PDF Helper] Injecting print CSS overrides'
start_idx = content.find(start_marker)

addstyle_start = content.find('await page.addStyleTag({', start_idx)
addstyle_end = content.find('\n      })\n', addstyle_start) + len('\n      })\n')

new_css = """      await page.addStyleTag({
        content: `
          /* Font fallback - hanya untuk elemen text, bukan semua elemen */
          body, p, span, div, td, th, h1, h2, h3, h4, h5, h6, button, input, label {
            font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
          }
          /* Sembunyikan no-print */
          .no-print { display: none !important; }
          .bg-gray-100 { background-color: white !important; }
          
          /* Reset list style global (sama dengan A4Style di print page) */
          * { list-style: none !important; list-style-type: none !important; list-style-position: outside !important; list-style-image: none !important; }
          ul, ol, li { list-style: none !important; padding-left: 0 !important; margin-left: 0 !important; text-indent: 0 !important; }

          /* Page container - sync dengan @media print di print/page.tsx */
          .page-container {
            margin: 0 !important;
            padding: 5mm !important;
            padding-bottom: 25mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .cert-title-id { font-size: 20px !important; line-height: 1.15 !important; font-weight: 700 !important; letter-spacing: 0 !important; color: #000 !important; }
          .cert-title-en { font-size: 7px !important; line-height: 1.2 !important; font-weight: 700 !important; font-style: italic !important; color: #000 !important; }
          .cert-text-id, .cert-info-text, .cert-info-text td { font-size: 11px !important; line-height: 1.25 !important; font-weight: 700 !important; color: #000 !important; }
          .cert-text-en { font-size: 7px !important; line-height: 1.15 !important; font-weight: 700 !important; font-style: italic !important; color: #000 !important; }

          /* ── Page containers ── */
          .page-container.cover-page {
            height: 297mm !important; max-height: 297mm !important; position: relative !important; box-sizing: border-box !important;
          }
          .page-container.results-page {
            min-height: 297mm !important; height: 297mm !important; padding: 0 5mm 25mm 5mm !important; box-sizing: border-box !important; position: relative !important;
          }
          .page-container.results-page thead.print-repeat-header > tr > td { padding: 5mm 0 0 0 !important; }
          .page-container.results-page tbody.print-content > tr > td { padding-top: 2mm !important; }

          /* ── Page-1 footer (cover page footer masking) ── */
          .page-1-footer {
            position: absolute !important; bottom: 5mm !important; left: 5mm !important; right: 5mm !important;
            z-index: 1000 !important; background-color: white !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            padding-top: 20px !important; padding-bottom: 20px !important; margin-bottom: -10px !important;
            list-style-type: none !important; list-style: none !important; list-style-position: outside !important;
          }
          .page-1-footer, .page-1-footer * {
            list-style: none !important; list-style-type: none !important; list-style-position: outside !important; list-style-image: none !important;
            background: transparent !important; background-image: none !important; outline: none !important; text-indent: 0 !important; padding-left: 0 !important; margin-left: 0 !important;
          }
          .page-1-footer { background-color: white !important; }
          .page-1-footer *::marker { display: none !important; content: none !important; color: transparent !important; }
          .page-1-footer *::before, .page-1-footer *::after { content: none !important; display: none !important; background: transparent !important; background-image: none !important; width: 0 !important; height: 0 !important; visibility: hidden !important; }
          .page-1-footer span, .page-1-footer div { position: relative !important; display: inline-block !important; }

          /* ── QR code footer halaman 2+ ── */
          .footer-qr-small { display: none !important; visibility: hidden !important; }
          .page-container.results-page .footer-qr-small.results-page-qr {
            position: absolute !important; bottom: 4mm !important; left: 4mm !important;
            width: 100px !important; height: 100px !important; z-index: 999 !important;
            display: block !important; visibility: visible !important; opacity: 1 !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .page-container:not(.results-page) .footer-qr-small, .page-container:not(.results-page) .results-page-qr {
            display: none !important; visibility: hidden !important; opacity: 0 !important;
          }

          /* ── Table tfoot fixes ── */
          tfoot.print-repeat-footer { display: table-footer-group !important; position: static !important; bottom: auto !important; left: auto !important; width: auto !important; background-color: white !important; }
          tfoot.print-repeat-footer > tr { display: table-row !important; position: static !important; width: auto !important; }
          tfoot.print-repeat-footer > tr > td { display: table-cell !important; position: static !important; width: auto !important; }
          table.repeatable-page-table { height: 100% !important; width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; }
          thead.print-repeat-header { display: table-header-group !important; }
          tbody.print-content { display: table-row-group !important; }

          /* ── Avoid page break after last container ── */
          .page-container:last-of-type { page-break-after: avoid !important; break-after: avoid !important; }
          *::marker { display: none !important; content: "" !important; font-size: 0 !important; }
        `
      })
"""

new_content = content[:addstyle_start] + new_css + content[addstyle_end:]

with codecs.open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced successfully!")

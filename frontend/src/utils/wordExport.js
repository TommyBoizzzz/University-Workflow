const palettes = {
  teal: {
    accent: 'D2AC55',
    brand: '3F7772',
    border: 'DCE6E8',
    heading: '397268',
    panel: 'EDF6F4',
    panelBorder: '2B8176',
    text: '26384A',
    title: '173B55',
  },
  gold: {
    accent: 'C3A24F',
    brand: '6F6A50',
    border: 'E4E5DC',
    heading: '7D6737',
    panel: 'F7F1DF',
    panelBorder: 'B18B45',
    text: '26384A',
    title: '294C5A',
  },
}

const safeText = (value) => [...String(value ?? '')]
  .filter((character) => {
    const code = character.codePointAt(0)
    return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 0xFFFE || code === 0xFFFF)
  })
  .join('')

export async function createWordDocumentBlob({
  title,
  subtitle,
  metadata = [],
  sections = [],
  sectionLabel = '',
  theme = 'teal',
}) {
  const { BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
  const colors = palettes[theme] || palettes.teal
  const run = (text, options = {}) => new TextRun({
    text: safeText(text),
    font: 'Aptos',
    size: 20,
    color: colors.text,
    ...options,
  })
  const leftPanelBorder = {
    left: { style: BorderStyle.SINGLE, size: 24, color: colors.panelBorder, space: 8 },
  }
  const metadataParagraph = metadata.length
    ? new Paragraph({
        children: metadata.flatMap(({ label, value }, index) => [
          run(`${safeText(label).toUpperCase()} `, { bold: true, color: colors.brand, size: 16 }),
          run(value, { color: '62777A', size: 18 }),
          ...(index < metadata.length - 1 ? [run('     ', { size: 18 })] : []),
        ]),
        spacing: { before: 140, after: 220 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: colors.border, space: 6 } },
      })
    : null
  const content = [
    new Paragraph({
      children: [run('UNIVERSITY WORKFLOW', {
        bold: true,
        color: colors.brand,
        size: 18,
        characterSpacing: 20,
      })],
      spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: colors.border, space: 6 } },
    }),
    new Paragraph({
      children: [run(subtitle || 'MEETING MATERIAL', {
        bold: true,
        color: colors.brand,
        size: 16,
        characterSpacing: 16,
      })],
      shading: { fill: colors.panel },
      border: leftPanelBorder,
      indent: { left: 180 },
      spacing: { before: 180, after: 20 },
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [run(title, {
        bold: true,
        color: colors.title,
        size: 34,
      })],
      shading: { fill: colors.panel },
      border: leftPanelBorder,
      indent: { left: 180 },
      spacing: { after: 180 },
    }),
    ...(metadataParagraph ? [metadataParagraph] : []),
    ...(sectionLabel ? [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [run(sectionLabel.toUpperCase(), {
          bold: true,
          color: colors.title,
          size: 22,
        })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: colors.accent, space: 5 } },
        spacing: { before: 120, after: 100 },
      }),
    ] : []),
    ...sections.flatMap((section) => {
      const paragraphs = (section.paragraphs || []).filter((text) => safeText(text).trim())
      const items = (section.items || []).filter((text) => safeText(text).trim())
      const numberedItems = (section.numberedItems || []).filter((text) => safeText(text).trim())
      if (!paragraphs.length && !items.length && !numberedItems.length) return []

      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [run(section.title.toUpperCase(), {
            bold: true,
            color: colors.heading,
            size: 22,
          })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: colors.border, space: 4 } },
          spacing: { before: 180, after: 100 },
        }),
        ...paragraphs.map((text) => new Paragraph({
          children: [run(text)],
          ...(section.emphasis ? {
            shading: { fill: colors.panel },
            border: leftPanelBorder,
            indent: { left: 180 },
          } : {}),
          spacing: { after: 120, line: 276 },
        })),
        ...items.map((text) => new Paragraph({
          children: [
            run('• ', { bold: true, color: colors.accent }),
            run(text),
          ],
          indent: { left: 240, hanging: 240 },
          spacing: { after: 80, line: 260 },
        })),
        ...numberedItems.map((text, index) => new Paragraph({
          children: [
            run(`${index + 1}. `, { bold: true, color: colors.accent }),
            run(text),
          ],
          shading: { fill: 'FBFAF5' },
          indent: { left: 160 },
          spacing: { after: 100, line: 260 },
        })),
      ]
    }),
    new Paragraph({
      children: [run('University Workflow  ·  Confidential', { color: '93A2A5', size: 15 })],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: colors.border, space: 6 } },
      spacing: { before: 240 },
    }),
  ]

  const wordDocument = new Document({
    creator: 'University Workflow',
    title: safeText(title),
    sections: [{
      properties: {
        page: {
          margin: { top: 567, right: 680, bottom: 680, left: 680 },
        },
      },
      children: content,
    }],
  })

  return Packer.toBlob(wordDocument)
}

export async function downloadWordDocument({ fileName, ...documentData }) {
  const blob = await createWordDocumentBlob(documentData)
  const safeName = String(fileName || 'document')
    .replace(/[<>:"/\\|?*]/g, '-')
    .trim()
    .slice(0, 80) || 'document'
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${safeName}.docx`
  window.document.body.appendChild(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

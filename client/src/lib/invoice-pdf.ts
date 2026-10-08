import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type PdfLinkRect = {
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

function collectPdfLinkRects(root: HTMLElement): PdfLinkRect[] {
  const rootRect = root.getBoundingClientRect();
  const links: PdfLinkRect[] = [];

  root.querySelectorAll<HTMLElement>("[data-invoice-pdf-link]").forEach((el) => {
    const url = el.getAttribute("data-invoice-pdf-link")?.trim();
    if (!url) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    links.push({
      url,
      left: r.left - rootRect.left,
      top: r.top - rootRect.top,
      width: r.width,
      height: r.height,
    });
  });

  return links;
}

/** Map DOM link regions onto the rasterized PDF so clicks open URLs in a new tab. */
function applyPdfLinkAnnotations(
  pdf: jsPDF,
  links: PdfLinkRect[],
  rootWidth: number,
  rootHeight: number,
  imgWidthMm: number,
  imgHeightMm: number,
  pageHeightMm: number,
) {
  if (!links.length || rootWidth <= 0 || rootHeight <= 0) return;

  for (const link of links) {
    const x = (link.left / rootWidth) * imgWidthMm;
    const y = (link.top / rootHeight) * imgHeightMm;
    const w = (link.width / rootWidth) * imgWidthMm;
    const h = (link.height / rootHeight) * imgHeightMm;

    const pageIndex = Math.floor(y / pageHeightMm);
    const yOnPage = y - pageIndex * pageHeightMm;

    pdf.setPage(pageIndex + 1);
    pdf.link(x, yOnPage, w, h, { url: link.url });
  }
}

/** Render an invoice DOM node to a downloadable PDF blob (A4, single page). */
export async function generateInvoicePdfBlob(element: HTMLElement): Promise<Blob> {
  const root =
    element.querySelector<HTMLElement>(".invoice-pdf-root") ??
    element.querySelector<HTMLElement>("[data-invoice-pdf-link]")?.closest<HTMLElement>(".overflow-hidden") ??
    element;

  const rootWidth = root.offsetWidth;
  const rootHeight = root.offsetHeight;
  const pdfLinks = collectPdfLinkRects(root);

  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let renderWidth = imgWidth;
  let renderHeight = imgHeight;
  if (imgHeight > pageHeight) {
    const scale = pageHeight / imgHeight;
    renderWidth = imgWidth * scale;
    renderHeight = pageHeight;
  }
  const x = (pageWidth - renderWidth) / 2;

  pdf.addImage(imgData, "JPEG", x, 0, renderWidth, renderHeight);

  applyPdfLinkAnnotations(pdf, pdfLinks, rootWidth, rootHeight, renderWidth, renderHeight, pageHeight);

  return pdf.output("blob");
}

export function downloadInvoicePdf(blob: Blob, invoiceNo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${invoiceNo.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

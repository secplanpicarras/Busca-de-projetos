const libs = window.SEPLAN_PDF_LIBS || {};
const missingLibs = [];
if (!window.PDFLib) missingLibs.push("PDFLib");
if (!window.JSZip) missingLibs.push("JSZip");
if (!window.pdfjsLib) missingLibs.push("PDF.js");

const { PDFDocument, StandardFonts, degrees, rgb } = window.PDFLib || {};
if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = libs.pdfWorker;

const APP_VERSION = "1.0-homologacao";
const WARN_TOTAL_BYTES = 120 * 1024 * 1024;
const HARD_TOTAL_BYTES = 250 * 1024 * 1024;

const state = {
  mergeFiles: [],
  splitMode: "half",
};

const els = {
  status: document.querySelector("#status"),
  metrics: document.querySelector("#metrics"),
  downloads: document.querySelector("#downloads"),
  mergeFiles: document.querySelector("#mergeFiles"),
  mergeList: document.querySelector("#mergeList"),
  compressFile: document.querySelector("#compressFile"),
  splitFile: document.querySelector("#splitFile"),
  extractFile: document.querySelector("#extractFile"),
  organizeFile: document.querySelector("#organizeFile"),
  rotateFile: document.querySelector("#rotateFile"),
  watermarkFile: document.querySelector("#watermarkFile"),
  numbersFile: document.querySelector("#numbersFile"),
  pdfToJpgFile: document.querySelector("#pdfToJpgFile"),
  jpgToPdfFiles: document.querySelector("#jpgToPdfFiles"),
  cropFile: document.querySelector("#cropFile"),
  signFile: document.querySelector("#signFile"),
  textStampFile: document.querySelector("#textStampFile"),
  redactFile: document.querySelector("#redactFile"),
  compareFileA: document.querySelector("#compareFileA"),
  compareFileB: document.querySelector("#compareFileB"),
  textExtractFile: document.querySelector("#textExtractFile"),
  flattenFormsFile: document.querySelector("#flattenFormsFile"),
  metadataFile: document.querySelector("#metadataFile"),
  coverFile: document.querySelector("#coverFile"),
  nupFile: document.querySelector("#nupFile"),
  quality: document.querySelector("#quality"),
  qualityOut: document.querySelector("#qualityOut"),
};

function setStatus(message, error = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", error);
}

function currentPanelFiles(button) {
  const panel = button.closest(".tool-panel");
  if (!panel) return [];
  return Array.from(panel.querySelectorAll('input[type="file"]')).flatMap((input) => Array.from(input.files || []));
}

function validateFileLoad(files) {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (!files.length) return;
  if (total > HARD_TOTAL_BYTES) {
    throw new Error(`Os arquivos selecionados somam ${formatSize(total)}. Nesta versao de homologacao, use ate ${formatSize(HARD_TOTAL_BYTES)} por operacao.`);
  }
  if (total > WARN_TOTAL_BYTES) {
    setStatus(`Aviso: os arquivos somam ${formatSize(total)}. Pode demorar ou exigir uma maquina com mais memoria.`);
  }
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.dataset.originalLabel ||= button.textContent;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

function bytesToMb(bytes) {
  return bytes / 1024 / 1024;
}

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytesToMb(bytes).toFixed(2)} MB`;
}

function fileStem(name) {
  return name.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 70) || "documento";
}

async function fileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

function resetOutput() {
  els.metrics.innerHTML = "";
  els.downloads.innerHTML = "";
}

function addMetric(label, value) {
  const row = document.createElement("div");
  row.className = "metric";
  row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  els.metrics.append(row);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.className = "download";
  link.textContent = `Baixar ${name}`;
  els.downloads.append(link);
}

function downloadPdf(bytes, name) {
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), name);
}

function downloadText(text, name) {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), name);
}

function parseRanges(input, pageCount) {
  const chunks = input.split(",").map((part) => part.trim()).filter(Boolean);
  if (!chunks.length) throw new Error("Informe pelo menos uma pagina ou intervalo.");

  const pages = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Intervalo invalido: ${chunk}`);

    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Intervalo fora do PDF: ${chunk}. Este arquivo tem ${pageCount} paginas.`);
    }

    for (let page = start; page <= end; page += 1) pages.push(page - 1);
  }
  return pages;
}

function parseRangeGroups(input, pageCount) {
  return input.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const pages = parseRanges(part, pageCount);
    return { label: part.replace(/\s+/g, ""), pages };
  });
}

function allPageIndexes(pageCount) {
  return Array.from({ length: pageCount }, (_, index) => index);
}

function optionalPages(input, pageCount) {
  const value = input.trim();
  return value ? parseRanges(value, pageCount) : allPageIndexes(pageCount);
}

function uniqueIndexes(indexes) {
  return [...new Set(indexes)];
}

function pageNumberText(format, pageNumber, totalPages) {
  if (format === "page") return `Pagina ${pageNumber}`;
  if (format === "total") return `Pagina ${pageNumber} de ${totalPages}`;
  return String(pageNumber);
}

function pageNumberPosition(position, page, textWidth) {
  const margin = 34;
  const y = 24;
  if (position === "bottom-left") return { x: margin, y };
  if (position === "bottom-right") return { x: page.getWidth() - textWidth - margin, y };
  return { x: (page.getWidth() - textWidth) / 2, y };
}

function mmToPt(value) {
  return Number(value || 0) * 2.83465;
}

function textPosition(position, page, textWidth, size) {
  const margin = 36;
  if (position === "top-left") return { x: margin, y: page.getHeight() - margin - size };
  if (position === "top-right") return { x: page.getWidth() - textWidth - margin, y: page.getHeight() - margin - size };
  if (position === "bottom-left") return { x: margin, y: margin };
  if (position === "bottom-right") return { x: page.getWidth() - textWidth - margin, y: margin };
  return { x: (page.getWidth() - textWidth) / 2, y: (page.getHeight() - size) / 2 };
}

async function renderPdfPage(source, pageNumber, dpi) {
  const page = await source.getPage(pageNumber);
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, viewport, scale };
}

function readPercentBox(prefix) {
  const x = Number(document.querySelector(`#${prefix}X`).value);
  const y = Number(document.querySelector(`#${prefix}Y`).value);
  const w = Number(document.querySelector(`#${prefix}W`).value);
  const h = Number(document.querySelector(`#${prefix}H`).value);
  if ([x, y, w, h].some((value) => !Number.isFinite(value))) throw new Error("Informe percentuais validos para a area.");
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 100 || y + h > 100) {
    throw new Error("A area precisa ficar dentro da pagina, entre 0% e 100%.");
  }
  return { x, y, w, h };
}

function installDropzones() {
  document.querySelectorAll(".dropzone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
      const input = zone.querySelector("input");
      input.files = event.dataTransfer.files;
      input.dispatchEvent(new Event("change"));
    });
  });
}

function renderMergeList() {
  els.mergeList.innerHTML = "";
  state.mergeFiles.forEach((file, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="file-index">${index + 1}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatSize(file.size)}</span>
      <span>
        <button class="icon-btn" data-action="up" data-index="${index}" type="button" title="Subir">^</button>
        <button class="icon-btn" data-action="down" data-index="${index}" type="button" title="Descer">v</button>
        <button class="icon-btn" data-action="remove" data-index="${index}" type="button" title="Remover">x</button>
      </span>
    `;
    els.mergeList.append(item);
  });
}

async function mergePdfs() {
  resetOutput();
  if (state.mergeFiles.length < 2) throw new Error("Selecione pelo menos dois PDFs para juntar.");

  const output = await PDFDocument.create();
  let totalPages = 0;
  for (const file of state.mergeFiles) {
    setStatus(`Incluindo ${file.name}...`);
    const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
    const pages = await output.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    totalPages += pages.length;
  }

  const bytes = await output.save({ useObjectStreams: true });
  downloadPdf(bytes, "pdfs-juntos-seplan.pdf");
  addMetric("Arquivos", state.mergeFiles.length);
  addMetric("Paginas", totalPages);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("PDFs juntados com sucesso.");
}

async function createPdfFromPages(sourcePdf, pageIndexes) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(sourcePdf, pageIndexes);
  pages.forEach((page) => out.addPage(page));
  return out.save({ useObjectStreams: true });
}

async function splitPdf() {
  resetOutput();
  const file = els.splitFile.files[0];
  if (!file) throw new Error("Selecione um PDF para dividir.");

  const source = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const count = source.getPageCount();
  let groups = [];

  if (state.splitMode === "half") {
    const middle = Math.ceil(count / 2);
    groups = [
      { label: `paginas-1-${middle}`, pages: Array.from({ length: middle }, (_, i) => i) },
      { label: `paginas-${middle + 1}-${count}`, pages: Array.from({ length: count - middle }, (_, i) => i + middle) },
    ].filter((group) => group.pages.length);
  }

  if (state.splitMode === "every") {
    const size = Number(document.querySelector("#pagesPerPart").value);
    if (!Number.isInteger(size) || size < 1) throw new Error("Informe um numero valido de paginas por arquivo.");
    for (let start = 0; start < count; start += size) {
      const end = Math.min(start + size, count);
      groups.push({
        label: `paginas-${start + 1}-${end}`,
        pages: Array.from({ length: end - start }, (_, i) => i + start),
      });
    }
  }

  if (state.splitMode === "ranges") {
    groups = parseRangeGroups(document.querySelector("#splitRanges").value, count);
  }

  await downloadGroupsAsZip(groups, source, `${fileStem(file.name)}-dividido.zip`);
  addMetric("Paginas originais", count);
  addMetric("Arquivos gerados", groups.length);
  setStatus("PDF dividido com sucesso.");
}

async function extractPages() {
  resetOutput();
  const file = els.extractFile.files[0];
  if (!file) throw new Error("Selecione um PDF para extrair paginas.");

  const source = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const pages = parseRanges(document.querySelector("#extractRanges").value, source.getPageCount());
  const bytes = await createPdfFromPages(source, pages);

  downloadPdf(bytes, `${fileStem(file.name)}-paginas-extraidas.pdf`);
  addMetric("Paginas extraidas", pages.length);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("Paginas extraidas com sucesso.");
}

async function downloadGroupsAsZip(groups, source, name) {
  if (!groups.length) throw new Error("Nenhum intervalo para gerar.");
  const zip = new window.JSZip();

  for (const [index, group] of groups.entries()) {
    setStatus(`Gerando parte ${index + 1} de ${groups.length}...`);
    const bytes = await createPdfFromPages(source, group.pages);
    zip.file(`${String(index + 1).padStart(2, "0")}-${group.label}.pdf`, bytes);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, name);
  addMetric("Tamanho ZIP", formatSize(blob.size));
}

async function renderPdfToCompressedBytes(file, quality, dpi) {
  const data = await file.arrayBuffer();
  const source = await window.pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const out = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    setStatus(`Compactando pagina ${pageNumber} de ${source.numPages}...`);
    const { canvas, viewport, scale } = await renderPdfPage(source, pageNumber, dpi);

    const jpegBytes = await new Promise((resolve) => {
      canvas.toBlob(async (blob) => resolve(new Uint8Array(await blob.arrayBuffer())), "image/jpeg", quality);
    });
    const image = await out.embedJpg(jpegBytes);
    const pdfPage = out.addPage([viewport.width / scale, viewport.height / scale]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pdfPage.getWidth(),
      height: pdfPage.getHeight(),
    });
    canvas.width = 1;
    canvas.height = 1;
  }

  return out.save({ useObjectStreams: true });
}

async function compressPdf() {
  resetOutput();
  const file = els.compressFile.files[0];
  if (!file) throw new Error("Selecione um PDF para compactar.");

  const targetMb = Number(document.querySelector("#targetMb").value);
  const targetBytes = targetMb > 0 ? targetMb * 1024 * 1024 : null;
  const startQuality = Number(els.quality.value) / 100;
  const startDpi = Number(document.querySelector("#dpi").value);
  const attempts = targetBytes
    ? [
        [startQuality, startDpi],
        [Math.min(startQuality, 0.72), Math.min(startDpi, 130)],
        [0.58, 110],
        [0.46, 96],
        [0.36, 82],
      ]
    : [[startQuality, startDpi]];

  let best = null;
  for (const [quality, dpi] of attempts) {
    const bytes = await renderPdfToCompressedBytes(file, quality, dpi);
    best = { bytes, quality, dpi };
    if (!targetBytes || bytes.length <= targetBytes) break;
  }

  downloadPdf(best.bytes, `${fileStem(file.name)}-compactado.pdf`);
  addMetric("Original", formatSize(file.size));
  addMetric("Final", formatSize(best.bytes.length));
  addMetric("Reducao", `${Math.max(0, 100 - (best.bytes.length / file.size) * 100).toFixed(1)}%`);
  addMetric("Qualidade usada", `${Math.round(best.quality * 100)}% / ${best.dpi} dpi`);
  if (targetBytes && best.bytes.length > targetBytes) {
    setStatus("Compactacao concluida, mas o PDF ficou acima da meta. Tente uma meta maior ou um arquivo com menos imagens.");
  } else {
    setStatus("PDF compactado com sucesso.");
  }
}

async function organizePdf() {
  resetOutput();
  const file = els.organizeFile.files[0];
  if (!file) throw new Error("Selecione um PDF para organizar.");

  const source = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const count = source.getPageCount();
  const orderInput = document.querySelector("#organizeOrder").value.trim();
  const removeInput = document.querySelector("#organizeRemove").value.trim();
  const rotateAngle = Number(document.querySelector("#organizeRotate").value);
  const orderedPages = orderInput ? parseRanges(orderInput, count) : allPageIndexes(count);
  const removed = new Set(removeInput ? parseRanges(removeInput, count) : []);
  const pageIndexes = orderedPages.filter((index) => !removed.has(index));

  if (!pageIndexes.length) throw new Error("A organizacao removeria todas as paginas.");

  const out = await PDFDocument.create();
  const pages = await out.copyPages(source, pageIndexes);
  pages.forEach((page) => {
    if (rotateAngle) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + rotateAngle) % 360));
    }
    out.addPage(page);
  });

  const bytes = await out.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-organizado.pdf`);
  addMetric("Paginas originais", count);
  addMetric("Paginas finais", pageIndexes.length);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("PDF organizado com sucesso.");
}

async function rotatePdf() {
  resetOutput();
  const file = els.rotateFile.files[0];
  if (!file) throw new Error("Selecione um PDF para girar.");

  const source = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const count = source.getPageCount();
  const selected = new Set(optionalPages(document.querySelector("#rotateRanges").value, count));
  const angle = Number(document.querySelector("#rotateAngle").value);
  const pages = await out.copyPages(source, allPageIndexes(count));

  pages.forEach((page, index) => {
    if (selected.has(index)) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((current + angle) % 360));
    }
    out.addPage(page);
  });

  const bytes = await out.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-girado.pdf`);
  addMetric("Paginas giradas", selected.size);
  addMetric("Rotacao", `${angle} graus`);
  setStatus("PDF girado com sucesso.");
}

async function watermarkPdf() {
  resetOutput();
  const file = els.watermarkFile.files[0];
  if (!file) throw new Error("Selecione um PDF para adicionar marca d'agua.");

  const text = document.querySelector("#watermarkText").value.trim();
  if (!text) throw new Error("Informe o texto da marca d'agua.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = Number(document.querySelector("#watermarkSize").value);
  const opacity = Number(document.querySelector("#watermarkOpacity").value) / 100;

  pdf.getPages().forEach((page) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (page.getWidth() - textWidth) / 2,
      y: page.getHeight() / 2,
      size,
      font,
      color: rgb(0.1, 0.38, 0.29),
      opacity,
      rotate: degrees(35),
    });
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-marca-dagua.pdf`);
  addMetric("Paginas", pdf.getPageCount());
  addMetric("Texto", text);
  setStatus("Marca d'agua adicionada com sucesso.");
}

async function numberPdf() {
  resetOutput();
  const file = els.numbersFile.files[0];
  if (!file) throw new Error("Selecione um PDF para numerar.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const start = Number(document.querySelector("#numbersStart").value);
  const format = document.querySelector("#numbersFormat").value;
  const position = document.querySelector("#numbersPosition").value;
  if (!Number.isInteger(start) || start < 1) throw new Error("Informe um numero inicial valido.");

  pages.forEach((page, index) => {
    const pageNumber = start + index;
    const text = pageNumberText(format, pageNumber, start + pages.length - 1);
    const size = 10;
    const textWidth = font.widthOfTextAtSize(text, size);
    const point = pageNumberPosition(position, page, textWidth);
    page.drawText(text, {
      ...point,
      size,
      font,
      color: rgb(0.12, 0.15, 0.14),
    });
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-numerado.pdf`);
  addMetric("Paginas numeradas", pages.length);
  addMetric("Inicio", start);
  setStatus("PDF numerado com sucesso.");
}

async function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => resolve(new Uint8Array(await blob.arrayBuffer())), "image/jpeg", quality);
  });
}

async function pdfToJpg() {
  resetOutput();
  const file = els.pdfToJpgFile.files[0];
  if (!file) throw new Error("Selecione um PDF para converter em JPG.");

  const data = await file.arrayBuffer();
  const source = await window.pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const zip = new window.JSZip();
  const quality = Number(document.querySelector("#pdfToJpgQuality").value) / 100;
  const dpi = Number(document.querySelector("#pdfToJpgDpi").value);

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    setStatus(`Convertendo pagina ${pageNumber} de ${source.numPages}...`);
    const { canvas } = await renderPdfPage(source, pageNumber, dpi);
    const jpg = await canvasToJpegBytes(canvas, quality);
    zip.file(`${fileStem(file.name)}-pagina-${String(pageNumber).padStart(3, "0")}.jpg`, jpg);
    canvas.width = 1;
    canvas.height = 1;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${fileStem(file.name)}-jpg.zip`);
  addMetric("Imagens", source.numPages);
  addMetric("Tamanho ZIP", formatSize(blob.size));
  setStatus("PDF convertido para JPG com sucesso.");
}

async function embedImage(pdf, file) {
  const bytes = await fileBytes(file);
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    return pdf.embedPng(bytes);
  }
  return pdf.embedJpg(bytes);
}

function a4SizeForImage(image, orientation) {
  const portrait = [595.28, 841.89];
  const landscape = [841.89, 595.28];
  if (orientation === "portrait") return portrait;
  if (orientation === "landscape") return landscape;
  return image.width > image.height ? landscape : portrait;
}

async function jpgToPdf() {
  resetOutput();
  const files = Array.from(els.jpgToPdfFiles.files);
  if (!files.length) throw new Error("Selecione uma ou mais imagens.");

  const pdf = await PDFDocument.create();
  const pageSize = document.querySelector("#jpgPageSize").value;
  const orientation = document.querySelector("#jpgOrientation").value;

  for (const [index, file] of files.entries()) {
    setStatus(`Incluindo imagem ${index + 1} de ${files.length}...`);
    const image = await embedImage(pdf, file);
    const size = pageSize === "image" ? [image.width, image.height] : a4SizeForImage(image, orientation);
    const page = pdf.addPage(size);
    const margin = pageSize === "image" ? 0 : 36;
    const maxWidth = page.getWidth() - margin * 2;
    const maxHeight = page.getHeight() - margin * 2;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    page.drawImage(image, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, "imagens-seplan.pdf");
  addMetric("Imagens", files.length);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("Imagens convertidas para PDF com sucesso.");
}

async function cropPdf() {
  resetOutput();
  const file = els.cropFile.files[0];
  if (!file) throw new Error("Selecione um PDF para cortar.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const pages = pdf.getPages();
  const selected = new Set(optionalPages(document.querySelector("#cropRanges").value, pages.length));
  const top = mmToPt(document.querySelector("#cropTop").value);
  const right = mmToPt(document.querySelector("#cropRight").value);
  const bottom = mmToPt(document.querySelector("#cropBottom").value);
  const left = mmToPt(document.querySelector("#cropLeft").value);
  if (top + right + bottom + left === 0) throw new Error("Informe pelo menos uma margem para cortar.");

  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    const width = page.getWidth();
    const height = page.getHeight();
    const newWidth = width - left - right;
    const newHeight = height - top - bottom;
    if (newWidth <= 40 || newHeight <= 40) throw new Error("As margens informadas cortam demais a pagina.");
    page.setCropBox(left, bottom, newWidth, newHeight);
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-cortado.pdf`);
  addMetric("Paginas cortadas", selected.size);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("PDF cortado com sucesso.");
}

async function signPdf() {
  resetOutput();
  const file = els.signFile.files[0];
  if (!file) throw new Error("Selecione um PDF para assinar.");

  const text = document.querySelector("#signText").value.trim();
  if (!text) throw new Error("Informe o nome ou texto da assinatura.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const pages = pdf.getPages();
  const pageNumber = Number(document.querySelector("#signPage").value);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pages.length) {
    throw new Error(`Informe uma pagina entre 1 e ${pages.length}.`);
  }

  const page = pages[pageNumber - 1];
  const signatureFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 22;
  const textWidth = signatureFont.widthOfTextAtSize(text, size);
  const position = textPosition(document.querySelector("#signPosition").value, page, textWidth, size);
  page.drawText(text, {
    ...position,
    size,
    font: signatureFont,
    color: rgb(0.05, 0.17, 0.14),
  });
  page.drawLine({
    start: { x: position.x - 8, y: position.y - 8 },
    end: { x: position.x + Math.max(textWidth, 170) + 8, y: position.y - 8 },
    thickness: 0.8,
    color: rgb(0.05, 0.17, 0.14),
  });
  page.drawText("Assinatura", {
    x: position.x,
    y: position.y - 22,
    size: 8,
    font: labelFont,
    color: rgb(0.35, 0.42, 0.39),
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-assinado.pdf`);
  addMetric("Pagina assinada", pageNumber);
  addMetric("Assinatura", text);
  setStatus("Assinatura visual adicionada com sucesso.");
}

async function textStampPdf() {
  resetOutput();
  const file = els.textStampFile.files[0];
  if (!file) throw new Error("Selecione um PDF para adicionar texto.");

  const text = document.querySelector("#stampText").value.trim();
  if (!text) throw new Error("Informe o texto que sera inserido.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const pages = pdf.getPages();
  const selected = new Set(optionalPages(document.querySelector("#stampRanges").value, pages.length));
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = Number(document.querySelector("#stampSize").value);
  const positionName = document.querySelector("#stampPosition").value;

  pages.forEach((page, index) => {
    if (!selected.has(index)) return;
    const textWidth = font.widthOfTextAtSize(text, size);
    const position = textPosition(positionName, page, textWidth, size);
    page.drawText(text, {
      ...position,
      size,
      font,
      color: rgb(0.02, 0.38, 0.29),
    });
  });

  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-texto.pdf`);
  addMetric("Paginas alteradas", selected.size);
  addMetric("Texto", text);
  setStatus("Texto adicionado com sucesso.");
}

async function redactPdf() {
  resetOutput();
  const file = els.redactFile.files[0];
  if (!file) throw new Error("Selecione um PDF para tarjar.");

  const data = await file.arrayBuffer();
  const source = await window.pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const selected = new Set(optionalPages(document.querySelector("#redactRanges").value, source.numPages));
  const box = readPercentBox("redact");
  const out = await PDFDocument.create();
  const dpi = 160;

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    setStatus(`Processando pagina ${pageNumber} de ${source.numPages}...`);
    const { canvas, viewport, scale } = await renderPdfPage(source, pageNumber, dpi);
    if (selected.has(pageNumber - 1)) {
      const context = canvas.getContext("2d");
      context.fillStyle = "#000000";
      context.fillRect(
        (box.x / 100) * canvas.width,
        (box.y / 100) * canvas.height,
        (box.w / 100) * canvas.width,
        (box.h / 100) * canvas.height
      );
    }

    const jpg = await canvasToJpegBytes(canvas, 0.9);
    const image = await out.embedJpg(jpg);
    const page = out.addPage([viewport.width / scale, viewport.height / scale]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
    canvas.width = 1;
    canvas.height = 1;
  }

  const bytes = await out.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-tarjado.pdf`);
  addMetric("Paginas tarjadas", selected.size);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("PDF tarjado com sucesso.");
}

async function comparePdfs() {
  resetOutput();
  const fileA = els.compareFileA.files[0];
  const fileB = els.compareFileB.files[0];
  if (!fileA || !fileB) throw new Error("Selecione os dois PDFs para comparar.");

  const sourceA = await window.pdfjsLib.getDocument({ data: await fileA.arrayBuffer(), disableWorker: true }).promise;
  const sourceB = await window.pdfjsLib.getDocument({ data: await fileB.arrayBuffer(), disableWorker: true }).promise;
  const pageCount = Math.max(sourceA.numPages, sourceB.numPages);
  const dpi = Number(document.querySelector("#compareDpi").value);
  const zip = new window.JSZip();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    setStatus(`Comparando pagina ${pageNumber} de ${pageCount}...`);
    const renderedA = pageNumber <= sourceA.numPages ? await renderPdfPage(sourceA, pageNumber, dpi) : null;
    const renderedB = pageNumber <= sourceB.numPages ? await renderPdfPage(sourceB, pageNumber, dpi) : null;
    const widthA = renderedA?.canvas.width || 420;
    const widthB = renderedB?.canvas.width || 420;
    const height = Math.max(renderedA?.canvas.height || 540, renderedB?.canvas.height || 540);
    const gap = 28;
    const header = 44;
    const canvas = document.createElement("canvas");
    canvas.width = widthA + widthB + gap;
    canvas.height = height + header;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#123b31";
    context.font = "18px Arial";
    context.fillText("Original", 8, 28);
    context.fillText("Revisado", widthA + gap + 8, 28);
    context.strokeStyle = "#d9dfdc";
    context.beginPath();
    context.moveTo(widthA + gap / 2, 0);
    context.lineTo(widthA + gap / 2, canvas.height);
    context.stroke();

    if (renderedA) context.drawImage(renderedA.canvas, 0, header);
    if (renderedB) context.drawImage(renderedB.canvas, widthA + gap, header);
    if (!renderedA || !renderedB) {
      context.fillStyle = "#a83d3d";
      context.font = "16px Arial";
      const x = renderedA ? widthA + gap + 20 : 20;
      context.fillText("Pagina inexistente nesta versao", x, header + 40);
    }

    const jpg = await canvasToJpegBytes(canvas, 0.88);
    zip.file(`comparacao-pagina-${String(pageNumber).padStart(3, "0")}.jpg`, jpg);
    renderedA?.canvas && (renderedA.canvas.width = 1);
    renderedB?.canvas && (renderedB.canvas.width = 1);
    canvas.width = 1;
    canvas.height = 1;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, "comparacao-pdfs-seplan.zip");
  addMetric("Paginas comparadas", pageCount);
  addMetric("Original", `${sourceA.numPages} paginas`);
  addMetric("Revisado", `${sourceB.numPages} paginas`);
  setStatus("Comparacao gerada com sucesso.");
}

async function extractTextPdf() {
  resetOutput();
  const file = els.textExtractFile.files[0];
  if (!file) throw new Error("Selecione um PDF para extrair texto.");

  const source = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const selected = new Set(optionalPages(document.querySelector("#textExtractRanges").value, source.numPages));
  const parts = [];
  let extractedChars = 0;

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    if (!selected.has(pageNumber - 1)) continue;
    setStatus(`Extraindo texto da pagina ${pageNumber} de ${source.numPages}...`);
    const page = await source.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    extractedChars += text.length;
    parts.push(`--- Pagina ${pageNumber} ---\n${text}`);
  }

  if (!extractedChars) {
    throw new Error("Nao foi encontrado texto pesquisavel. Talvez o PDF seja escaneado e precise de OCR.");
  }

  const output = parts.join("\n\n");
  downloadText(output, `${fileStem(file.name)}.txt`);
  addMetric("Paginas lidas", selected.size);
  addMetric("Caracteres", extractedChars);
  setStatus("Texto extraido com sucesso.");
}

async function flattenFormsPdf() {
  resetOutput();
  const file = els.flattenFormsFile.files[0];
  if (!file) throw new Error("Selecione um PDF com formulario.");

  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error("Este PDF nao possui campos de formulario detectaveis.");

  form.flatten();
  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-formulario-fixo.pdf`);
  addMetric("Campos achatados", fields.length);
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("Formulario achatado com sucesso.");
}

function metadataValue(id) {
  return document.querySelector(id).value.trim();
}

function a4PageSize(orientation) {
  return orientation === "landscape" ? [841.89, 595.28] : [595.28, 841.89];
}

function drawWrappedText(page, text, options) {
  const { x, y, maxWidth, size, font, color, lineHeight } = options;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
  return lines.length * lineHeight;
}

async function metadataPdf() {
  resetOutput();
  const file = els.metadataFile.files[0];
  if (!file) throw new Error("Selecione um PDF para editar metadados.");

  const mode = document.querySelector(".metadata-mode.active").dataset.metadataMode;
  const pdf = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const now = new Date();

  if (mode === "clear") {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setCreator("");
    pdf.setProducer("");
  } else {
    pdf.setTitle(metadataValue("#metadataTitle") || "Documento SEPLAN");
    pdf.setAuthor(metadataValue("#metadataAuthor") || "Central SEPLAN");
    pdf.setSubject(metadataValue("#metadataSubject") || "Documento administrativo");
    const keywords = metadataValue("#metadataKeywords").split(",").map((word) => word.trim()).filter(Boolean);
    pdf.setKeywords(keywords);
    pdf.setCreator("Central SEPLAN PDF");
    pdf.setProducer("Central SEPLAN PDF");
  }

  pdf.setModificationDate(now);
  const bytes = await pdf.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-metadados.pdf`);
  addMetric("Modo", mode === "clear" ? "Limpar" : "Definir");
  addMetric("Tamanho final", formatSize(bytes.length));
  setStatus("Metadados atualizados com sucesso.");
}

async function addCoverPdf() {
  resetOutput();
  const file = els.coverFile.files[0];
  if (!file) throw new Error("Selecione um PDF para receber capa.");

  const source = await PDFDocument.load(await fileBytes(file), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const [width, height] = a4PageSize("portrait");
  const cover = out.addPage([width, height]);
  const titleFont = await out.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await out.embedFont(StandardFonts.Helvetica);
  const title = metadataValue("#coverTitle") || "Documento SEPLAN";
  const subtitle = metadataValue("#coverSubtitle");
  const owner = metadataValue("#coverOwner");
  const dateText = metadataValue("#coverDate") || new Date().toLocaleDateString("pt-BR");

  cover.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.04, 0.28, 0.21),
  });
  cover.drawText("CENTRAL SEPLAN", {
    x: 54,
    y: height - 58,
    size: 16,
    font: titleFont,
    color: rgb(1, 1, 1),
  });
  cover.drawLine({
    start: { x: 54, y: height - 126 },
    end: { x: width - 54, y: height - 126 },
    thickness: 1.2,
    color: rgb(0.85, 0.62, 0.17),
  });

  let cursor = height - 210;
  cursor -= drawWrappedText(cover, title, {
    x: 54,
    y: cursor,
    maxWidth: width - 108,
    size: 32,
    font: titleFont,
    color: rgb(0.08, 0.12, 0.11),
    lineHeight: 40,
  });

  if (subtitle) {
    cursor -= 26;
    cursor -= drawWrappedText(cover, subtitle, {
      x: 54,
      y: cursor,
      maxWidth: width - 108,
      size: 16,
      font: bodyFont,
      color: rgb(0.28, 0.34, 0.32),
      lineHeight: 23,
    });
  }

  const infoY = 150;
  cover.drawText(owner || "Central SEPLAN", {
    x: 54,
    y: infoY,
    size: 13,
    font: titleFont,
    color: rgb(0.08, 0.12, 0.11),
  });
  cover.drawText(dateText, {
    x: 54,
    y: infoY - 24,
    size: 12,
    font: bodyFont,
    color: rgb(0.35, 0.42, 0.39),
  });

  const pages = await out.copyPages(source, source.getPageIndices());
  pages.forEach((page) => out.addPage(page));
  const bytes = await out.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-com-capa.pdf`);
  addMetric("Paginas originais", source.getPageCount());
  addMetric("Paginas finais", source.getPageCount() + 1);
  setStatus("Capa adicionada com sucesso.");
}

function nupSlots(count, pageWidth, pageHeight, margin, gap) {
  if (count === 2) {
    const slotWidth = (pageWidth - margin * 2 - gap) / 2;
    const slotHeight = pageHeight - margin * 2;
    return [
      { x: margin, y: margin, width: slotWidth, height: slotHeight },
      { x: margin + slotWidth + gap, y: margin, width: slotWidth, height: slotHeight },
    ];
  }

  const slotWidth = (pageWidth - margin * 2 - gap) / 2;
  const slotHeight = (pageHeight - margin * 2 - gap) / 2;
  return [
    { x: margin, y: margin + slotHeight + gap, width: slotWidth, height: slotHeight },
    { x: margin + slotWidth + gap, y: margin + slotHeight + gap, width: slotWidth, height: slotHeight },
    { x: margin, y: margin, width: slotWidth, height: slotHeight },
    { x: margin + slotWidth + gap, y: margin, width: slotWidth, height: slotHeight },
  ];
}

async function nupPdf() {
  resetOutput();
  const file = els.nupFile.files[0];
  if (!file) throw new Error("Selecione um PDF para montar paginas por folha.");

  const source = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const out = await PDFDocument.create();
  const count = Number(document.querySelector("#nupCount").value);
  const dpi = Number(document.querySelector("#nupDpi").value);
  const pageSize = a4PageSize(document.querySelector("#nupOrientation").value);
  const margin = 22;
  const gap = 14;
  const slots = nupSlots(count, pageSize[0], pageSize[1], margin, gap);
  let outputPage = null;

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    setStatus(`Montando pagina ${pageNumber} de ${source.numPages}...`);
    const slotIndex = (pageNumber - 1) % count;
    if (slotIndex === 0) outputPage = out.addPage(pageSize);

    const { canvas } = await renderPdfPage(source, pageNumber, dpi);
    const jpg = await canvasToJpegBytes(canvas, 0.86);
    const image = await out.embedJpg(jpg);
    const slot = slots[slotIndex];
    const ratio = Math.min(slot.width / image.width, slot.height / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    outputPage.drawRectangle({
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      borderColor: rgb(0.78, 0.84, 0.81),
      borderWidth: 0.5,
    });
    outputPage.drawImage(image, {
      x: slot.x + (slot.width - width) / 2,
      y: slot.y + (slot.height - height) / 2,
      width,
      height,
    });
    canvas.width = 1;
    canvas.height = 1;
  }

  const bytes = await out.save({ useObjectStreams: true });
  downloadPdf(bytes, `${fileStem(file.name)}-${count}-por-folha.pdf`);
  addMetric("Paginas originais", source.numPages);
  addMetric("Folhas finais", out.getPageCount());
  addMetric("Layout", `${count} por folha`);
  setStatus("PDF economico gerado com sucesso.");
}

function wireEvents() {
  if (missingLibs.length) {
    document.querySelectorAll(".primary").forEach((button) => {
      button.disabled = true;
    });
    setStatus(`Nao foi possivel carregar: ${missingLibs.join(", ")}. Verifique a conexao ou hospede as bibliotecas localmente.`, true);
    return;
  }

  document.querySelectorAll(".tool-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tool-tab, .tool-panel").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.tool}`).classList.add("active");
      resetOutput();
      setStatus("Aguardando arquivos.");
    });
  });

  els.mergeFiles.addEventListener("change", () => {
    state.mergeFiles = [...state.mergeFiles, ...Array.from(els.mergeFiles.files)];
    renderMergeList();
  });

  els.mergeList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "remove") state.mergeFiles.splice(index, 1);
    if (button.dataset.action === "up" && index > 0) {
      [state.mergeFiles[index - 1], state.mergeFiles[index]] = [state.mergeFiles[index], state.mergeFiles[index - 1]];
    }
    if (button.dataset.action === "down" && index < state.mergeFiles.length - 1) {
      [state.mergeFiles[index + 1], state.mergeFiles[index]] = [state.mergeFiles[index], state.mergeFiles[index + 1]];
    }
    renderMergeList();
  });

  document.querySelector("#clearMerge").addEventListener("click", () => {
    state.mergeFiles = [];
    els.mergeFiles.value = "";
    renderMergeList();
    resetOutput();
    setStatus("Lista de PDFs limpa.");
  });

  document.querySelectorAll(".mode").forEach((button) => {
    button.addEventListener("click", () => {
      state.splitMode = button.dataset.mode;
      document.querySelectorAll(".mode").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll("[data-split-control]").forEach((control) => {
        control.hidden = control.dataset.splitControl !== state.splitMode;
      });
    });
  });

  document.querySelectorAll(".metadata-mode").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".metadata-mode").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      document.querySelector("#metadataFields").hidden = button.dataset.metadataMode === "clear";
    });
  });

  els.quality.addEventListener("input", () => {
    els.qualityOut.textContent = `${els.quality.value}%`;
  });

  const actions = [
    ["#mergeBtn", mergePdfs, "Juntando..."],
    ["#compressBtn", compressPdf, "Compactando..."],
    ["#splitBtn", splitPdf, "Dividindo..."],
    ["#extractBtn", extractPages, "Extraindo..."],
    ["#organizeBtn", organizePdf, "Organizando..."],
    ["#rotateBtn", rotatePdf, "Girando..."],
    ["#watermarkBtn", watermarkPdf, "Aplicando..."],
    ["#numbersBtn", numberPdf, "Numerando..."],
    ["#pdfToJpgBtn", pdfToJpg, "Convertendo..."],
    ["#jpgToPdfBtn", jpgToPdf, "Criando PDF..."],
    ["#cropBtn", cropPdf, "Cortando..."],
    ["#signBtn", signPdf, "Assinando..."],
    ["#textStampBtn", textStampPdf, "Adicionando..."],
    ["#redactBtn", redactPdf, "Tarjando..."],
    ["#compareBtn", comparePdfs, "Comparando..."],
    ["#textExtractBtn", extractTextPdf, "Extraindo..."],
    ["#flattenFormsBtn", flattenFormsPdf, "Achatando..."],
    ["#metadataBtn", metadataPdf, "Salvando..."],
    ["#coverBtn", addCoverPdf, "Adicionando..."],
    ["#nupBtn", nupPdf, "Montando..."],
  ];

  actions.forEach(([selector, handler, busyLabel]) => {
    const button = document.querySelector(selector);
    button.addEventListener("click", async () => {
      try {
        validateFileLoad(currentPanelFiles(button));
        setBusy(button, true, busyLabel);
        await handler();
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Nao foi possivel concluir a operacao.", true);
      } finally {
        setBusy(button, false);
      }
    });
  });

  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", () => {
      try {
        validateFileLoad(Array.from(input.files || []));
      } catch (error) {
        input.value = "";
        setStatus(error.message, true);
      }
    });
  });

  installDropzones();
  addMetric("Versao", APP_VERSION);
}

wireEvents();

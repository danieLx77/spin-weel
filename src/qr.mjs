export const MAX_QR_LENGTH = 1400;
export async function makeQRMatrix(url) {
  if (
    typeof url !== "string" ||
    !/^https?:\/\//.test(url) ||
    !/^[\x20-\x7e]+$/.test(url)
  )
    throw new Error("Link inválido para o QR Code.");
  if (url.length > MAX_QR_LENGTH)
    throw new Error(
      "Esta roleta é grande demais para um QR Code legível. Use Copiar link ou Exportar backup.",
    );
  let qrcode;
  try {
    ({ default: qrcode } = await import("qrcode-generator"));
  } catch {
    throw new Error(
      "Para gerar o QR Code pela primeira vez, conecte-se à internet e recarregue a página. Depois do primeiro uso, ele ficará disponível offline.",
    );
  }
  const code = qrcode(0, "M");
  code.addData(url, "Byte");
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => code.isDark(row, col)),
  );
}

const svgIconSourceCache = new Map<string, Promise<string>>();

function normalizeSvgTextToDataUrl(svgText: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");
  const svg = document.querySelector("svg");

  if (!svg) {
    throw new Error("SVG invalide.");
  }

  const viewBox = svg.getAttribute("viewBox");

  if (!viewBox) {
    const width = Number.parseFloat(svg.getAttribute("width") ?? "512");
    const height = Number.parseFloat(svg.getAttribute("height") ?? "512");
    svg.setAttribute(
      "viewBox",
      `0 0 ${Number.isFinite(width) ? width : 512} ${Number.isFinite(height) ? height : 512}`,
    );
  }

  svg.setAttribute("width", "32");
  svg.setAttribute("height", "32");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("x");
  svg.removeAttribute("y");

  const serialized = new XMLSerializer().serializeToString(svg);

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
}

export async function getNormalizedSvgIconSource(imagePath: string): Promise<string> {
  const cached = svgIconSourceCache.get(imagePath);

  if (cached) {
    return cached;
  }

  const promise = fetch(imagePath, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Icone introuvable: ${imagePath}`);
    }

    const svgText = await response.text();
    return normalizeSvgTextToDataUrl(svgText);
  });

  svgIconSourceCache.set(imagePath, promise);
  return promise;
}

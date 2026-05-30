const svgIconSourceCache = new Map<string, Promise<string>>();

function parseSvgLength(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^([0-9]*\.?[0-9]+)/);

  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);

  return Number.isFinite(parsed) ? parsed : null;
}

function resolveSvgBoundsViewBox(svg: SVGSVGElement): string | null {
  if (typeof document === "undefined" || !document.body) {
    return null;
  }

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "absolute";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  container.style.pointerEvents = "none";

  const clone = svg.cloneNode(true);

  if (!(clone instanceof SVGSVGElement)) {
    return null;
  }

  clone.removeAttribute("width");
  clone.removeAttribute("height");
  clone.removeAttribute("x");
  clone.removeAttribute("y");

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const bbox = clone.getBBox();

    if (
      Number.isFinite(bbox.x) &&
      Number.isFinite(bbox.y) &&
      Number.isFinite(bbox.width) &&
      Number.isFinite(bbox.height) &&
      bbox.width > 0 &&
      bbox.height > 0
    ) {
      return `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
    }
  } catch {}
  finally {
    container.remove();
  }

  return null;
}

function ensureSvgViewBox(svg: SVGSVGElement): void {
  const existingViewBox = svg.getAttribute("viewBox")?.trim();

  if (existingViewBox) {
    return;
  }

  const width = parseSvgLength(svg.getAttribute("width"));
  const height = parseSvgLength(svg.getAttribute("height"));
  const numericViewBox =
    width !== null &&
    height !== null &&
    width > 4 &&
    height > 4
      ? `0 0 ${width} ${height}`
      : null;
  const boundsViewBox = resolveSvgBoundsViewBox(svg);

  if (!boundsViewBox && !numericViewBox) {
    throw new Error("SVG sans viewBox exploitable.");
  }

  const resolvedViewBox = boundsViewBox ?? numericViewBox;

  if (!resolvedViewBox) {
    throw new Error("SVG sans viewBox exploitable.");
  }

  svg.setAttribute("viewBox", resolvedViewBox);
}

function normalizeSvgTextToDataUrl(svgText: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");
  const svg = document.querySelector("svg");

  if (!svg) {
    throw new Error("SVG invalide.");
  }

  ensureSvgViewBox(svg);

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

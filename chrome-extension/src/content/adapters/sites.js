// Site-specific selector pack. Each function returns the chart node or anchor node,
// or null if not found on this page. We keep them deliberately small
// — if a selector misses, the generic adapter takes over.
import generic from './generic.js';

function first(_doc, ...sels) { for (const s of sels) { const el = _doc.querySelector(s); if (el) return el; } return null; }

export const zaraChart       = (d) => first(d, '[class*=size-info]', '[class*=size-table]', '[data-qa-action="size-list"] table') || generic.detectChart(d);
export const asosChart       = (d) => first(d, '#sizing-help-modal table', '[data-testid="size-guide"] table', '[class*=sizeguide] table') || generic.detectChart(d);
export const sheinChart      = (d) => first(d, '.size-info-table', '.size-guide-table', '[class*=sizeGuide] table') || generic.detectChart(d);
export const hmChart         = (d) => first(d, '[data-elid="size-guide"] table', '[class*=size-guide] table', '#sizeGuide table') || generic.detectChart(d);
export const amazonChart     = (d) => first(d, '#sizeChartContent', '#prodDetails table', '[id*=size-chart]') || generic.detectChart(d);
export const aliexpressChart = (d) => first(d, '[class*=size-guide]', '[class*=SizeGuide] table', '[data-pl="size-guide"] table') || generic.detectChart(d);

export const zaraAnchor       = (d) => first(d, '[data-qa-action="size-selector"]', '[data-qa-action="size-list"]', '.product-size-selector') || generic.detectAnchor(d);
export const asosAnchor       = (d) => first(d, '[data-testid="size-selector"]', '[data-testid="select-size"]', 'select[data-id="sizeSelect"]') || generic.detectAnchor(d);
export const sheinAnchor      = (d) => first(d, '[class*="product-intro__size"]', '[class*="goods-size"]', '[class*="size-list"]', '[class*="spec-list"]', '[data-attr-name="Size" i]', '[class*="sizeRadio" i]') || generic.detectAnchor(d);
export const hmAnchor         = (d) => first(d, '[data-elid="size-selector"]', '[class*="size-selector"]', 'button[aria-label*="size" i]') || generic.detectAnchor(d);
export const amazonAnchor     = (d) => first(d, '#native_dropdown_selected_size_name', '#inline-twister-row-size_name', '#dropdown_selected_size_name') || generic.detectAnchor(d);
export const aliexpressAnchor = (d) => first(d, '[class*="sku-property-item"]', '[class*="sku-item"]', '[class*="size-selector"]') || generic.detectAnchor(d);

export function getAdapter(host) {
  const h = (host || '').toLowerCase();
  if (h.includes('zara.com'))         return { name: 'zara',       detectChart: zaraChart,       detectAnchor: zaraAnchor };
  if (h.includes('asos.com'))         return { name: 'asos',       detectChart: asosChart,       detectAnchor: asosAnchor };
  if (h.includes('shein.com'))        return { name: 'shein',      detectChart: sheinChart,      detectAnchor: sheinAnchor };
  if (h.includes('hm.com'))           return { name: 'hm',         detectChart: hmChart,         detectAnchor: hmAnchor };
  if (h.includes('amazon.'))          return { name: 'amazon',     detectChart: amazonChart,     detectAnchor: amazonAnchor };
  if (h.includes('aliexpress.'))      return { name: 'aliexpress', detectChart: aliexpressChart, detectAnchor: aliexpressAnchor };
  return { name: 'generic', detectChart: generic.detectChart, detectAnchor: generic.detectAnchor };
}

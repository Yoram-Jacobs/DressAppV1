// Site-specific selector pack. Each function returns the chart node or anchor node,
// or null if not found on this page. We keep them deliberately small
// — if a selector misses, the generic adapter takes over.
import generic from './generic.js';

function first(_doc, ...sels) {
  for (const s of sels) {
    const el = _doc.querySelector(s);
    if (el) return el;
  }
  return null;
}

export const zaraChart       = (d) => first(d, '[class*=size-info]', '[class*=size-table]', '[data-qa-action="size-list"] table') || generic.detectChart(d);
export const asosChart       = (d) => first(d, '#sizing-help-modal table', '[data-testid="size-guide"] table', '[class*=sizeguide] table') || generic.detectChart(d);
export const sheinChart      = (d) => first(d, '.size-info-table', '.size-guide-table', '[class*=sizeGuide] table') || generic.detectChart(d);
export const hmChart         = (d) => first(d, '[data-elid="size-guide"] table', '[class*=size-guide] table', '#sizeGuide table') || generic.detectChart(d);
export const amazonChart     = (d) => first(d, '#sizeChartContent', '#prodDetails table', '[id*=size-chart]') || generic.detectChart(d);
export const aliexpressChart = (d) => first(d, '[class*=size-guide]', '[class*=SizeGuide] table', '[data-pl="size-guide"] table') || generic.detectChart(d);
export const ebayChart       = (d) => first(d, '[class*="size-chart"] table', '#size-chart table', '[data-testid*="size-chart"] table', '[aria-label*="size guide" i] table', '.vim.d-size-chart table', '[class*="size-chart"]') || generic.detectChart(d);
export const uniqloChart     = (d) => first(d, '[data-test="size-chart-modal"] table', '[class*="size-chart"] table', '.size-chart-table', '[class*="SizeChart"] table', '[class*="size-chart"]') || generic.detectChart(d);
export const nextChart       = (d) => first(d, '[data-testid="size-guide-modal"] table', '[class*="SizeGuide"] table', '[class*="size-guide"] table') || generic.detectChart(d);
export const forever21Chart  = (d) => first(d, '[class*="size-guide"] table', '[class*="size-chart"] table', '.size-guide-modal table', '[id*="size-guide"] table') || generic.detectChart(d);
export const netAPorterChart = (d) => first(d, '[class*="SizeGuide"] table', '[class*="size-guide"] table', '[data-testid="size-guide-modal"] table') || generic.detectChart(d);
export const fashionNovaChart= (d) => first(d, '[class*="size-chart"] table', '[class*="size-guide"] table', '#size-chart table', '[data-modal*="size"] table') || generic.detectChart(d);
export const cosChart        = (d) => first(d, '[data-testid="size-guide"] table', '[class*="size-guide"] table', '[class*="sizeGuide"] table') || generic.detectChart(d);

export const zaraAnchor       = (d) => first(d, '[data-qa-action="size-selector"]', '[data-qa-action="size-list"]', '.product-size-selector') || generic.detectAnchor(d);
export const asosAnchor       = (d) => first(d, '[data-testid="size-selector"]', '[data-testid="select-size"]', 'select[data-id="sizeSelect"]') || generic.detectAnchor(d);
export const sheinAnchor      = (d) => first(d, '[class*="product-intro__size"]', '[class*="goods-size"]', '[class*="size-list"]', '[class*="spec-list"]', '[data-attr-name="Size" i]', '[class*="sizeRadio" i]') || generic.detectAnchor(d);
export const hmAnchor         = (d) => first(d, '[data-elid="size-selector"]', '[class*="size-selector"]', 'button[aria-label*="size" i]') || generic.detectAnchor(d);
export const amazonAnchor     = (d) => first(d, '#native_dropdown_selected_size_name', '#inline-twister-row-size_name', '#dropdown_selected_size_name') || generic.detectAnchor(d);
export const aliexpressAnchor = (d) => first(d, '[class*="sku-property-item"]', '[class*="sku-item"]', '[class*="size-selector"]') || generic.detectAnchor(d);
export const ebayAnchor       = (d) => first(d, '[data-testid*="x-msku__select-box"]', 'select[aria-label*="Size" i]', '[class*="x-msku"]', '.vim.x-msku', 'select[name*="Size" i]') || generic.detectAnchor(d);
export const uniqloAnchor     = (d) => first(d, '[data-test="size-picker"]', '[class*="size-picker"]', '[class*="size-chips"]', '[aria-label*="Select size" i]', 'div[class*="chip-list"]') || generic.detectAnchor(d);
export const nextAnchor       = (d) => first(d, '[data-testid="size-selector"]', '[class*="SizeSelector"]', 'select[id*="Size" i]', '[class*="size-dropdown"]', 'select[name*="size" i]') || generic.detectAnchor(d);
export const forever21Anchor  = (d) => first(d, '[class*="size-buttons"]', '[class*="product-size"]', '[class*="swatch-list--size"]', 'div[data-property="size"]') || generic.detectAnchor(d);
export const netAPorterAnchor = (d) => first(d, '[class*="SizeSelector"]', '[data-testid="size-selector"]', '[class*="SelectSize"]', 'select[name*="size" i]', '[class*="size-dropdown"]') || generic.detectAnchor(d);
export const fashionNovaAnchor= (d) => first(d, '[class*="product-form__size"]', '[class*="size-buttons"]', '[data-option-name*="Size" i]', '[class*="variant-input--size"]', 'div[data-variant-option="Size"]') || generic.detectAnchor(d);
export const cosAnchor        = (d) => first(d, '[data-testid="size-selector"]', '[class*="size-selector"]', 'button[aria-label*="size" i]', '[class*="size-picker"]') || generic.detectAnchor(d);

export function getAdapter(host) {
  const h = (host || '').toLowerCase();
  if (h.includes('zara.com'))         return { name: 'zara',         detectChart: zaraChart,         detectAnchor: zaraAnchor };
  if (h.includes('asos.com'))         return { name: 'asos',         detectChart: asosChart,         detectAnchor: asosAnchor };
  if (h.includes('shein.com'))        return { name: 'shein',        detectChart: sheinChart,        detectAnchor: sheinAnchor };
  if (h.includes('hm.com'))           return { name: 'hm',           detectChart: hmChart,           detectAnchor: hmAnchor };
  if (h.includes('amazon.'))          return { name: 'amazon',       detectChart: amazonChart,       detectAnchor: amazonAnchor };
  if (h.includes('aliexpress.'))      return { name: 'aliexpress',   detectChart: aliexpressChart,   detectAnchor: aliexpressAnchor };
  if (h.includes('ebay.'))            return { name: 'ebay',         detectChart: ebayChart,         detectAnchor: ebayAnchor };
  if (h.includes('uniqlo.com'))       return { name: 'uniqlo',       detectChart: uniqloChart,       detectAnchor: uniqloAnchor };
  if (h.includes('next.') || h.includes('nextdirect.com')) return { name: 'next', detectChart: nextChart, detectAnchor: nextAnchor };
  if (h.includes('forever21.com'))    return { name: 'forever21',    detectChart: forever21Chart,    detectAnchor: forever21Anchor };
  if (h.includes('net-a-porter.com')) return { name: 'net-a-porter', detectChart: netAPorterChart,   detectAnchor: netAPorterAnchor };
  if (h.includes('fashionnova.com'))  return { name: 'fashionnova',  detectChart: fashionNovaChart,  detectAnchor: fashionNovaAnchor };
  if (h.includes('cos.com') || h.includes('cosstores.com')) return { name: 'cos', detectChart: cosChart, detectAnchor: cosAnchor };
  return { name: 'generic', detectChart: generic.detectChart, detectAnchor: generic.detectAnchor };
}

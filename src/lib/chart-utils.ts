export type ChartPayload = {
  type: 'bar' | 'pie' | 'scatter' | 'grouped_bar' | 'box';
  data: any[];
  config: Record<string, any>;
};

export function mapRecommendationToChart(rec: any, records: any[]): ChartPayload | null {
  const name = (rec.name || '').toLowerCase();
  const fields = rec.fields || [];

  if (!records || !Array.isArray(records)) {
    return null;
  }

  // Helper: parse numeric
  const toNum = (v: any) => {
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  if (name.includes('bar') && fields.length >= 1) {
    const x = fields[0];
    const yField = fields[1];
    if (yField) {
      const grouped: Record<string, number[]> = {};
      records.forEach(r => {
        const key = String(r[x] ?? '');
        const v = toNum(r[yField]);
        if (v !== null) (grouped[key] = grouped[key] || []).push(v);
      });
      const data = Object.entries(grouped).map(([k, vals]) => ({ category: k, value: vals.reduce((a,b)=>a+b,0) / (vals.length || 1) }));
      return { type: 'bar', data, config: { x: 'category', y: 'value', agg: 'mean' } };
    } else {
      const counts: Record<string, number> = {};
      records.forEach(r => { counts[String(r[x] ?? '')] = (counts[String(r[x] ?? '')] || 0) + 1; });
      const data = Object.entries(counts).map(([k,v]) => ({ category: k, value: v }));
      return { type: 'bar', data, config: { x: 'category', y: 'value', agg: 'count' } };
    }
  }

  if (name.includes('pie') && fields.length >= 1) {
    const x = fields[0];
    const counts: Record<string, number> = {};
    records.forEach(r => { counts[String(r[x] ?? '')] = (counts[String(r[x] ?? '')] || 0) + 1; });
    const data = Object.entries(counts).map(([k,v]) => ({ name: k, value: v }));
    return { type: 'pie', data, config: { nameKey: 'name', valueKey: 'value' } };
  }

  if (name.includes('scatter') && fields.length >= 2) {
    const [x, y] = fields;
    const data = records.map(r => ({ x: toNum(r[x]) ?? 0, y: toNum(r[y]) ?? 0 }));
    return { type: 'scatter', data, config: { x: 'x', y: 'y' } };
  }

  if (name.includes('group') && fields.length >= 2) {
    const [cat, sub] = fields;
    const map: Record<string, Record<string, number>> = {};
    records.forEach(r => {
      const a = String(r[cat] ?? '');
      const b = String(r[sub] ?? '');
      map[a] = map[a] || {};
      map[a][b] = (map[a][b] || 0) + 1;
    });
    const allSub = new Set<string>();
    Object.values(map).forEach(m => Object.keys(m).forEach(k => allSub.add(k)));
    const data = Object.entries(map).map(([k, m]) => {
      const row: any = { category: k };
      Array.from(allSub).forEach(s => row[s] = m[s] || 0);
      return row;
    });
    return { type: 'grouped_bar', data, config: { x: 'category', groups: Array.from(allSub) } };
  }

  // Box/other not implemented here
  return null;
}

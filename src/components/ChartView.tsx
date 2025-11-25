import React from 'react';
import { ChartContainer } from './ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ScatterChart, Scatter, CartesianGrid, Legend
} from 'recharts';
import type { ChartPayload } from '../lib/chart-utils';

export function ChartView({ payload }: { payload: ChartPayload }) {
  const { type, data, config } = payload;

  if (type === 'bar') {
    return (
      <ChartContainer id="chart" className="w-full" config={{}}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={config.x} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={config.y} fill="#3b82f6" />
          <Legend />
        </BarChart>
      </ChartContainer>
    );
  }

  if (type === 'pie') {
    return (
      <ChartContainer id="chart" className="w-full" config={{}}>
        <PieChart>
          <Pie data={data} dataKey={config.valueKey || 'value'} nameKey={config.nameKey || 'name'} outerRadius={80} label>
            {data.map((_, i) => <Cell key={i} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartContainer>
    );
  }

  if (type === 'scatter') {
    return (
      <ChartContainer id="chart" className="w-full" config={{}}>
        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid />
          <XAxis dataKey={config.x} />
          <YAxis dataKey={config.y} />
          <Tooltip />
          <Scatter data={data} fill="#06b6d4" />
          <Legend />
        </ScatterChart>
      </ChartContainer>
    );
  }

  if (type === 'grouped_bar') {
    // groups in config.groups
    const groups: string[] = config.groups || [];
    return (
      <ChartContainer id="chart" className="w-full" config={{}}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={config.x} />
          <YAxis />
          <Tooltip />
          {groups.map((g, i) => (
            <Bar key={g} dataKey={g} stackId="a" fill={["#3b82f6", "#06b6d4", "#f59e0b", "#ef4444"][i % 4]} />
          ))}
          <Legend />
        </BarChart>
      </ChartContainer>
    );
  }

  return <div>Unsupported chart type: {type}</div>;
}

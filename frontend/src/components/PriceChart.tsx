"use client";

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import staticPriceData from '@/data/static-price-data.json';

interface PriceChartProps {
    /** Current GLD price from the oracle (e.g. "0.02"). Appended as the last point. */
    currentPrice?: string;
}

export function PriceChart({ currentPrice }: PriceChartProps) {
    const data = useMemo(() => {
        // Start with static history (without the last point which was the old hardcoded value)
        const history = staticPriceData.priceHistory.slice(0, -1);

        // Append the live oracle price as the final "Now" point
        if (currentPrice && currentPrice !== "--") {
            history.push({ time: "Now", price: currentPrice, fullDate: "" });
        }

        return history;
    }, [currentPrice]);

    // Compute % change between first and last point
    const pctChange = useMemo(() => {
        if (data.length < 2) return null;
        const first = parseFloat(data[0].price);
        const last = parseFloat(data[data.length - 1].price);
        if (!first || !last) return null;
        return ((last - first) / first) * 100;
    }, [data]);

    return (
        <div className="h-[300px] w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Price History (GLD/ETH)</h3>
                    {pctChange !== null && (
                        <p className={`text-xs font-medium ${pctChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded text-gray-600">24H</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 30,
                    }}
                >
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        minTickGap={30}
                        dy={10}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(value) => `Ξ${value}`}
                        width={50}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`${value} ETH`, 'Price']}
                    />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

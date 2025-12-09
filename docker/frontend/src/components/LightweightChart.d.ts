import { Time } from "lightweight-charts";
type SeriesPoint = {
    time: Time;
    value: number;
};
export interface LightweightChartProps {
    height?: number;
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    topColor?: string;
    bottomColor?: string;
    data?: SeriesPoint[];
}
export declare function LightweightChart({ height, backgroundColor, lineColor, textColor, topColor, bottomColor, data, }: LightweightChartProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=LightweightChart.d.ts.map